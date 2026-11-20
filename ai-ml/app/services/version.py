"""A fingerprint of everything that changes recommendation results: the knowledge-base CSVs and the trained model.

The backend stores this next to every cached analysis and recomputes when it no longer matches, so editing a CSV
or retraining the model never leaves users looking at stale results.
"""
from __future__ import annotations

import hashlib
from functools import lru_cache

from app.services.knowledge_base import DATA_DIR
from app.services.ml_model import MODEL_PATH


@lru_cache(maxsize=1)
def data_version() -> str:
    digest = hashlib.sha256()
    for path in sorted(DATA_DIR.glob("*.csv")) + [MODEL_PATH]:
        if path.exists():
            digest.update(path.name.encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()[:16]
