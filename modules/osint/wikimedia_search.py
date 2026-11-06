
import httpx
from datetime import datetime, timezone


class WikimediaSearchProvider:
    """Search public Wikipedia articles and Wikimedia Commons images."""

    provider_name = "Wikimedia"

    API_URL = "https://en.wikipedia.org/w/api.php"
    COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"

    HEADERS = {
    "User-Agent": "AEGIS-INTEL/1.0 (contact:rokk9042@gmail.com)"
}

    async def search_articles(self, query: str, limit: int = 10) -> dict:
        query = query.strip()

        if not query or len(query) > 300:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": "Enter a valid search query.",
                "results": [],
            }

        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": min(max(limit, 1), 20),
            "format": "json",
            "utf8": 1,
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

            for item in data.get("query", {}).get("search", []):
                page_id = item.get("pageid")

                results.append({
                    "title": item.get("title"),
                    "url": (
                        f"https://en.wikipedia.org/?curid={page_id}"
                        if page_id else None
                    ),
                    "description": item.get("snippet", ""),
                    "page_id": page_id,
                    "source": self.provider_name,
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                })

            return {
                "success": True,
                "provider": self.provider_name,
                "result_count": len(results),
                "results": results,
            }

        except httpx.HTTPStatusError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Wikipedia HTTP error: {error.response.status_code}",
                "results": [],
            }

        except httpx.RequestError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Wikipedia connection error: {str(error)}",
                "results": [],
            }

        except ValueError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Invalid response: {str(error)}",
                "results": [],
            }

    async def search_images(self, query: str, limit: int = 10) -> dict:
        query = query.strip()

        if not query or len(query) > 300:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": "Enter a valid image search query.",
                "results": [],
            }

        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "gsrnamespace": 6,
            "gsrlimit": min(max(limit, 1), 20),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": 600,
            "format": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    self.COMMONS_API_URL,
                    params=params,
                    headers=self.HEADERS,
                )
                response.raise_for_status()
                data = response.json()

            pages = data.get("query", {}).get("pages", {})
            results = []

            for page in pages.values():
                image_info = page.get("imageinfo", [{}])[0]
                metadata = image_info.get("extmetadata", {})

                results.append({
                    "title": page.get("title"),
                    "image_url": (
                        image_info.get("thumburl")
                        or image_info.get("url")
                    ),
                    "original_url": image_info.get("url"),
                    "source_page": (
                        "https://commons.wikimedia.org/wiki/"
                        + page.get("title", "").replace(" ", "_")
                    ),
                    "license": metadata.get(
                        "LicenseShortName", {}
                    ).get("value"),
                    "artist": metadata.get("Artist", {}).get("value"),
                    "source": self.provider_name,
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                })

            return {
                "success": True,
                "provider": self.provider_name,
                "result_count": len(results),
                "results": results,
            }

        except httpx.HTTPStatusError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Wikimedia Commons HTTP error: {error.response.status_code}",
                "results": [],
            }

        except httpx.RequestError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Wikimedia Commons connection error: {str(error)}",
                "results": [],
            }

        except ValueError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Invalid response: {str(error)}",
                "results": [],
            }
