
from fastapi import FastAPI
from datetime import datetime, timezone
from fastapi import UploadFile, File, HTTPException
from backend.services.image_forensics import analyse_image
from backend.services.face_intelligence import analyse_faces
from fastapi.middleware.cors import CORSMiddleware
from backend.api.osint import router as osint_router
from backend.api.image_index import router as image_index_router

from backend.services.evidence_manager import (
    store_evidence,
    verify_evidence,
    list_stored_evidence,
)
from backend.services.case_manager import (
    create_case,
    list_cases,
    get_case,
    link_evidence_to_case,
    list_case_evidence,
    list_case_activity,
    save_face_analysis_report,
    list_face_analysis_reports,
    get_face_analysis_report
)


app = FastAPI(
    title="AEGIS INTEL",
    description=(
        "AI-Powered Law Enforcement Intelligence "
        "and Digital Investigation Platform"
    ),
    version="0.1.0"
)
app.include_router(osint_router)
app.include_router(image_index_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

@app.get("/")
async def root():
    return {
        "product": "AEGIS INTEL",
        "version": "0.1.0",
        "status": "operational",
        "message": "Intelligence platform backend initialized."
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "aegis-backend",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/system/info")
async def system_info():
    return {
        "platform": "AEGIS INTEL",
        "architecture": "Modular Intelligence Platform",
        "modules": [
            "Image Forensics",
            "Biometric Verification",
            "OSINT Research",
            "Intelligence Correlation",
            "Case Management",
            "Evidence Management",
            "Report Generation"
        ],
        "environment": "development"
    }

@app.post("/api/v1/image/analyse")
async def analyse_uploaded_image(
    file: UploadFile = File(...)
):
    try:
        image_bytes = await file.read()

        result = analyse_image(image_bytes)

        return {
            "status": "analysis_completed",
            "filename": file.filename,
            "analysis": result
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    finally:
        await file.close()

@app.post("/api/v1/face-intelligence/analyse")
async def analyse_face_intelligence(
    file: UploadFile = File(...)
):
    try:
        # Read at most 10 MB plus one byte.
        file_bytes = await file.read(
            10 * 1024 * 1024 + 1
        )

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="No image was uploaded."
            )

        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Image exceeds the 10 MB limit."
            )

        result = analyse_faces(file_bytes)

        return {
            "status": "analysis_completed",
            "filename": file.filename or "uploaded_image",
            "analysis": result
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError:
        raise HTTPException(
            status_code=500,
            detail="Face analysis model or processing service failed."
        )

    finally:
        await file.close()


@app.post("/api/v1/evidence/ingest")
async def ingest_evidence(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()

        # Reuse the existing image analysis validation
        analyse_image(file_bytes)

        manifest = store_evidence(
            file_bytes=file_bytes,
            original_filename=file.filename or "uploaded_image",
            content_type=file.content_type or "application/octet-stream"
        )

        return {
            "status": "evidence_stored",
            "message": "Evidence encrypted and stored successfully.",
            "manifest": manifest
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    finally:
        await file.close()

@app.get("/api/v1/evidence")
async def get_all_stored_evidence():
    evidence = list_stored_evidence()

    return {
        "total": len(evidence),
        "evidence": evidence
    }


@app.get("/api/v1/evidence/{evidence_id}/manifest")
async def get_evidence_manifest(evidence_id: str):
    from pathlib import Path
    import json

    manifest_path = (
        Path(__file__).resolve().parents[1]
        / "storage" / "evidence" / "manifests"
        / f"{evidence_id}.json"
    )

    if not manifest_path.is_file():
        raise HTTPException(status_code=404, detail="Evidence not found.")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("evidence_id") != evidence_id:
            raise HTTPException(status_code=404, detail="Evidence not found.")
        return manifest
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Evidence manifest is invalid.")


@app.get("/api/v1/evidence/{evidence_id}/verify")
async def verify_stored_evidence(evidence_id: str):
    try:
        return verify_evidence(evidence_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception:
        raise HTTPException(status_code=500, detail="Evidence verification failed.")


from pydantic import BaseModel, Field


class CaseCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=5000)
    priority: str = "MEDIUM"
class FaceAnalysisReportRequest(BaseModel):
    evidence_id: str = Field(min_length=1)
    analysis: dict

@app.post("/api/v1/cases")
async def create_investigation_case(request: CaseCreateRequest):
    try:
        return {
            "status": "case_created",
            "case": create_case(
                title=request.title,
                description=request.description,
                priority=request.priority.upper()
            )
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/api/v1/cases")
async def get_all_cases():
    return {
        "total": len(list_cases()),
        "cases": list_cases()
    }


@app.get("/api/v1/cases/{case_id}")
async def get_investigation_case(case_id: str):
    case = get_case(case_id)

    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    return case


@app.post("/api/v1/cases/{case_id}/evidence")
async def attach_evidence(case_id: str, evidence_id: str):
    try:
        result = link_evidence_to_case(case_id, evidence_id)

        return {
            "status": "success",
            "message": "Evidence linked to investigation successfully.",
            "result": result
        }

    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))

    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@app.get("/api/v1/cases/{case_id}/evidence")
async def get_case_evidence(case_id: str):
    try:
        evidence = list_case_evidence(case_id)

        return {
            "case_id": case_id,
            "total_evidence": len(evidence),
            "evidence": evidence
        }

    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.get("/api/v1/cases/{case_id}/activity")
async def get_case_activity(case_id: str):
    try:
        activities = list_case_activity(case_id)

        return {
            "case_id": case_id,
            "total_activities": len(activities),
            "activities": activities
        }

    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))

# ============================================================
# FACIAL ANALYSIS REPORT API
# ============================================================

@app.post("/api/v1/cases/{case_id}/face-reports")
async def save_case_face_report(
    case_id: str,
    request: FaceAnalysisReportRequest
):
    try:
        result = save_face_analysis_report(
            case_id=case_id,
            evidence_id=request.evidence_id,
            analysis=request.analysis
        )

        return {
            "status": "success",
            "message": "Facial-analysis report saved successfully.",
            "report": result
        }

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.get("/api/v1/cases/{case_id}/face-reports")
async def get_case_face_reports(case_id: str):
    try:
        reports = list_face_analysis_reports(case_id)

        return {
            "case_id": case_id,
            "total_reports": len(reports),
            "reports": reports
        }

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )


@app.get("/api/v1/face-reports/{report_id}")
async def get_single_face_report(report_id: str):
    try:
        return get_face_analysis_report(report_id)

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )
