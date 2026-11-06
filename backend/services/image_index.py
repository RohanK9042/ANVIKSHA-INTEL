
import io
import sqlite3

from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.services.evidence_manager import (
    get_verified_evidence_bytes,
)

from backend.services.image_forensics import (
    calculate_perceptual_hash,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]

INDEX_DIR = PROJECT_ROOT / "storage" / "image_index"
DATABASE_PATH = INDEX_DIR / "images.db"

INDEX_DIR.mkdir(parents=True, exist_ok=True)


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialise_index():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS image_index (
                evidence_id TEXT PRIMARY KEY,
                perceptual_hash TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                indexed_at TEXT NOT NULL
            )
        """)

        connection.commit()


def calculate_image_fingerprint(image_bytes: bytes) -> dict:
    """Calculate a whole-image perceptual fingerprint."""

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("RGB")
    except (
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
    ):
        raise ValueError("Unsupported or invalid image.")

    if image.width * image.height > 25_000_000:
        raise ValueError("Image exceeds processing limits.")

    image_array = np.array(image)

    gray = cv2.cvtColor(
        image_array,
        cv2.COLOR_RGB2GRAY,
    )

    fingerprint = calculate_perceptual_hash(gray)

    return {
        "perceptual_hash": fingerprint,
        "width": image.width,
        "height": image.height,
    }


def index_evidence(evidence_id: str) -> dict:
    """Add verified evidence to the investigator-managed image index."""

    image_bytes = get_verified_evidence_bytes(evidence_id)

    fingerprint = calculate_image_fingerprint(image_bytes)

    indexed_at = datetime.now(timezone.utc).isoformat()

    initialise_index()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO image_index (
                evidence_id,
                perceptual_hash,
                width,
                height,
                indexed_at
            )
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(evidence_id)
            DO UPDATE SET
                perceptual_hash = excluded.perceptual_hash,
                width = excluded.width,
                height = excluded.height,
                indexed_at = excluded.indexed_at
            """,
            (
                evidence_id,
                fingerprint["perceptual_hash"],
                fingerprint["width"],
                fingerprint["height"],
                indexed_at,
            ),
        )

        connection.commit()

    return {
        "status": "indexed",
        "evidence_id": evidence_id,
        "indexed_at": indexed_at,
        "fingerprint_method": "64-bit whole-image DCT perceptual hash",
    }


def calculate_hash_distance(hash_a: str, hash_b: str) -> int:
    """Calculate the Hamming distance between two 64-bit hashes."""

    return (
        int(hash_a, 16) ^ int(hash_b, 16)
    ).bit_count()


def search_similar_images(
    evidence_id: str,
    limit: int = 10,
) -> dict:
    """Find visually similar whole images in the local index."""

    if limit < 1 or limit > 50:
        raise ValueError("Limit must be between 1 and 50.")

    # Always retrieve and verify the original evidence first.
    image_bytes = get_verified_evidence_bytes(evidence_id)

    query_fingerprint = calculate_image_fingerprint(image_bytes)

    initialise_index()

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT evidence_id, perceptual_hash, width,
                   height, indexed_at
            FROM image_index
            WHERE evidence_id != ?
            """,
            (evidence_id,),
        ).fetchall()

    matches = []

    for row in rows:
        distance = calculate_hash_distance(
            query_fingerprint["perceptual_hash"],
            row["perceptual_hash"],
        )

        similarity = max(
            0.0,
            1.0 - (distance / 64.0),
        )

        matches.append({
            "evidence_id": row["evidence_id"],
            "similarity_score": round(similarity * 100, 2),
            "hash_distance": distance,
            "indexed_width": row["width"],
            "indexed_height": row["height"],
            "indexed_at": row["indexed_at"],
            "match_method": "Whole-image perceptual hash",
        })

    matches.sort(
        key=lambda item: item["similarity_score"],
        reverse=True,
    )

    return {
        "status": "search_completed",
        "query_evidence_id": evidence_id,
        "provider": "AEGIS Local Image Index",
        "total_indexed_images": len(rows),
        "result_count": min(limit, len(matches)),
        "results": matches[:limit],
        "limitations": [
            "Search covers only images explicitly added to this local index.",
            "Perceptual similarity is not facial identity matching.",
            "Scores are technical hash-similarity indicators, not probabilities.",
            "Different crops or substantially modified images may not match.",
            "A similar score does not establish that two images depict the same person.",
        ],
    }


initialise_index()
