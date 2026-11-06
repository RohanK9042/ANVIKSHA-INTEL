import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

STORAGE_ROOT = Path(
    os.getenv(
        "AEGIS_STORAGE_DIR",
        str(PROJECT_ROOT / "storage")
    )
).expanduser().resolve()

CASES_DIR = STORAGE_ROOT / "cases"
EVIDENCE_ROOT = STORAGE_ROOT / "evidence"
ORIGINALS_DIR = EVIDENCE_ROOT / "originals"
MANIFESTS_DIR = EVIDENCE_ROOT / "manifests"
AUDIT_DIR = EVIDENCE_ROOT / "audit"
IMAGE_INDEX_DIR = STORAGE_ROOT / "image_index"

for directory in [
    CASES_DIR,
    ORIGINALS_DIR,
    MANIFESTS_DIR,
    AUDIT_DIR,
    IMAGE_INDEX_DIR,
]:
    directory.mkdir(parents=True, exist_ok=True)
