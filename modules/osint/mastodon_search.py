
import httpx
from datetime import datetime, timezone


class MastodonSearchProvider:
    """
    Search publicly discoverable Mastodon accounts.

    Searches one configured public Mastodon instance.
    Results do not represent every Mastodon server.
    """

    provider_name = "Mastodon"

    INSTANCE_URL = "https://mastodon.social"
    API_URL = f"{INSTANCE_URL}/api/v2/search"

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
            "type": "accounts",
            "limit": min(max(limit, 1), 20),
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

            for account in data.get("accounts", []):
                results.append({
                    "display_name": account.get("display_name"),
                    "username": account.get("username"),
                    "account": account.get("acct"),
                    "profile_url": account.get("url"),
                    "description": account.get("note", ""),
                    "avatar": account.get("avatar"),
                    "source": self.provider_name,
                    "instance": self.INSTANCE_URL,
                    "retrieved_at": datetime.now(
                        timezone.utc
                    ).isoformat(),
                })

            return {
                "success": True,
                "provider": self.provider_name,
                "instance": self.INSTANCE_URL,
                "query": query,
                "result_count": len(results),
                "results": results,
            }

        except httpx.HTTPStatusError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": (
                    "Mastodon HTTP error: "
                    f"{error.response.status_code}"
                ),
                "results": [],
            }

        except httpx.RequestError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Mastodon connection error: {str(error)}",
                "results": [],
            }

        except ValueError as error:
            return {
                "success": False,
                "provider": self.provider_name,
                "error": f"Invalid Mastodon response: {str(error)}",
                "results": [],
            }
