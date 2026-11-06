
import sqlite3
import uuid
import json
import hashlib

from pathlib import Path
from datetime import datetime, timezone


from backend.core.storage import CASES_DIR

DATABASE_DIR = CASES_DIR
DATABASE_PATH = DATABASE_DIR / "aegis_cases.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    """Create the investigation database tables if they do not exist."""

    with get_connection() as connection:

        connection.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                internal_id TEXT PRIMARY KEY,
                case_id TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS case_activity (
                activity_id TEXT PRIMARY KEY,
                internal_case_id TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                description TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (internal_case_id)
                    REFERENCES cases(internal_id)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS case_evidence (
                link_id TEXT PRIMARY KEY,
                internal_case_id TEXT NOT NULL,
                evidence_id TEXT NOT NULL,
                linked_at TEXT NOT NULL,

                UNIQUE(internal_case_id, evidence_id),

                FOREIGN KEY (internal_case_id)
                    REFERENCES cases(internal_id)
            )
        """)

        # New table for persisted facial-analysis reports
        connection.execute("""
            CREATE TABLE IF NOT EXISTS case_face_reports (
                report_id TEXT PRIMARY KEY,
                internal_case_id TEXT NOT NULL,
                evidence_id TEXT NOT NULL,
                model_name TEXT,
                analysis_json TEXT NOT NULL,
                report_sha256 TEXT NOT NULL,
                created_at TEXT NOT NULL,

                FOREIGN KEY (internal_case_id)
                    REFERENCES cases(internal_id)
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_face_reports_case
            ON case_face_reports(internal_case_id)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_face_reports_evidence
            ON case_face_reports(evidence_id)
        """)


def create_case(
    title: str,
    description: str = "",
    priority: str = "MEDIUM"
) -> dict:

    allowed_priorities = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    if not title or not title.strip():
        raise ValueError("Case title is required.")

    if priority not in allowed_priorities:
        raise ValueError("Invalid case priority.")

    initialize_database()

    internal_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:

        connection.execute("""
            INSERT INTO cases (
                internal_id, case_id, title, description,
                status, priority, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            internal_id,
            "PENDING",
            title.strip(),
            description.strip(),
            "OPEN",
            priority,
            timestamp,
            timestamp
        ))

        sequence = connection.execute(
            "SELECT last_insert_rowid()"
        ).fetchone()[0]

        case_id = (
            f"AEGIS-{datetime.now(timezone.utc).year}-{sequence:05d}"
        )

        connection.execute("""
            UPDATE cases SET case_id = ?
            WHERE internal_id = ?
        """, (case_id, internal_id))

        connection.execute("""
            INSERT INTO case_activity (
                activity_id, internal_case_id,
                activity_type, description, timestamp
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            internal_id,
            "CASE_CREATED",
            "Investigation case created.",
            timestamp
        ))

        row = connection.execute(
            "SELECT * FROM cases WHERE internal_id = ?",
            (internal_id,)
        ).fetchone()

        return dict(row)


def list_cases():
    initialize_database()

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT * FROM cases
            ORDER BY created_at DESC
        """).fetchall()

        return [dict(row) for row in rows]


def get_case(case_id: str):
    initialize_database()

    with get_connection() as connection:
        row = connection.execute("""
            SELECT * FROM cases
            WHERE case_id = ?
        """, (case_id,)).fetchone()

        return dict(row) if row else None


def link_evidence_to_case(
    case_id: str,
    evidence_id: str
) -> dict:
    """Associate an existing encrypted evidence record with a case."""

    from backend.services.evidence_manager import (
        ORIGINALS_DIR,
        MANIFESTS_DIR,
        record_audit_event
    )

    initialize_database()

    manifest_path = MANIFESTS_DIR / f"{evidence_id}.json"
    encrypted_path = ORIGINALS_DIR / f"{evidence_id}.enc"

    if not manifest_path.is_file() or not encrypted_path.is_file():
        raise FileNotFoundError("Evidence record not found.")

    manifest = json.loads(
        manifest_path.read_text(encoding="utf-8")
    )

    if manifest.get("evidence_id") != evidence_id:
        raise ValueError("Evidence manifest ID mismatch.")

    with get_connection() as connection:

        case = connection.execute(
            "SELECT internal_id FROM cases WHERE case_id = ?",
            (case_id,)
        ).fetchone()

        if not case:
            raise FileNotFoundError("Investigation case not found.")

        internal_case_id = case["internal_id"]

        existing = connection.execute("""
            SELECT link_id FROM case_evidence
            WHERE internal_case_id = ?
            AND evidence_id = ?
        """, (internal_case_id, evidence_id)).fetchone()

        if existing:
            raise ValueError("Evidence is already linked to this case.")

        timestamp = datetime.now(timezone.utc).isoformat()
        link_id = str(uuid.uuid4())

        connection.execute("""
            INSERT INTO case_evidence (
                link_id, internal_case_id, evidence_id, linked_at
            )
            VALUES (?, ?, ?, ?)
        """, (link_id, internal_case_id, evidence_id, timestamp))

        connection.execute("""
            UPDATE cases SET updated_at = ?
            WHERE internal_id = ?
        """, (timestamp, internal_case_id))

        connection.execute("""
            INSERT INTO case_activity (
                activity_id, internal_case_id,
                activity_type, description, timestamp
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            internal_case_id,
            "EVIDENCE_LINKED",
            f"Evidence {evidence_id} linked to case {case_id}.",
            timestamp
        ))

    record_audit_event("EVIDENCE_LINKED_TO_CASE", evidence_id)

    return {
        "link_id": link_id,
        "case_id": case_id,
        "evidence_id": evidence_id,
        "linked_at": timestamp,
        "status": "linked"
    }


def list_case_evidence(case_id: str) -> list:
    """Retrieve all evidence associated with an investigation."""

    initialize_database()

    with get_connection() as connection:

        case = connection.execute(
            "SELECT internal_id FROM cases WHERE case_id = ?",
            (case_id,)
        ).fetchone()

        if not case:
            raise FileNotFoundError("Investigation case not found.")

        rows = connection.execute("""
            SELECT evidence_id, linked_at
            FROM case_evidence
            WHERE internal_case_id = ?
            ORDER BY linked_at DESC
        """, (case["internal_id"],)).fetchall()

        return [dict(row) for row in rows]


def list_case_activity(case_id: str) -> list:
    """Retrieve the chronological activity history of a case."""

    initialize_database()

    with get_connection() as connection:

        case = connection.execute(
            "SELECT internal_id FROM cases WHERE case_id = ?",
            (case_id,)
        ).fetchone()

        if not case:
            raise FileNotFoundError("Investigation case not found.")

        rows = connection.execute("""
            SELECT
                activity_id,
                activity_type,
                description,
                timestamp
            FROM case_activity
            WHERE internal_case_id = ?
            ORDER BY timestamp ASC, activity_id ASC
        """, (case["internal_id"],)).fetchall()

        return [dict(row) for row in rows]


# ============================================================
# FACIAL ANALYSIS REPORT PERSISTENCE
# ============================================================

def save_face_analysis_report(
    case_id: str,
    evidence_id: str,
    analysis: dict
) -> dict:
    """
    Save a structured facial-analysis report against an
    existing investigation and linked evidence record.

    The original image is never modified.

    The large Base64 annotated image is deliberately excluded
    from this JSON report. The report stores analytical data,
    not a duplicate image.
    """

    if not isinstance(analysis, dict):
        raise ValueError("Analysis must be a valid dictionary.")

    if not case_id or not evidence_id:
        raise ValueError("Case ID and evidence ID are required.")

    # Remove the Base64 image from the report.
    # Preserve the remaining analysis information.
    report_data = json.loads(json.dumps(analysis))

    visualisation = report_data.get("visualisation")

    if isinstance(visualisation, dict):
        visualisation.pop("image", None)

    # Serialize consistently so that a report hash can be calculated.
    analysis_json = json.dumps(
        report_data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False
    )

    report_sha256 = hashlib.sha256(
        analysis_json.encode("utf-8")
    ).hexdigest()

    face_analysis = report_data.get("face_analysis", {})
    model_name = face_analysis.get("model", "Unknown model")

    initialize_database()

    with get_connection() as connection:

        case = connection.execute("""
            SELECT internal_id
            FROM cases
            WHERE case_id = ?
        """, (case_id,)).fetchone()

        if not case:
            raise FileNotFoundError("Investigation case not found.")

        internal_case_id = case["internal_id"]

        # Require the evidence to be linked to this case first.
        evidence_link = connection.execute("""
            SELECT link_id
            FROM case_evidence
            WHERE internal_case_id = ?
            AND evidence_id = ?
        """, (internal_case_id, evidence_id)).fetchone()

        if not evidence_link:
            raise ValueError(
                "Evidence must be linked to the case before "
                "saving its analysis report."
            )

        report_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        connection.execute("""
            INSERT INTO case_face_reports (
                report_id,
                internal_case_id,
                evidence_id,
                model_name,
                analysis_json,
                report_sha256,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            report_id,
            internal_case_id,
            evidence_id,
            model_name,
            analysis_json,
            report_sha256,
            timestamp
        ))

        connection.execute("""
            UPDATE cases SET updated_at = ?
            WHERE internal_id = ?
        """, (timestamp, internal_case_id))

        connection.execute("""
            INSERT INTO case_activity (
                activity_id,
                internal_case_id,
                activity_type,
                description,
                timestamp
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            internal_case_id,
            "FACE_ANALYSIS_SAVED",
            f"Facial-analysis report {report_id} saved "
            f"for evidence {evidence_id}.",
            timestamp
        ))

        return {
            "report_id": report_id,
            "case_id": case_id,
            "evidence_id": evidence_id,
            "model_name": model_name,
            "report_sha256": report_sha256,
            "created_at": timestamp,
            "status": "saved",
            "analysis": report_data
        }


def list_face_analysis_reports(case_id: str) -> list:
    """List facial-analysis reports belonging to a case."""

    initialize_database()

    with get_connection() as connection:

        case = connection.execute("""
            SELECT internal_id
            FROM cases
            WHERE case_id = ?
        """, (case_id,)).fetchone()

        if not case:
            raise FileNotFoundError("Investigation case not found.")

        rows = connection.execute("""
            SELECT
                report_id,
                evidence_id,
                model_name,
                report_sha256,
                created_at
            FROM case_face_reports
            WHERE internal_case_id = ?
            ORDER BY created_at DESC
        """, (case["internal_id"],)).fetchall()

        return [dict(row) for row in rows]


def get_face_analysis_report(report_id: str) -> dict:
    """Retrieve a complete saved facial-analysis report."""

    initialize_database()

    with get_connection() as connection:

        row = connection.execute("""
            SELECT
                r.report_id,
                c.case_id,
                r.evidence_id,
                r.model_name,
                r.analysis_json,
                r.report_sha256,
                r.created_at
            FROM case_face_reports r
            JOIN cases c
                ON c.internal_id = r.internal_case_id
            WHERE r.report_id = ?
        """, (report_id,)).fetchone()

        if not row:
            raise FileNotFoundError(
                "Facial-analysis report not found."
            )

        result = dict(row)

        result["analysis"] = json.loads(
            result.pop("analysis_json")
        )

        return result
