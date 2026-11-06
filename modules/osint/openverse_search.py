
import httpx
from datetime import datetime, timezone


class OpenverseSearchProvider:
    """
    Search openly licensed images through the official Openverse API.

    This provider performs text-based image discovery.
    It does not perform facial recognition or identity matching.
    """

    provider_name = "Openverse"

    API_URL = "https://api.openverse.org/v1/images/"

    HEADERS = {
        "User-Agent": "AEGIS-INTEL/1.0"
    }

    async def search_images(
        self,
        query: str,
        limit: int = 10
    ) -> dict:

        query = query.strip()

        if not query or len(query) > 200:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": "Enter a valid search query (maximum 200 characters).",
                "results": [],
            }

        params = {
            "q": query,
            "page_size": min(max(limit, 1), 20),
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    self.API_URL,
                    params=params,
                    headers=self.HEADERS,
                )

                response.raise_for_status()
                data = response.json()

            results = []

            for item in data.get("results", []):
                results.append({
                    "title": item.get("title"),
                    "image_url": item.get("url"),
                    "thumbnail_url": item.get("thumbnail"),
                    "creator": item.get("creator"),
                    "license": item.get("license"),
                    "license_version": item.get("license_version"),
                    "source_page": item.get("foreign_landing_url"),
                    "source": self.provider_name,
                    "retrieved_at": datetime.now(
                        timezone.utc
                    ).isoformat(),
                })

            return {
                "success": True,
                "provider": self.provider_name,
                "query": query,
                "result_count": len(results),
                "results": results,
            }

        except httpx.HTTPStatusError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": (
                    "Openverse HTTP error: "
                    f"{error.response.status_code}"
                ),
                "results": [],
            }

        except httpx.RequestError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Openverse connection error: {str(error)}",
                "results": [],
            }

        except ValueError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Invalid Openverse response: {str(error)}",
                "results": [],
            }
