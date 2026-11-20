# Training the career model

The recommender blends hand-written scoring rules with a logistic regression trained on **real job postings**.

## 1. Get the data (free, no account)
```
python -c "import urllib.request as u; u.urlretrieve('https://huggingface.co/datasets/lukebarousse/data_jobs/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet','data/real/data_jobs.parquet')"
pip install pyarrow joblib
```
Dataset: `lukebarousse/data_jobs` on Hugging Face (Apache-2.0), ~785k Google job postings with skill lists.

## 2. Pipeline
| Step | Command | What it does |
|---|---|---|
| Knowledge base | `python training/extend_kb.py` | Adds real-world skills + Data Engineer / Cloud Engineer with weights from posting frequencies (already applied; safe to re-run) |
| Train | `python training/train.py` | Trains + evaluates on held-out postings, saves `app/models/career_model.joblib` |
| Tune blend | `python evaluation/blend_sweep.py` | Chooses `ML_WEIGHT` in `app/services/recommender.py` |
| Report | `python evaluation/model_report.py` | Writes `evaluation/results/MODEL_RESULTS.md` |
| Tests | `python -m pytest -q` | Guards accuracy floors and the fallback |

Retrain whenever `careers.csv` or `skills.csv` change: the service ignores the model (rules only) if it does not cover every career.
`data/real/` is only needed for training, not to run the service.
