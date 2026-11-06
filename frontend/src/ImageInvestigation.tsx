
import { useState } from "react";

import {
  analyseImage,
  ingestEvidence,
  linkEvidenceToCase,
  searchWikipedia,
  searchWikimediaImages,
  searchBlueskyProfiles,
  searchMastodonProfiles,
  indexEvidenceImage,
  searchSimilarEvidenceImages,
  type WikipediaArticleResult,
  type WikimediaImageResult,
  type ImageSimilarityResponse,
  type SocialProfileResult,
} from "./api";

interface Props {
  caseId: string;
  onComplete: () => void;
}

function cleanText(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
function getSearchTokens(query: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that",
    "this", "about", "into", "near", "was", "were",
    "are", "who", "what", "where"
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) => word.length >= 3 && !stopWords.has(word)
    );
}

function isRelevant(query: string, content: string): boolean {
  const tokens = getSearchTokens(query);

  if (tokens.length === 0 || !content) return false;

  const normalizedContent = cleanText(content)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const matchedTokens = tokens.filter((token) =>
    normalizedContent.includes(token)
  );

  const requiredMatches =
    tokens.length === 1
      ? 1
      : Math.max(2, Math.ceil(tokens.length * 0.6));

  return matchedTokens.length >= requiredMatches;
}
export default function ImageInvestigation({
  caseId,
  onComplete,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [evidenceId, setEvidenceId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [socialProfiles, setSocialProfiles] =
  useState<SocialProfileResult[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<WikipediaArticleResult[]>([]);
  const [images, setImages] = useState<WikimediaImageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchError, setSearchError] = useState("");

  const [indexed, setIndexed] = useState(false);
  const [indexBusy, setIndexBusy] = useState(false);
  const [indexMessage, setIndexMessage] = useState("");
  const [similarityResults, setSimilarityResults] =
    useState<ImageSimilarityResponse | null>(null);

  async function handleInvestigation() {
    if (!file) {
      setError("Please select an image first.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    setAnalysis(null);
    setEvidenceId("");
    setIndexed(false);
    setIndexMessage("");
    setSimilarityResults(null);

    let storedEvidenceId = "";

    try {
      setMessage("Step 1 of 3: Analysing image...");

      const analysisResult = await analyseImage(file);
      setAnalysis(analysisResult.analysis);

      setMessage("Step 2 of 3: Encrypting and storing evidence...");

      const storageResult = await ingestEvidence(file);
      storedEvidenceId = storageResult.manifest.evidence_id;
      setEvidenceId(storedEvidenceId);

      setMessage("Step 3 of 3: Linking evidence to case...");

      await linkEvidenceToCase(caseId, storedEvidenceId);

      setMessage("Evidence successfully stored and linked to this case.");

      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );

      if (storedEvidenceId) {
        setMessage(
          "Evidence was stored. Retry case linking if necessary."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryLinking() {
    if (!evidenceId) return;

    setBusy(true);
    setError("");

    try {
      await linkEvidenceToCase(caseId, evidenceId);
      setMessage("Evidence successfully linked to this case.");
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to link evidence."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleIndexImage() {
    if (!evidenceId) return;

    setIndexBusy(true);
    setIndexMessage("");
    setSearchError("");
    setSimilarityResults(null);

    try {
      const result = await indexEvidenceImage(evidenceId);

      setIndexed(true);
      setIndexMessage(
        `Image indexed successfully. Reference: ${result.evidence_id}`
      );
    } catch (err) {
      setIndexMessage(
        err instanceof Error ? err.message : "Unable to index image."
      );
    } finally {
      setIndexBusy(false);
    }
  }

  async function handleSimilaritySearch() {
    if (!evidenceId) return;

    setIndexBusy(true);
    setIndexMessage("");
    setSearchError("");
    setSimilarityResults(null);

    try {
      const result = await searchSimilarEvidenceImages(evidenceId, 10);

      setSimilarityResults(result);

      setIndexMessage(
        `Search completed. ${result.result_count} matching indexed images found.`
      );
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : "Similarity search failed."
      );
    } finally {
      setIndexBusy(false);
    }
  }


  async function handlePublicResearch(): Promise<void> {
  const query = searchQuery.trim();

  if (!evidenceId) {
    setSearchError("Secure the image before starting research.");
    return;
  }

  if (!query || query.length > 300) {
    setSearchError("Enter valid descriptive search terms.");
    return;
  }

  if (getSearchTokens(query).length === 0) {
    setSearchError("Enter more meaningful search terms.");
    return;
  }

  setSearching(true);
  setSearchError("");
  setSearchMessage("Searching public sources...");
  setArticles([]);
  setImages([]);
  setSocialProfiles([]);

  try {
    const results = await Promise.allSettled([
      searchWikipedia(query, 10),
      searchWikimediaImages(query, 10),
      searchBlueskyProfiles(query, 10),
      searchMastodonProfiles(query, 10),
    ]);

    const [wiki, commons, bluesky, mastodon] = results;

    const relevantArticles =
      wiki.status === "fulfilled"
        ? wiki.value.results.filter((item) =>
            isRelevant(query, `${item.title} ${item.description || ""}`)
          )
        : [];

    const relevantImages =
      commons.status === "fulfilled"
        ? commons.value.results.filter((item) =>
            isRelevant(query, item.title || "")
          )
        : [];

    const allProfiles: SocialProfileResult[] = [];

    if (bluesky.status === "fulfilled") {
      allProfiles.push(...bluesky.value.results);
    }

    if (mastodon.status === "fulfilled") {
      allProfiles.push(...mastodon.value.results);
    }

    const relevantProfiles = allProfiles.filter((profile) =>
      isRelevant(
        query,
        [
          profile.display_name,
          profile.handle,
          profile.username,
          profile.account,
          profile.description,
        ].filter(Boolean).join(" ")
      )
    );

    setArticles(relevantArticles);
    setImages(relevantImages);
    setSocialProfiles(relevantProfiles);

    const failedSources = results
      .map((result, index) =>
        result.status === "rejected"
          ? ["Wikipedia", "Wikimedia", "Bluesky", "Mastodon"][index]
          : null
      )
      .filter((source): source is string => source !== null);

    setSearchMessage(
      `Relevant results: ${relevantArticles.length} articles, ${relevantImages.length} images and ${relevantProfiles.length} public profiles.`
    );

    if (failedSources.length > 0) {
      setSearchError(
        `Unavailable providers: ${failedSources.join(", ")}`
      );
    }

    if (
      relevantArticles.length === 0 &&
      relevantImages.length === 0 &&
      relevantProfiles.length === 0
    ) {
      setSearchMessage(
        "No sufficiently relevant results found. Try more specific search terms."
      );
    }
  } catch (err) {
    setSearchError(
      err instanceof Error
        ? err.message
        : "Public-source search failed."
    );
    setSearchMessage("");
  } finally {
    setSearching(false);
  }
}


  function handleFileChange(selectedFile: File | undefined) {
    setFile(null);
    setAnalysis(null);
    setEvidenceId("");
    setMessage("");
    setError("");
    setIndexed(false);
    setIndexMessage("");
    setSimilarityResults(null);
    setArticles([]);
    setImages([]);
    setSearchMessage("");
    setSearchError("");

    if (!selectedFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Only JPEG, PNG and WEBP images are supported.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Image size must not exceed 10 MB.");
      return;
    }

    setFile(selectedFile);
  }

  return (
    <section className="investigation-panel">
      <h2>Image Investigation</h2>
      <p>Case ID: <strong>{caseId}</strong></p>

      <div className="upload-area">
        <label htmlFor="investigation-image">
          Select Image Evidence
        </label>

        <input
          id="investigation-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) =>
            handleFileChange(event.target.files?.[0])
          }
          disabled={busy}
        />

        {file && <p>Selected: {file.name}</p>}
      </div>

      <button
        type="button"
        onClick={handleInvestigation}
        disabled={!file || busy}
      >
        {busy ? "Processing..." : "Analyse and Secure Evidence"}
      </button>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      {evidenceId && (
        <div className="evidence-result">
          <h3>Evidence Reference</h3>
          <p>{evidenceId}</p>

          {error && (
            <button type="button" onClick={retryLinking} disabled={busy}>
              Retry Linking to Case
            </button>
          )}
        </div>
      )}

      {analysis && (
        <div className="analysis-result">
          <h3>Image Analysis Results</h3>
          <pre>{JSON.stringify(analysis, null, 2)}</pre>
        </div>
      )}

      {evidenceId && (
        <section className="image-index-panel">
          <h3>AEGIS Local Image Intelligence</h3>

          <p>
            Compare this photograph against images explicitly added
            to the AEGIS image collection.
          </p>

          <button
            type="button"
            onClick={handleIndexImage}
            disabled={indexBusy}
          >
            {indexBusy ? "Processing..." : "Add Image to Local Index"}
          </button>

          {indexed && <p className="success-message">Image indexed.</p>}

          <button
            type="button"
            onClick={handleSimilaritySearch}
            disabled={indexBusy}
          >
            Search Similar Indexed Images
          </button>

          {indexMessage && <p className="success-message">{indexMessage}</p>}
          {searchError && <p className="error-message">{searchError}</p>}

          {similarityResults && (
            <div className="research-results">
              <h4>Similarity Search Results</h4>

              <p>
                Indexed collection:
                {similarityResults.total_indexed_images} other images
              </p>

              {similarityResults.results.length === 0 ? (
                <p>No similar indexed images were found.</p>
              ) : (
                similarityResults.results.map((item) => (
                  <article key={item.evidence_id}>
                    <h4>{item.evidence_id}</h4>

                    <p>
                      Whole-image hash similarity:
                      <strong> {item.similarity_score}%</strong>
                    </p>

                    <p>Hash distance: {item.hash_distance} / 64</p>

                    <small>
                      Indexed: {new Date(item.indexed_at).toLocaleString()}
                    </small>
                  </article>
                ))
              )}

              <p className="research-disclaimer">
                Similarity scores measure whole-image perceptual hash
                similarity, not identity or probability that images
                depict the same person.
              </p>
            </div>
          )}
        </section>
      )}

      {evidenceId && (
        <section className="public-research-panel">
          <h3>Public Image Research</h3>

          <p>
            Search Wikimedia public sources using descriptive
            search terms.
          </p>

          <label htmlFor="public-search-query">
            Descriptive Search Terms
          </label>

          <input
            id="public-search-query"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Subject, event, place or context..."
            maxLength={300}
            disabled={searching}
          />

          <button
            type="button"
            onClick={handlePublicResearch}
            disabled={!searchQuery.trim() || searching}
          >
            {searching ? "Searching..." : "Search Wikimedia"}
          </button>

          {searchMessage && <p className="success-message">{searchMessage}</p>}
          {searchError && <p className="error-message">{searchError}</p>}

          {articles.map((article, index) => (
            <article key={article.page_id ?? index}>
              <h4>{article.title}</h4>
              <p>{cleanText(article.description)}</p>

              {article.url && (
                <a href={article.url} target="_blank" rel="noreferrer">
                  Open article
                </a>
              )}
            </article>
          ))}

          <div className="research-image-grid">
            {images.map((image, index) => (
              <article key={`${image.title}-${index}`}>
                {image.image_url && (
                  <a
                    href={image.original_url || image.image_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={image.image_url}
                      alt={cleanText(image.title)}
                      loading="lazy"
                    />
                  </a>
                )}

                <h4>{cleanText(image.title)}</h4>

                <p>
                  Licence: {cleanText(image.license) || "Not provided"}
                </p>

                <a href={image.source_page} target="_blank" rel="noreferrer">
                  Original source
                </a>
              </article>
            ))}
          </div>


          <div className="external-social-results">
            <h3>Public Social Profile Results</h3>

            {socialProfiles.length === 0 ? (
              <p>No public profiles found for this search.</p>
            ) : (
              socialProfiles.map((profile, index) => (
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
                      <p>{profile.source}</p>
                    </div>
                  </div>

                  {profile.handle && <p>@{profile.handle}</p>}
                  {profile.account && <p>@{profile.account}</p>}

                  {profile.description && (
                    <p>{cleanText(profile.description)}</p>
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
                    Retrieved: {new Date(
                      profile.retrieved_at
                    ).toLocaleString()}
                  </small>
                </article>
              ))
            )}
          </div>


          <p className="research-disclaimer">
            Public-source search results do not establish the identity
            of people depicted in photographs.
          </p>
        </section>
      )}

      {evidenceId && (
        <section className="external-research-panel">
          <h3>External Reverse Image Search</h3>

          <p>
            Search for copies or visually similar versions of the
            uploaded photograph using external image-search providers.
          </p>

          <div className="external-search-warning">
            External providers receive the image only when you
            manually upload it on their website. Review your
            organisation's evidence-sharing rules first.
          </div>

          <div className="external-provider-list">
            <article className="external-provider">
              <h4>Google Lens</h4>
              <p>Search similar images and webpages containing the image.</p>
              <a
                href="https://lens.google.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Google Lens ↗
              </a>
            </article>

            <article className="external-provider">
              <h4>Bing Visual Search</h4>
              <p>Find related photographs and pages across its indexed web.</p>
              <a
                href="https://www.bing.com/visualsearch"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Bing Visual Search ↗
              </a>
            </article>

            <article className="external-provider">
              <h4>TinEye</h4>
              <p>Search its index for exact and modified image copies.</p>
              <a
                href="https://tineye.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open TinEye ↗
              </a>
            </article>
          </div>

          <p className="research-disclaimer">
            These external services operate independently. Their
            results are not automatically imported into AEGIS INTEL.
            Similar photographs do not establish the identity of
            the person depicted.
          </p>
        </section>
      )}


    </section>
  );
}
