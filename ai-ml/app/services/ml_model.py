"""Runtime wrapper around the trained career classifier (see training/train.py).

The model is a multinomial logistic regression over skill presence, trained on real job postings.
It is optional: if the file is missing or does not cover every career in the knowledge base the
recommender falls back to rule-based scoring only (and logs a warning), so the service never breaks.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

log = logging.getLogger(__name__)
MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "career_model.joblib"


@lru_cache(maxsize=1)
def _load() -> dict | None:
    try:
        return joblib.load(MODEL_PATH)
    except Exception as exc:  # missing / unreadable / sklearn version mismatch -> rule-based fallback
        log.warning("Career model not loaded (%s: %s). Recommendations use the rules only; run `python training/train.py`.", type(exc).__name__, exc)
        return None


@lru_cache(maxsize=8)
def _warn_once(message: str) -> None:
    log.warning(message)


def available() -> bool:
    return _load() is not None


def metrics() -> dict | None:
    bundle = _load()
    return bundle["metrics"] if bundle else None


def predict_proba(skills: set[str], career_ids: list[str]) -> dict[str, float] | None:
    """career_id -> probability, or None if the model can't be used for this input."""
    bundle = _load()
    if bundle is None or not skills:
        return None
    classes = bundle["classes"]
    if set(career_ids) - set(classes):  # knowledge base has careers the model never saw: retrain
        _warn_once("Career model does not cover every career in careers.csv (%s). Using the rules only; retrain with `python training/train.py`." % sorted(set(career_ids) - set(classes)))
        return None
    index = {s: i for i, s in enumerate(bundle["vocab"])}
    x = np.zeros((1, len(index)), dtype=np.float32)
    hit = False
    for s in skills:
        if s in index:
            x[0, index[s]] = 1
            hit = True
    if not hit:
        return None
    proba = bundle["model"].predict_proba(x)[0]
    return dict(zip(classes, map(float, proba)))
