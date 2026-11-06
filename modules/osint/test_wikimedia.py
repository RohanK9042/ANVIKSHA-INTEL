
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from modules.osint.wikimedia_search import WikimediaSearchProvider


async def main():
    provider = WikimediaSearchProvider()

    print("\n========== WIKIPEDIA ARTICLE SEARCH ==========")

    articles = await provider.search_articles("Mumbai")

    print("Success:", articles["success"])
    print("Error:", articles.get("error", "No error returned"))
    print("Results:", articles.get("result_count", 0))

    for item in articles.get("results", [])[:3]:
        print("\nTitle:", item["title"])
        print("URL:", item["url"])

    print("\n========== WIKIMEDIA IMAGE SEARCH ==========")

    images = await provider.search_images("Mumbai")

    print("Success:", images["success"])
    print("Error:", images.get("error", "No error returned"))
    print("Results:", images.get("result_count", 0))

    for item in images.get("results", [])[:3]:
        print("\nTitle:", item["title"])
        print("Image URL:", item["image_url"])
        print("Source:", item["source_page"])
        print("Licence:", item["license"])


if __name__ == "__main__":
    asyncio.run(main())
