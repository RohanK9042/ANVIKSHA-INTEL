
import { useEffect, useMemo, useState } from "react";

import {
  getAllStoredEvidence,
  getCases,
  getCaseEvidence,
  getEvidenceManifest,
  verifyEvidence,
  linkEvidenceToCase,
  type EvidenceManifest,
  type EvidenceVerificationResult,
  type InvestigationCase,
} from "./api";

import "./App.css";

interface LinkedCase {
  case_id: string;
  title: string;
  linked_at: string;
}

interface VaultEvidence {
  manifest: EvidenceManifest;
  linked_cases: LinkedCase[];
}

type EvidenceFilter = "ALL" | "LINKED" | "UNLINKED";

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function EvidenceRecordCard({
  item,
  cases,
  onLinked,
}: {
  item: VaultEvidence;
  cases: InvestigationCase[];
  onLinked: () => void;
}) {
  const [verification, setVerification] =
    useState<EvidenceVerificationResult | null>(null);

  const [showManifest, setShowManifest] = useState(false);
  const [selectedCase, setSelectedCase] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [manifestLoading, setManifestLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  const manifest = item.manifest;
  const linked = item.linked_cases.length > 0;

  const availableCases = cases.filter(
    (caseItem) =>
      !item.linked_cases.some(
        (linkedCase) => linkedCase.case_id === caseItem.case_id
      )
  );

  async function handleManifest() {
    if (showManifest) {
      setShowManifest(false);
      return;
    }

    try {
      setManifestLoading(true);
      setError("");

      // Retrieve the latest manifest from the backend.
      await getEvidenceManifest(manifest.evidence_id);
      setShowManifest(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve manifest."
      );
    } finally {
      setManifestLoading(false);
    }
  }

  async function handleVerification() {
    try {
      setVerificationLoading(true);
      setError("");
      setSuccess("");

      const result = await verifyEvidence(manifest.evidence_id);
      setVerification(result);
    } catch (err) {
      setVerification(null);
      setError(
        err instanceof Error
          ? err.message
          : "Evidence verification failed."
      );
    } finally {
      setVerificationLoading(false);
    }
  }

  async function handleLinkEvidence() {
    if (!selectedCase) {
      setError("Please select an investigation first.");
      return;
    }

    try {
      setLinkLoading(true);
      setError("");
      setSuccess("");

      await linkEvidenceToCase(
        selectedCase,
        manifest.evidence_id
      );

      setSuccess("Evidence linked successfully.");
      setSelectedCase("");

      onLinked();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to link evidence."
      );
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <section className="panel details-panel">
      <div className="panel-heading">
        <div>
          <h3>{manifest.original_filename}</h3>
          <p className="uuid-text">{manifest.evidence_id}</p>
        </div>

        <span className={linked ? "module-ready" : "module-planned"}>
          {linked ? "LINKED" : "UNLINKED"}
        </span>
      </div>

      <div className="detail-grid">
        <div>
          <small>FILE SIZE</small>
          <strong>{formatFileSize(manifest.file_size_bytes)}</strong>
        </div>

        <div>
          <small>CONTENT TYPE</small>
          <strong>{manifest.content_type}</strong>
        </div>

        <div>
          <small>ENCRYPTION</small>
          <strong>{manifest.encryption}</strong>
        </div>

        <div>
          <small>STORAGE STATUS</small>
          <strong>{manifest.status}</strong>
        </div>

        <div>
          <small>REGISTERED ON</small>
          <strong>{formatDate(manifest.created_at)}</strong>
        </div>

        <div>
          <small>LINKED INVESTIGATIONS</small>
          <strong>{item.linked_cases.length}</strong>
        </div>
      </div>

      {linked && (
        <div style={{ marginTop: "16px" }}>
          <small>ASSOCIATED INVESTIGATIONS</small>

          {item.linked_cases.map((linkedCase) => (
            <div className="module-row" key={linkedCase.case_id}>
              <span>{linkedCase.title}</span>
              <span className="panel-label">
                {linkedCase.case_id}
              </span>
            </div>
          ))}
        </div>
      )}

      {!linked && (
        <div style={{ marginTop: "18px" }}>
          <div className="panel-heading">
            <div>
              <h3>Link to Investigation</h3>
              <p>Associate this evidence with an existing case.</p>
            </div>
          </div>

          {availableCases.length === 0 ? (
            <p className="muted">
              No investigations are available for linking.
              Create an investigation first.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <select
                value={selectedCase}
                onChange={(event) => setSelectedCase(event.target.value)}
                style={{ flex: "1", minWidth: "220px" }}
              >
                <option value="">Select investigation...</option>

                {availableCases.map((caseItem) => (
                  <option
                    key={caseItem.case_id}
                    value={caseItem.case_id}
                  >
                    {caseItem.title} ({caseItem.case_id})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="workspace-action"
                onClick={handleLinkEvidence}
                disabled={linkLoading || !selectedCase}
              >
                {linkLoading ? "Linking..." : "Link Evidence"}
              </button>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "18px",
        }}
      >
        <button
          type="button"
          className="workspace-action"
          onClick={handleManifest}
          disabled={manifestLoading}
        >
          {manifestLoading
            ? "Loading..."
            : showManifest
              ? "Hide Manifest"
              : "View Manifest"}
        </button>

        <button
          type="button"
          className="workspace-action"
          onClick={handleVerification}
          disabled={verificationLoading}
        >
          {verificationLoading ? "Verifying..." : "Verify Integrity"}
        </button>
      </div>

      {error && (
        <p className="error-message" style={{ marginTop: "12px" }}>
          {error}
        </p>
      )}

      {success && (
        <p className="module-ready" style={{ marginTop: "12px" }}>
          {success}
        </p>
      )}

      {showManifest && (
        <div className="panel" style={{ marginTop: "16px", padding: "16px" }}>
          <div className="panel-heading">
            <div>
              <h3>Evidence Manifest</h3>
              <p>Stored evidence metadata</p>
            </div>
            <span className="panel-label">MANIFEST</span>
          </div>

          <div style={{ marginTop: "12px" }}>
            <small>ORIGINAL SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {manifest.original_sha256}
            </p>
          </div>

          <div style={{ marginTop: "12px" }}>
            <small>STORAGE FILENAME</small>
            <p>{manifest.storage_filename}</p>
          </div>

          <div style={{ marginTop: "12px" }}>
            <small>EVIDENCE ID</small>
            <p className="uuid-text">{manifest.evidence_id}</p>
          </div>
        </div>
      )}

      {verification && (
        <div className="panel" style={{ marginTop: "16px", padding: "16px" }}>
          <div className="panel-heading">
            <div>
              <h3>Integrity Verification</h3>
              <p>Backend SHA-256 comparison</p>
            </div>

            <span
              className="panel-label"
              style={{
                color: verification.integrity_verified
                  ? "#72c995"
                  : "#e58b80",
              }}
            >
              {verification.integrity_verified ? "VERIFIED" : "MISMATCH"}
            </span>
          </div>

          <p>
            {verification.integrity_verified
              ? "The calculated hash matches the manifest."
              : "The calculated hash does not match the manifest."}
          </p>

          <div style={{ marginTop: "12px" }}>
            <small>MANIFEST SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {verification.original_sha256}
            </p>
          </div>

          <div style={{ marginTop: "12px" }}>
            <small>CALCULATED SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {verification.calculated_sha256}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function EvidenceVault() {
  const [records, setRecords] = useState<VaultEvidence[]>([]);
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EvidenceFilter>("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadVault() {
      try {
        setLoading(true);
        setError("");

        const [evidenceResponse, casesResponse] = await Promise.all([
          getAllStoredEvidence(),
          getCases(),
        ]);

        const caseEvidenceResponses = await Promise.all(
          casesResponse.cases.map(async (caseItem) => {
            const response = await getCaseEvidence(caseItem.case_id);

            return {
              caseItem,
              evidence: response.evidence,
            };
          })
        );

        if (cancelled) return;

        const linkedMap = new Map<string, LinkedCase[]>();

        for (const response of caseEvidenceResponses) {
          for (const evidenceItem of response.evidence) {
            const current = linkedMap.get(evidenceItem.evidence_id) || [];

            current.push({
              case_id: response.caseItem.case_id,
              title: response.caseItem.title,
              linked_at: evidenceItem.linked_at,
            });

            linkedMap.set(evidenceItem.evidence_id, current);
          }
        }

        const vaultRecords: VaultEvidence[] =
          evidenceResponse.evidence.map((manifest) => ({
            manifest,
            linked_cases: linkedMap.get(manifest.evidence_id) || [],
          }));

        vaultRecords.sort(
          (a, b) =>
            new Date(b.manifest.created_at).getTime() -
            new Date(a.manifest.created_at).getTime()
        );

        setRecords(vaultRecords);
        setCases(casesResponse.cases);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the central evidence register."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVault();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const linkedCount = records.filter(
    (record) => record.linked_cases.length > 0
  ).length;

  const unlinkedCount = records.length - linkedCount;

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const isLinked = record.linked_cases.length > 0;

      const matchesFilter =
        filter === "ALL" ||
        (filter === "LINKED" && isLinked) ||
        (filter === "UNLINKED" && !isLinked);

      const matchesSearch =
        !query ||
        record.manifest.evidence_id.toLowerCase().includes(query) ||
        record.manifest.original_filename.toLowerCase().includes(query) ||
        record.linked_cases.some(
          (linkedCase) =>
            linkedCase.title.toLowerCase().includes(query) ||
            linkedCase.case_id.toLowerCase().includes(query)
        );

      return matchesFilter && matchesSearch;
    });
  }, [records, search, filter]);

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="breadcrumb">
            ANVĪKṢĀ INTEL / EVIDENCE VAULT
          </span>
          <h1>Central Evidence Register</h1>
        </div>

        <span className="environment-tag">
          DEVELOPMENT ENVIRONMENT
        </span>
      </header>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">EVIDENCE MANAGEMENT</p>
          <h2>Digital Evidence Vault</h2>
          <p className="muted">
            A central register of encrypted evidence, linked investigations
            and integrity verification records.
          </p>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>TOTAL STORED EVIDENCE</span>
            <span className="stat-icon">⬡</span>
          </div>
          <strong>{loading ? "..." : records.length}</strong>
          <small>All stored evidence manifests</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>LINKED EVIDENCE</span>
            <span className="stat-icon">▣</span>
          </div>
          <strong>{loading ? "..." : linkedCount}</strong>
          <small>Associated with investigations</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>UNLINKED EVIDENCE</span>
            <span className="stat-icon">◈</span>
          </div>
          <strong>{loading ? "..." : unlinkedCount}</strong>
          <small>Awaiting investigation association</small>
        </div>
      </section>

      <section className="panel workspace-panel">
        <div className="panel-heading">
          <div>
            <h3>Evidence Search and Filters</h3>
            <p>Search by filename, evidence ID or investigation.</p>
          </div>
          <span className="panel-label">REGISTER SEARCH</span>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search filename, evidence ID or case..."
          style={{ width: "100%", marginBottom: "16px" }}
        />

        <div style={{ marginBottom: "20px" }}>
          <small>FILTER EVIDENCE</small>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "10px",
            }}
          >
            {([
              ["ALL", `All (${records.length})`],
              ["LINKED", `Linked (${linkedCount})`],
              ["UNLINKED", `Unlinked (${unlinkedCount})`],
            ] as [EvidenceFilter, string][]).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className="workspace-action"
                onClick={() => setFilter(value)}
                style={{
                  borderColor: filter === value ? "#D6AD55" : undefined,
                  background: filter === value
                    ? "rgba(214, 173, 85, 0.12)"
                    : undefined,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-heading">
          <div>
            <h3>Stored Evidence Records</h3>
            <p>{filteredRecords.length} matching records</p>
          </div>

          <button
            type="button"
            className="workspace-action"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            ↻ Refresh Register
          </button>
        </div>

        {error && (
          <div>
            <p className="error-message">{error}</p>
            <button
              type="button"
              className="workspace-action"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="muted">Loading all stored evidence...</p>
        ) : records.length === 0 ? (
          <div className="module-placeholder">
            <div className="placeholder-icon">⬡</div>
            <h3>No stored evidence found</h3>
            <p>
              Upload an image through Image Forensics to register evidence.
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <p className="muted">
            No evidence records match the selected search and filter.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredRecords.map((record) => (
              <EvidenceRecordCard
                key={record.manifest.evidence_id}
                item={record}
                cases={cases}
                onLinked={() => setRefreshKey((value) => value + 1)}
              />
            ))}
          </div>
        )}
      </section>

      <p className="research-disclaimer">
        This register displays evidence with valid manifests and corresponding
        encrypted originals. Linking associates evidence with a case; it does
        not alter the original evidence file. Integrity verification compares
        the stored bytes against the SHA-256 hash recorded in the manifest.
      </p>
    </main>
  );
}

export default EvidenceVault;
