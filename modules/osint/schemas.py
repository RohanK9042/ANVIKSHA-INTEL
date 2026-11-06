
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SearchSource(str, Enum):
    PUBLIC_WEB = "public_web"
    REVERSE_IMAGE = "reverse_image"
    PUBLIC_IMAGE = "public_image"
    SOCIAL_MEDIA = "social_media"
    AGENCY_DATABASE = "agency_database"


class SearchStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


class ExternalSearchRequest(BaseModel):
    evidence_id: str
    case_id: str
    sources: list[SearchSource] = Field(min_length=1)
    investigator_note: Optional[str] = Field(
        default=None,
        max_length=1000
    )
    confirm_authorisation: bool = False


class ExternalSearchResult(BaseModel):
    result_id: str
    provider: str
    source_type: SearchSource
    title: str
    source_url: Optional[str] = None
    discovered_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    similarity_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=1
    )
    description: Optional[str] = None
    provenance: str
    verified_by_investigator: bool = False


class ExternalSearchResponse(BaseModel):
    search_id: str
    case_id: str
    evidence_id: str
    status: SearchStatus
    results: list[ExternalSearchResult] = Field(default_factory=list)
    providers_attempted: list[str] = Field(default_factory=list)
    providers_failed: list[str] = Field(default_factory=list)
    message: str
