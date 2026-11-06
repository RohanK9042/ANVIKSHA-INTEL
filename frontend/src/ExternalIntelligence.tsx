
import { useState, type FormEvent } from "react";

import {
  searchWikipedia,
  searchWikimediaImages,
  searchBlueskyProfiles,
  searchMastodonProfiles,
  type WikipediaArticleResult,
  type WikimediaImageResult,
  type SocialProfileResult,
} from "./api";

type SearchTab = "all" | "articles" | "images" | "social";

function cleanSnippet(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function ExternalIntelligence() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");

  const [articles, setArticles] = useState<WikipediaArticleResult[]>([]);
  const [images, setImages] = useState<WikimediaImageResult[]>([]);
  const [socialProfiles, setSocialProfiles] =
    useState<SocialProfileResult[]>([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [completedSources, setCompletedSources] = useState<string[]>([]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const searchTerm = query.trim();

    if (!searchTerm) {
      setErrors(["Enter a search term first."]);
      return;
    }

    setLoading(true);
    setSearched(false);
    setErrors([]);
    setCompletedSources([]);

    setArticles([]);
    setImages([]);
    setSocialProfiles([]);

    const tasks = [
      {
        name: "Wikipedia",
        run: () => searchWikipedia(searchTerm, 10),
      },
      {
        name: "Wikimedia Commons",
        run: () => searchWikimediaImages(searchTerm, 10),
      },
      {
        name: "Bluesky",
        run: () => searchBlueskyProfiles(searchTerm, 10),
      },
      {
        name: "Mastodon",
        run: () => searchMastodonProfiles(searchTerm, 10),
      },
    ];

    try {
      const responses = await Promise.allSettled(
        tasks.map((task) => task.run())
      );

      const failures: string[] = [];
      const successful: string[] = [];

      responses.forEach((response, index) => {
        const sourceName = tasks[index].name;

        if (response.status === "rejected") {
          failures.push(
            `${sourceName}: ${
              response.reason instanceof Error
                ? response.reason.message
                : "Search failed."
            }`
          );
          return;
        }

        successful.push(sourceName);

        const data = response.value;

        if (sourceName === "Wikipedia") {
          setArticles(data.results as WikipediaArticleResult[]);
        }

        if (sourceName === "Wikimedia Commons") {
          setImages(data.results as WikimediaImageResult[]);
        }

        if (sourceName === "Bluesky" || sourceName === "Mastodon") {
          setSocialProfiles((previous) => [
            ...previous,
            ...(data.results as SocialProfileResult[]),
          ]);
        }
      });

      setErrors(failures);
      setCompletedSources(successful);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  const visibleArticles =
    activeTab === "all" || activeTab === "articles";

  const visibleImages =
    activeTab === "all" || activeTab === "images";

  const visibleSocial =
    activeTab === "all" || activeTab === "social";

  const totalResults =
    articles.length + images.length + socialProfiles.length;

  return (
    <section className="panel external-intelligence">

      <div className="panel-heading">
        <div>
          <h3>AEGIS INTEL — Unified Intelligence Search</h3>
          <p>
            Discover information from publicly accessible sources
          </p>
        </div>

        <span className="panel-label">OSINT RESEARCH</span>
      </div>

      <form className="external-search-form" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter a name, username, location, event or subject..."
          maxLength={200}
          aria-label="Intelligence search query"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Searching sources..." : "Search Intelligence"}
        </button>
      </form>

      <p className="external-disclaimer">
        Searches public articles, openly accessible images and
        searchable public social profiles. Results are investigative
        leads, not proof of identity or wrongdoing. Independently
        verify information before relying on it.
      </p>

      {loading && (
        <p className="muted">
          Contacting public-source providers. This may take a few moments...
        </p>
      )}

      {errors.length > 0 && (
        <div className="error-message">
          <strong>Some providers could not be reached:</strong>
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}

      {searched && (
        <>
          <div className="external-search-summary">
            <h4>Search Results</h4>

            <p>
              {totalResults} results found for "{query}"
            </p>

            <p>
              Successful providers:{" "}
              {completedSources.length
                ? completedSources.join(", ")
                : "None"}
            </p>
          </div>

          <div className="external-search-tabs">
            {(
              [
                ["all", "All Sources"],
                ["articles", "Articles"],
                ["images", "Images"],
                ["social", "Social Profiles"],
              ] as [SearchTab, string][]
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={
                  activeTab === tab
                    ? "external-tab active"
                    : "external-tab"
                }
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleArticles && (
            <div className="external-result-section">
              <div className="external-results-heading">
                <h4>Wikipedia Articles</h4>
                <span>{articles.length} results</span>
              </div>

              {articles.length === 0 ? (
                <p className="muted">No articles found.</p>
              ) : (
                <div className="external-article-list">
                  {articles.map((article, index) => (
                    <article
                      className="external-article-card"
                      key={article.page_id ?? index}
                    >
                      <h4>{article.title}</h4>

                      {article.description && (
                        <p>{cleanSnippet(article.description)}</p>
                      )}

                      {article.url && (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open Wikipedia source ↗
                        </a>
                      )}

                      <small>
                        Retrieved: {article.retrieved_at}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {visibleImages && (
            <div className="external-result-section">
              <div className="external-results-heading">
                <h4>Wikimedia Commons Images</h4>
                <span>{images.length} results</span>
              </div>

              {images.length === 0 ? (
                <p className="muted">No images found.</p>
              ) : (
                <div className="external-image-grid">
                  {images.map((image, index) => (
                    <article
                      className="external-image-card"
                      key={`${image.source_page}-${index}`}
                    >
                      {image.image_url && (
                        <a
                          href={image.source_page}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={image.image_url}
                            alt={image.title}
                            loading="lazy"
                          />
                        </a>
                      )}

                      <div className="external-image-info">
                        <strong>{image.title}</strong>

                        <p>Source: {image.source}</p>
                        <p>Licence: {image.license || "Not specified"}</p>

                        {image.artist && (
                          <p>Artist: {cleanSnippet(image.artist)}</p>
                        )}

                        <a
                          href={image.source_page}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View original source ↗
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {visibleSocial && (
            <div className="external-result-section">
              <div className="external-results-heading">
                <h4>Public Social Profiles</h4>
                <span>{socialProfiles.length} results</span>
              </div>

              {socialProfiles.length === 0 ? (
                <p className="muted">
                  No publicly searchable profiles found.
                </p>
              ) : (
                <div className="external-social-grid">
                  {socialProfiles.map((profile, index) => (
                    <article
                      className="external-social-card"
                      key={`${profile.source}-${profile.profile_url}-${index}`}
                    >
                      <div className="external-social-header">
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <div className="external-avatar-placeholder">
                            {profile.source.charAt(0)}
                          </div>
                        )}

                        <div>
                          <strong>
                            {profile.display_name ||
                              profile.handle ||
                              profile.username ||
                              "Public account"}
                          </strong>

                          <span>{profile.source}</span>
                        </div>
                      </div>

                      {profile.handle && (
                        <p>@{profile.handle}</p>
                      )}

                      {profile.account && (
                        <p>@{profile.account}</p>
                      )}

                      {profile.description && (
                        <p className="external-profile-description">
                          {cleanSnippet(profile.description)}
                        </p>
                      )}

                      {profile.profile_url && (
                        <a
                          href={profile.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open public profile ↗
                        </a>
                      )}

                      <small>
                        Retrieved: {profile.retrieved_at}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="external-source-footer">
        Providers: Wikipedia · Wikimedia Commons · Bluesky · Mastodon
      </div>

    </section>
  );
}

export default ExternalIntelligence;
