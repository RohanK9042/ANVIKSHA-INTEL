
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from modules.osint.schemas import SearchSource


@dataclass
class ProviderResult:
    success: bool
    provider_name: str
    source_type: SearchSource
    results: list[dict] = field(default_factory=list)
    error_message: Optional[str] = None


class ExternalSearchProvider(ABC):
    """
    Common interface for authorised external intelligence providers.

    Each provider must implement its own API integration.
    This base class does not scrape websites or fabricate results.
    """

    provider_name: str
    supported_source: SearchSource

    @abstractmethod
    async def search_by_image(
        self,
        image_bytes: bytes,
        filename: str
    ) -> ProviderResult:
        """Search using an image, if supported by the provider."""
        raise NotImplementedError

    @abstractmethod
    async def search_by_text(
        self,
        query: str
    ) -> ProviderResult:
        """Search using a text query, if supported by the provider."""
        raise NotImplementedError

    @abstractmethod
    def is_configured(self) -> bool:
        """Return whether the provider has valid configuration."""
        raise NotImplementedError


class ProviderRegistry:
    """
    Maintains the external providers available to AEGIS INTEL.
    """

    def __init__(self):
        self._providers: dict[str, ExternalSearchProvider] = {}

    def register(self, provider: ExternalSearchProvider) -> None:
        if not provider.provider_name:
            raise ValueError("Provider name cannot be empty.")

        self._providers[provider.provider_name] = provider

    def get(self, provider_name: str) -> Optional[ExternalSearchProvider]:
        return self._providers.get(provider_name)

    def get_all(self) -> list[ExternalSearchProvider]:
        return list(self._providers.values())

    def get_configured(self) -> list[ExternalSearchProvider]:
        return [
            provider
            for provider in self._providers.values()
            if provider.is_configured()
        ]

    def get_provider_status(self) -> list[dict]:
        return [
            {
                "provider": provider.provider_name,
                "source": provider.supported_source.value,
                "configured": provider.is_configured(),
            }
            for provider in self._providers.values()
        ]
