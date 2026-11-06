
import os
import httpx

from modules.osint.providers import (
    ExternalSearchProvider,
    ProviderResult,
)
from modules.osint.schemas import SearchSource


class BraveWebSearchProvider(ExternalSearchProvider):
    provider_name = "Brave Search"
    supported_source = SearchSource.PUBLIC_WEB

    API_URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self):
        self.api_key = os.getenv("BRAVE_SEARCH_API_KEY")

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def search_by_text(self, query: str) -> ProviderResult:
        if not self.is_configured():
            return ProviderResult(
                success=False,
                provider_name=self.provider_name,
                source_type=self.supported_source,
                error_message="Brave API key is not configured.",
            )

        query = query.strip()

        if not query or len(query) > 600:
            return ProviderResult(
                success=False,
                provider_name=self.provider_name,
                source_type=self.supported_source,
                error_message="Query must contain 1 to 600 characters.",
            )

        headers = {
            "Accept": "application/json",
            "X-Subscription-Token": self.api_key,
        }

        params = {
            "q": query,
            "count": 10,
            "country": "IN",
            "search_lang": "en",
            "safesearch": "moderate",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    self.API_URL,
                    headers=headers,
                    params=params,
                )

                response.raise_for_status()
                data = response.json()

            web_data = data.get("web") or {}
            raw_results = web_data.get("results") or []

            results = []

            for item in raw_results:
                url = item.get("url")

                if not url:
                    continue

                results.append({
                    "title": item.get("title", "Untitled result"),
                    "url": url,
                    "description": item.get("description", ""),
                    "provider": self.provider_name,
                    "source_type": self.supported_source.value,
                })

            return ProviderResult(
                success=True,
                provider_name=self.provider_name,
                source_type=self.supported_source,
                results=results,
            )

        except httpx.HTTPStatusError as error:
            return ProviderResult(
                success=False,
                provider_name=self.provider_name,
                source_type=self.supported_source,
                error_message=(
                    f"Search provider returned HTTP "
                    f"{error.response.status_code}."
                ),
            )

        except (httpx.RequestError, ValueError):
            return ProviderResult(
                success=False,
                provider_name=self.provider_name,
                source_type=self.supported_source,
                error_message="Unable to contact or parse the search provider.",
            )

    async def search_by_image(
        self,
        image_bytes: bytes,
        filename: str
    ) -> ProviderResult:
        return ProviderResult(
            success=False,
            provider_name=self.provider_name,
            source_type=self.supported_source,
            error_message=(
                "This provider integration supports text search only. "
                "Use a dedicated reverse-image search provider."
            ),
        )
