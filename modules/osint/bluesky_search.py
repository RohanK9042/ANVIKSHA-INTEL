
import httpx
from datetime import datetime, timezone


class BlueskySearchProvider:
    """Search publicly available Bluesky profiles."""

    provider_name = "Bluesky"

    API_URL = (
        "https://public.api.bsky.app/"
        "xrpc/app.bsky.actor.searchActors"
    )

    async def search_profiles(
        self,
        query: str,
        limit: int = 10
    ) -> dict:

        query = query.strip()

        if not query or len(query) > 200:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": "Enter a valid name or username.",
                "results": [],
            }

        params = {
            "q": query,
            "limit": min(max(limit, 1), 25),
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    self.API_URL,
                    params=params,
                    headers={
                        "User-Agent": "AEGIS-INTEL/1.0"
                    },
                )

                response.raise_for_status()
                data = response.json()

            results = []

            for account in data.get("actors", []):
                results.append({
                    "display_name": account.get("displayName"),
                    "handle": account.get("handle"),
                    "profile_url": (
                        "https://bsky.app/profile/"
                        + account.get("handle", "")
                    ),
                    "description": account.get("description", ""),
                    "avatar": account.get("avatar"),
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
                    "Bluesky HTTP error: "
                    f"{error.response.status_code}"
                ),
                "results": [],
            }

        except httpx.RequestError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Bluesky connection error: {str(error)}",
                "results": [],
            }

        except ValueError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Invalid Bluesky response: {str(error)}",
                "results": [],
            }
