
import hashlib
import json
import uuid

from datetime import datetime, timezone
from pathlib import Path

from backend.core.security import encrypt_bytes, decrypt_bytes


PROJECT_ROOT = Path(__file__).resolve().parents[2]

EVIDENCE_ROOT = PROJECT_ROOT / "storage" / "evidence"
ORIGINALS_DIR = EVIDENCE_ROOT / "originals"
MANIFESTS_DIR = EVIDENCE_ROOT / "manifests"
AUDIT_DIR = EVIDENCE_ROOT / "audit"

for directory in [ORIGINALS_DIR, MANIFESTS_DIR, AUDIT_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record_audit_event(event_type: str, evidence_id: str) -> None:
    """Append a hash-linked audit event."""
    audit_file = AUDIT_DIR / "audit.jsonl"

    previous_hash = "GENESIS"

    if audit_file.exists():
        lines = audit_file.read_text(encoding="utf-8").splitlines()
        if lines:
            previous_event = json.loads(lines[-1])
            previous_hash = previous_event["event_hash"]

    event = {
        "event_id": str(uuid.uuid4()),
        "evidence_id": evidence_id,
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "previous_event_hash": previous_hash
    }

    canonical_event = json.dumps(
        event, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")

    event["event_hash"] = calculate_sha256(canonical_event)

    with audit_file.open("a", encoding="utf-8") as file:
        file.write(json.dumps(event) + "\n")


def store_evidence(
    file_bytes: bytes,
    original_filename: str,
    content_type: str
) -> dict:
    """Encrypt and store an evidence file with a JSON manifest."""

    if not file_bytes:
        raise ValueError("Evidence file is empty.")

    if len(file_bytes) > 10 * 1024 * 1024:
        raise ValueError("Evidence file exceeds the 10 MB limit.")

    evidence_id = str(uuid.uuid4())
    original_hash = calculate_sha256(file_bytes)

    encrypted_data = encrypt_bytes(file_bytes)

    encrypted_path = ORIGINALS_DIR / f"{evidence_id}.enc"
    temporary_path = ORIGINALS_DIR / f"{evidence_id}.tmp"

    try:
        temporary_path.write_bytes(encrypted_data)
        temporary_path.replace(encrypted_path)

        manifest = {
            "evidence_id": evidence_id,
            "original_filename": Path(original_filename).name,
            "content_type": content_type,
            "file_size_bytes": len(file_bytes),
            "original_sha256": original_hash,
            "storage_filename": f"{evidence_id}.enc",
            "encryption": "Fernet",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "stored"
        }

        manifest_path = MANIFESTS_DIR / f"{evidence_id}.json"
        manifest_path.write_text(
            json.dumps(manifest, indent=4),
            encoding="utf-8"
        )

        record_audit_event("EVIDENCE_STORED", evidence_id)

        return manifest

    except Exception:
        encrypted_path.unlink(missing_ok=True)
        temporary_path.unlink(missing_ok=True)
        raise


def verify_evidence(evidence_id: str) -> dict:
    """Decrypt evidence and compare its hash with the manifest."""

    if not evidence_id or Path(evidence_id).name != evidence_id:
        raise ValueError("Invalid evidence ID.")

    manifest_path = MANIFESTS_DIR / f"{evidence_id}.json"
    encrypted_path = ORIGINALS_DIR / f"{evidence_id}.enc"

    if not manifest_path.is_file() or not encrypted_path.is_file():
        raise FileNotFoundError("Evidence record not found.")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if manifest.get("evidence_id") != evidence_id:
        raise ValueError("Evidence manifest ID mismatch.")

    decrypted_data = decrypt_bytes(encrypted_path.read_bytes())
    calculated_hash = calculate_sha256(decrypted_data)

    verified = calculated_hash == manifest["original_sha256"]

    record_audit_event(
        "EVIDENCE_VERIFIED" if verified else "EVIDENCE_VERIFICATION_FAILED",
        evidence_id
    )

    return {
        "evidence_id": evidence_id,
        "integrity_verified": verified,
        "original_sha256": manifest["original_sha256"],
        "calculated_sha256": calculated_hash
    }

def get_verified_evidence_bytes(evidence_id: str) -> bytes:
    """
    Retrieve decrypted evidence only after verifying its SHA-256 hash.
    The encrypted original remains unchanged on disk.
    """

    if not evidence_id or Path(evidence_id).name != evidence_id:
        raise ValueError("Invalid evidence ID.")

    manifest_path = MANIFESTS_DIR / f"{evidence_id}.json"
    encrypted_path = ORIGINALS_DIR / f"{evidence_id}.enc"

    if not manifest_path.is_file() or not encrypted_path.is_file():
        raise FileNotFoundError("Evidence record not found.")

    try:
        manifest = json.loads(
            manifest_path.read_text(encoding="utf-8")
        )
    except json.JSONDecodeError:
        raise ValueError("Evidence manifest is invalid.")

    if manifest.get("evidence_id") != evidence_id:
        raise ValueError("Evidence manifest ID mismatch.")

    decrypted_data = decrypt_bytes(encrypted_path.read_bytes())

    calculated_hash = calculate_sha256(decrypted_data)

    if calculated_hash != manifest.get("original_sha256"):
        record_audit_event("IMAGE_INDEX_INTEGRITY_FAILED", evidence_id)
        raise ValueError("Evidence integrity verification failed.")

    record_audit_event("EVIDENCE_READ_FOR_IMAGE_INDEX", evidence_id)

    return decrypted_data

def list_stored_evidence() -> list[dict]:
    """Return metadata for all stored evidence manifests."""

    evidence_records = []

    for manifest_path in MANIFESTS_DIR.glob("*.json"):
        try:
            manifest = json.loads(
                manifest_path.read_text(encoding="utf-8")
            )

            evidence_id = manifest.get("evidence_id")

            # Include only valid records with a corresponding encrypted file.
            if (
                not isinstance(evidence_id, str)
                or not evidence_id
                or Path(evidence_id).name != evidence_id
                or manifest_path.stem != evidence_id
            ):
                continue

            encrypted_path = ORIGINALS_DIR / f"{evidence_id}.enc"

            if not encrypted_path.is_file():
                continue

            evidence_records.append(manifest)

        except (json.JSONDecodeError, OSError):
            # Skip unreadable or invalid manifests.
            continue

    evidence_records.sort(
        key=lambda record: record.get("created_at", ""),
        reverse=True
    )

    return evidence_records
