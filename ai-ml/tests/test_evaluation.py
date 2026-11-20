"""Regression guard: editing the knowledge base or the formula must not silently hurt accuracy.

Thresholds sit a little below today's results (core 100% top-1, hard 75% strict / 95% top-3) so that
one edge-case persona flipping does not fail the build, but a real regression does.
"""
import importlib.util
from pathlib import Path

import pandas as pd

from app.services.knowledge_base import get_kb

_spec = importlib.util.spec_from_file_location("evaluate", Path(__file__).resolve().parents[1] / "evaluation" / "evaluate.py")
evaluate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(evaluate)

kb = get_kb()
personas = evaluate.load_personas()


def _metrics(weights, subset):
    sub = personas[personas["set"] == subset]
    rankings = [evaluate.rank_careers(kb, p, weights) for p in sub.itertuples()]
    return evaluate.score_rankings(sub, rankings)


def test_personas_file_is_well_formed():
    assert set(personas["set"]) == {"core", "hard"}
    assert personas["id"].is_unique
    valid = set(kb.career_ids())
    for row in personas.itertuples():
        assert row.expected in valid, row.id
        assert set(evaluate.split(row.acceptable)) <= valid, row.id


def test_hybrid_accuracy_has_not_regressed():
    hybrid = evaluate.CONFIGS["Hybrid (0.5 / 0.3 / 0.2)"]
    core = _metrics(hybrid, "core")
    hard = _metrics(hybrid, "hard")
    assert core["top1_strict"] >= 0.90, core
    assert hard["top1_strict"] >= 0.65, hard
    assert hard["top1_lenient"] >= 0.90, hard
    assert hard["top3"] >= 0.90, hard


def test_interests_alone_are_not_enough():
    # interests are a supporting signal; skills must carry the decision
    hybrid = _metrics(evaluate.CONFIGS["Hybrid (0.5 / 0.3 / 0.2)"], "hard")["top1_strict"]
    interests_only = _metrics(evaluate.CONFIGS["Interests only"], "hard")["top1_strict"]
    assert hybrid > interests_only


def test_confidence_flag_rarely_fires_on_realistic_profiles():
    from app.services.engine import analyze_profile

    flagged = 0
    for p in personas.itertuples():
        out = analyze_profile(kb, evaluate.split(p.skills), evaluate.split(p.interests), evaluate.split(p.tech_stack), p.experience_type)
        assert out["confidence"] != "none", p.id  # every persona has recognisable skills
        flagged += out["confidence"] == "low"
    assert flagged / len(personas) <= 0.20


def test_production_blend_with_trained_model_has_not_regressed():
    """The shipped scorer = rules + trained model (ML_WEIGHT). Today: core 96.9%, hard strict 85%, lenient 100%."""
    from app.services import ml_model

    assert ml_model.available(), "run `python training/train.py` to create app/models/career_model.joblib"
    for subset, floor in (("core", {"top1_strict": 0.90}), ("hard", {"top1_strict": 0.75, "top1_lenient": 0.95, "top3": 0.90})):
        sub = personas[personas["set"] == subset]
        m = evaluate.score_rankings(sub, [evaluate.rank_careers(kb, p, None, ml_weight=None) for p in sub.itertuples()])
        for key, minimum in floor.items():
            assert m[key] >= minimum, (subset, key, m[key])


def test_model_covers_every_career_and_is_not_worse_than_rules_on_real_postings():
    from app.services import ml_model

    m = ml_model.metrics()
    assert set(m["data"]["classes"]) == set(kb.career_ids()), "knowledge base changed: retrain the model"
    held_out = m["held_out_real"]["model"]
    assert held_out["top1"] > m["held_out_real"]["majority_class_top1"] + 0.10  # clearly better than guessing the biggest class
    assert held_out["top3"] >= 0.80
    cmp = m["same_sample_comparison"]
    assert cmp["model"]["top1"] > cmp["rule_based"]["top1"]


def test_recommender_falls_back_to_rules_when_model_missing(monkeypatch):
    from app.services import ml_model, recommender

    monkeypatch.setattr(ml_model, "_load", lambda: None)
    res = recommender.recommend(kb, ["python", "sql"], top_n=3)
    assert len(res) == 3 and all(r["breakdown"]["ml_model"] == 0.0 for r in res)
