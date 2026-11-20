import re

_WS = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    """Lowercase and collapse whitespace so dictionary matching is predictable."""
    return _WS.sub(" ", (text or "").lower()).strip()
