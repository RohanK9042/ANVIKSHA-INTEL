
from fastapi import APIRouter, HTTPException, Query

from backend.services.image_index import (
    index_evidence as add_to_image_index,
    search_similar_images,
)

router = APIRouter(
    prefix="/api/v1/image-index",
    tags=["Image Intelligence"],
)


@router.post("/index/{evidence_id}")
async def add_evidence_to_index(evidence_id: str):
    try:
        return add_to_image_index(evidence_id)

    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to index evidence.",
        )


@router.get("/search/{evidence_id}")
async def search_image_index(
    evidence_id: str,
    limit: int = Query(default=10, ge=1, le=50),
):
    try:
        return search_similar_images(evidence_id, limit)

    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Image similarity search failed.",
        )
