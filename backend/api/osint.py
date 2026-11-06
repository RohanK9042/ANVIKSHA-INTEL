
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from modules.osint.openverse_search import OpenverseSearchProvider
from modules.osint.bluesky_search import BlueskySearchProvider
from modules.osint.mastodon_search import MastodonSearchProvider

from modules.osint.wikimedia_search import WikimediaSearchProvider

router = APIRouter(
    prefix="/api/v1/osint",
    tags=["OSINT"],
)

wikimedia = WikimediaSearchProvider()
openverse = OpenverseSearchProvider()
bluesky = BlueskySearchProvider()
mastodon = MastodonSearchProvider()


class WikimediaSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    limit: int = Field(default=10, ge=1, le=20)


@router.post("/wikimedia/articles")
async def search_wikipedia(request: WikimediaSearchRequest):
    result = await wikimedia.search_articles(
        request.query,
        request.limit,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Wikipedia search failed."),
        )

    return result


@router.post("/wikimedia/images")
async def search_wikimedia_images(request: WikimediaSearchRequest):
    result = await wikimedia.search_images(
        request.query,
        request.limit,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Wikimedia image search failed."),
        )

    return result

class OpenverseSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=20)


@router.post("/openverse/images")
async def search_openverse_images(request: OpenverseSearchRequest):
    result = await openverse.search_images(
        request.query,
        request.limit,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Openverse search failed."),
        )

    return result

class BlueskySearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=25)


@router.post("/social/bluesky")
async def search_bluesky_profiles(request: BlueskySearchRequest):

    result = await bluesky.search_profiles(
        request.query,
        request.limit,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Bluesky search failed."),
        )

    return result

class MastodonSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=20)


@router.post("/social/mastodon")
async def search_mastodon_profiles(request: MastodonSearchRequest):

    result = await mastodon.search_profiles(
        request.query,
        request.limit,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Mastodon search failed."),
        )

    return result
