
import { useEffect, useState } from "react";

import {
  getCases,
  getCaseEvidence,
  getCaseActivity,
  getEvidenceManifest,
  verifyEvidence,
  getFaceAnalysisReports,
  getFaceAnalysisReport,
  type InvestigationCase,
  type CaseActivity,
  type EvidenceRecord,
  type EvidenceManifest,
  type EvidenceVerificationResult,
  type FaceAnalysisReport,
  type FaceAnalysisReportSummary,
} from "./api";

import "./App.css";

interface Props {
  caseId: string;
  onBack: () => void;
}

type ReportAnalysis = {
  image?: {
    width?: number;
    height?: number;
    size_bytes?: number;
  };
  face_analysis?: {
    faces_detected?: number;
    model?: string;
    landmark_model?: string;
    faces?: Array<{
      face_number?: number;
      landmark_count?: number;
      image_area_percentage?: number;
      quality?: {
        sharpness?: string;
        lighting?: string;
      };
      head_pose?: {
        available?: boolean;
        reliable?: boolean;
        assessment?: string;
      };
    }>;
  };
  limitations?: string[];
};

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

// Individual evidence record with manifest and verification controls
function EvidenceVaultRecord({ item }: { item: EvidenceRecord }) {
  const [manifest, setManifest] = useState<EvidenceManifest | null>(null);
  const [verification, setVerification] =
    useState<EvidenceVerificationResult | null>(null);

  const [manifestLoading, setManifestLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleViewManifest() {
    try {
      setManifestLoading(true);
      setError("");

      const result = await getEvidenceManifest(item.evidence_id);
      setManifest(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to retrieve manifest."
      );
    } finally {
      setManifestLoading(false);
    }
  }

  async function handleVerifyIntegrity() {
    try {
      setVerificationLoading(true);
      setError("");

      const result = await verifyEvidence(item.evidence_id);
      setVerification(result);
    } catch (err) {
      setVerification(null);
      setError(
        err instanceof Error ? err.message : "Evidence verification failed."
      );
    } finally {
      setVerificationLoading(false);
    }
  }

  return (
    <div className="case-row" style={{ display: "block", marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div className="case-symbol">⬡</div>

        <div className="case-info" style={{ flex: 1, minWidth: 0 }}>
          <strong>{item.evidence_id}</strong>
          <span>Digital evidence reference</span>
          <span>Linked: {formatDate(item.linked_at)}</span>
        </div>

        <span className="module-ready">LINKED</span>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
        <button
          type="button"
          className="workspace-action"
          onClick={handleViewManifest}
          disabled={manifestLoading}
        >
          {manifestLoading ? "Loading manifest..." : "View Manifest"}
        </button>

        <button
          type="button"
          className="workspace-action"
          onClick={handleVerifyIntegrity}
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

      {manifest && (
        <div className="panel" style={{ marginTop: "16px", padding: "16px" }}>
          <div className="panel-heading">
            <div>
              <h3>Evidence Manifest</h3>
              <p>Original evidence metadata retrieved from backend</p>
            </div>
            <span className="panel-label">MANIFEST</span>
          </div>

          <div className="detail-grid">
            <div>
              <small>ORIGINAL FILENAME</small>
              <strong>{manifest.original_filename}</strong>
            </div>

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
              <small>CREATED AT</small>
              <strong>{formatDate(manifest.created_at)}</strong>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <small>ORIGINAL SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {manifest.original_sha256}
            </p>
          </div>
        </div>
      )}

      {verification && (
        <div className="panel" style={{ marginTop: "16px", padding: "16px" }}>
          <div className="panel-heading">
            <div>
              <h3>Integrity Verification</h3>
              <p>Backend SHA-256 comparison result</p>
            </div>

            <span
              className="panel-label"
              style={{
                color: verification.integrity_verified ? "#72c995" : "#e58b80",
              }}
            >
              {verification.integrity_verified ? "VERIFIED" : "MISMATCH"}
            </span>
          </div>

          <p
            style={{
              color: verification.integrity_verified ? "#72c995" : "#e58b80",
              fontWeight: 600,
            }}
          >
            {verification.integrity_verified
              ? "Integrity check passed. The calculated SHA-256 matches the manifest."
              : "Integrity check failed. The calculated SHA-256 does not match the manifest."}
          </p>

          <div style={{ marginTop: "14px" }}>
            <small>MANIFEST SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {verification.original_sha256}
            </p>
          </div>

          <div style={{ marginTop: "14px" }}>
            <small>CALCULATED SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {verification.calculated_sha256}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual saved facial-analysis report
function FaceReportRecord({
  item,
  onOpen,
  loading,
}: {
  item: FaceAnalysisReportSummary;
  onOpen: (reportId: string) => void;
  loading: boolean;
}) {
  return (
    <div
      className="case-row"
      style={{
        display: "block",
        marginBottom: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div className="case-symbol">◎</div>

        <div className="case-info" style={{ flex: 1, minWidth: 0 }}>
          <strong>{item.report_id}</strong>
          <span>Facial-analysis report</span>
          <span>Evidence: {item.evidence_id}</span>
          <span>Saved: {formatDate(item.created_at)}</span>
        </div>

        <span className="module-ready">SAVED</span>
      </div>

      <button
        type="button"
        className="workspace-action"
        style={{ marginTop: "14px" }}
        onClick={() => onOpen(item.report_id)}
        disabled={loading}
      >
        {loading ? "Opening report..." : "View Analysis Report →"}
      </button>
    </div>
  );
}

// Complete investigation details page
function CaseDetails({ caseId, onBack }: Props) {
  const [caseData, setCaseData] =
    useState<InvestigationCase | null>(null);

  const [evidence, setEvidence] =
    useState<EvidenceRecord[]>([]);

  const [activities, setActivities] =
    useState<CaseActivity[]>([]);

  // Facial-analysis report states
  const [reports, setReports] =
    useState<FaceAnalysisReportSummary[]>([]);

  const [selectedReport, setSelectedReport] =
    useState<FaceAnalysisReport | null>(null);

  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportLoadingId, setReportLoadingId] = useState("");
  const [reportError, setReportError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        setLoading(true);
        setError("");

        const casesResponse = await getCases();

        const selectedCase = casesResponse.cases.find(
          (item) => item.case_id === caseId
        );

        if (!selectedCase) {
          throw new Error("Investigation not found.");
        }

        const [evidenceResponse, activityResponse] =
          await Promise.all([
            getCaseEvidence(caseId),
            getCaseActivity(caseId),
          ]);

        if (cancelled) return;

        setCaseData(selectedCase);
        setEvidence(evidenceResponse.evidence);
        setActivities(activityResponse.activities);

        // Load facial-analysis reports separately.
        setReportsLoading(true);
        setReportError("");
        setSelectedReport(null);

        try {
          const reportResponse = await getFaceAnalysisReports(caseId);

          if (!cancelled) {
            setReports(reportResponse.reports);
          }
        } catch (err) {
          if (!cancelled) {
            setReports([]);
            setReportError(
              err instanceof Error
                ? err.message
                : "Unable to load facial-analysis reports."
            );
          }
        } finally {
          if (!cancelled) {
            setReportsLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load investigation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [caseId, refreshKey]);

  // Retrieve one complete saved report
  async function openFaceReport(reportId: string) {
    try {
      setReportLoadingId(reportId);
      setReportError("");
      setSelectedReport(null);

      const response = await getFaceAnalysisReport(reportId);
      setSelectedReport(response);
    } catch (err) {
      setReportError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve the selected report."
      );
    } finally {
      setReportLoadingId("");
    }
  }

  if (loading) {
    return (
      <main className="main-content">
        <p className="muted">Loading investigation records...</p>
      </main>
    );
  }

  if (error || !caseData) {
    return (
      <main className="main-content">
        <button
          type="button"
          className="workspace-action"
          onClick={onBack}
        >
          ← Back to workspace
        </button>

        <p className="error-message">
          {error || "Investigation not found."}
        </p>

        <button
          type="button"
          className="workspace-action"
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          Retry loading
        </button>
      </main>
    );
  }

  const reportAnalysis =
    selectedReport?.analysis as unknown as ReportAnalysis | undefined;

  return (
    <main className="main-content">
      <button
        type="button"
        className="workspace-action"
        onClick={onBack}
      >
        ← Back to workspace
      </button>

      <header className="topbar">
        <div>
          <span className="breadcrumb">
            ANVĪKṢĀ INTEL / INVESTIGATIONS / {caseData.case_id}
          </span>

          <h1>{caseData.title}</h1>
        </div>

        <span className="case-status">{caseData.status}</span>
      </header>

      {/* INVESTIGATION OVERVIEW */}

      <section className="panel details-panel">
        <div className="panel-heading">
          <div>
            <h3>Investigation Overview</h3>
            <p>Case information and administrative metadata</p>
          </div>

          <span className="panel-label">CASE PROFILE</span>
        </div>

        <p className="muted">
          {caseData.description || "No description provided."}
        </p>

        <div className="detail-grid">
          <div>
            <small>CASE IDENTIFIER</small>
            <strong>{caseData.case_id}</strong>
          </div>

          <div>
            <small>PRIORITY</small>
            <strong>{caseData.priority}</strong>
          </div>

          <div>
            <small>CASE STATUS</small>
            <strong>{caseData.status}</strong>
          </div>

          <div>
            <small>CREATED ON</small>
            <strong>{formatDate(caseData.created_at)}</strong>
          </div>

          <div>
            <small>INTERNAL REFERENCE</small>
            <strong className="uuid-text">{caseData.internal_id}</strong>
          </div>
        </div>
      </section>

      {/* EVIDENCE REGISTER */}

      <section className="panel details-panel">
        <div className="panel-heading">
          <div>
            <h3>Digital Evidence Register</h3>
            <p>Evidence records associated with this investigation</p>
          </div>

          <span className="panel-label">
            {evidence.length} RECORDS
          </span>
        </div>

        {evidence.length === 0 ? (
          <div className="module-placeholder">
            <div className="placeholder-icon">⬡</div>

            <h3>No evidence registered</h3>

            <p>
              Evidence uploaded through the Image Forensics module
              will appear here after successful linking.
            </p>
          </div>
        ) : (
          <div className="case-list">
            {evidence.map((item) => (
              <EvidenceVaultRecord
                key={item.evidence_id}
                item={item}
              />
            ))}
          </div>
        )}

        <p className="research-disclaimer">
          Integrity verification decrypts the stored evidence and
          compares its SHA-256 hash against the manifest. A successful
          result confirms the stored bytes match the recorded hash;
          it does not independently establish the authenticity of the
          original photograph.
        </p>
      </section>

      {/* FACIAL ANALYSIS REPORTS */}

      <section className="panel details-panel">
        <div className="panel-heading">
          <div>
            <h3>Facial Analysis Reports</h3>
            <p>
              Structured reports saved from the Face Intelligence Laboratory
            </p>
          </div>

          <span className="panel-label">
            {reports.length} REPORTS
          </span>
        </div>

        {reportsLoading ? (
          <p className="muted">
            Retrieving facial-analysis reports...
          </p>
        ) : reports.length === 0 ? (
          <div className="module-placeholder">
            <div className="placeholder-icon">◎</div>

            <h3>No facial-analysis reports</h3>

            <p>
              Once a facial-analysis report is saved and associated
              with this investigation, it will appear here.
            </p>
          </div>
        ) : (
          <div className="case-list">
            {reports.map((item) => (
              <FaceReportRecord
                key={item.report_id}
                item={item}
                onOpen={openFaceReport}
                loading={reportLoadingId === item.report_id}
              />
            ))}
          </div>
        )}

        {reportError && (
          <p className="error-message" style={{ marginTop: "14px" }}>
            {reportError}
          </p>
        )}

        {/* SELECTED REPORT DETAILS */}

        {selectedReport && reportAnalysis && (
          <div className="panel" style={{ marginTop: "20px", padding: "18px" }}>
            <div className="panel-heading">
              <div>
                <h3>Saved Analysis Report</h3>
                <p>Report details retrieved from the backend</p>
              </div>

              <span className="panel-label">REPORT DETAILS</span>
            </div>

            <div className="detail-grid">
              <div>
                <small>REPORT ID</small>
                <strong>{selectedReport.report_id}</strong>
              </div>

              <div>
                <small>ASSOCIATED CASE</small>
                <strong>{selectedReport.case_id}</strong>
              </div>

              <div>
                <small>EVIDENCE ID</small>
                <strong>{selectedReport.evidence_id}</strong>
              </div>

              <div>
                <small>MODEL</small>
                <strong>
                  {selectedReport.model_name || "Not specified"}
                </strong>
              </div>

              <div>
                <small>CREATED AT</small>
                <strong>{formatDate(selectedReport.created_at)}</strong>
              </div>

              <div>
                <small>FACES DETECTED</small>
                <strong>
                  {reportAnalysis.face_analysis?.faces_detected ?? "N/A"}
                </strong>
              </div>

              <div>
                <small>IMAGE RESOLUTION</small>
                <strong>
                  {reportAnalysis.image?.width ?? "N/A"} ×{" "}
                  {reportAnalysis.image?.height ?? "N/A"}
                </strong>
              </div>

              <div>
                <small>LANDMARK MODEL</small>
                <strong>
                  {reportAnalysis.face_analysis?.landmark_model ?? "N/A"}
                </strong>
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <small>REPORT SHA-256</small>
              <p
                className="uuid-text"
                style={{ overflowWrap: "anywhere" }}
              >
                {selectedReport.report_sha256}
              </p>
            </div>

            {/* Individual face observations */}

            {reportAnalysis.face_analysis?.faces &&
              reportAnalysis.face_analysis.faces.length > 0 && (
                <>
                  <h3 style={{ marginTop: "24px" }}>
                    Face Analysis Observations
                  </h3>

                  {reportAnalysis.face_analysis.faces.map((face, index) => (
                    <div
                      key={face.face_number ?? index}
                      className="case-row"
                      style={{ marginTop: "12px" }}
                    >
                      <strong>
                        FACE {face.face_number ?? index + 1}
                      </strong>

                      <div className="detail-grid" style={{ marginTop: "12px" }}>
                        <div>
                          <small>LANDMARK COUNT</small>
                          <strong>{face.landmark_count ?? "N/A"}</strong>
                        </div>

                        <div>
                          <small>IMAGE AREA</small>
                          <strong>
                            {face.image_area_percentage ?? "N/A"}
                            {face.image_area_percentage !== undefined
                              ? "%"
                              : ""}
                          </strong>
                        </div>

                        <div>
                          <small>SHARPNESS</small>
                          <strong>
                            {face.quality?.sharpness ?? "N/A"}
                          </strong>
                        </div>

                        <div>
                          <small>LIGHTING</small>
                          <strong>
                            {face.quality?.lighting ?? "N/A"}
                          </strong>
                        </div>

                        <div>
                          <small>POSE ESTIMATE</small>
                          <strong>
                            {face.head_pose?.available
                              ? face.head_pose.reliable
                                ? "Available — reliable flag true"
                                : "Available — interpret cautiously"
                              : "Unavailable"}
                          </strong>
                        </div>
                      </div>

                      {face.head_pose?.assessment && (
                        <p className="muted" style={{ marginTop: "10px" }}>
                          {face.head_pose.assessment}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}

            {/* Analytical limitations */}

            {reportAnalysis.limitations &&
              reportAnalysis.limitations.length > 0 && (
                <div style={{ marginTop: "22px" }}>
                  <h3>Analytical Limitations</h3>

                  <ul style={{ paddingLeft: "20px" }}>
                    {reportAnalysis.limitations.map((item, index) => (
                      <li key={index} className="muted" style={{ marginTop: "8px" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <p className="research-disclaimer" style={{ marginTop: "18px" }}>
              This report documents automated visual analysis.
              It does not identify a person, establish identity,
              or establish the authenticity of the source image.
              The report checksum is not proof of evidentiary authenticity.
            </p>
          </div>
        )}
      </section>

      {/* ACTIVITY TIMELINE */}

      <section className="panel details-panel">
        <div className="panel-heading">
          <div>
            <h3>Investigation Activity Timeline</h3>
            <p>Recorded events associated with this case</p>
          </div>

          <span className="panel-label">
            {activities.length} EVENTS
          </span>
        </div>

        {activities.length === 0 ? (
          <p className="muted">
            No investigation activities recorded.
          </p>
        ) : (
          activities.map((activity) => (
            <div
              className="activity-row"
              key={activity.activity_id}
            >
              <span className="activity-dot"></span>

              <div>
                <strong>
                  {activity.activity_type.replaceAll("_", " ")}
                </strong>

                <p>{activity.description}</p>

                <small className="muted">
                  {formatDate(activity.timestamp)}
                </small>
              </div>
            </div>
          ))
        )}
      </section>

      {/* REFRESH */}

      <div style={{ marginTop: "20px" }}>
        <button
          type="button"
          className="workspace-action"
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          ↻ Refresh investigation records
        </button>
      </div>
    </main>
  );
}

export default CaseDetails;
