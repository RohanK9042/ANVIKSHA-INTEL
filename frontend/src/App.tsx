
import { useEffect, useState } from "react";
import "./App.css";

import ExternalIntelligence from "./ExternalIntelligence";
import CaseDetails from "./CaseDetails";
import CreateCase from "./CreateCase";
import ImageInvestigation from "./ImageInvestigation";
import EvidenceVault from "./EvidenceVault";
import FaceIntelligence from "./FaceIntelligence";

import {
  getSystemHealth,
  getCases,
  getCaseEvidence,
  getCaseActivity,
  getFaceAnalysisReports,
  getFaceAnalysisReport,
  type InvestigationCase,
  type CaseActivity,
  type FaceAnalysisReport,
  type FaceAnalysisReportSummary,
} from "./api";

type WorkspacePage =
  | "Dashboard"
  | "Investigations"
  | "Image Forensics"
  | "Face Intelligence"
  | "Evidence Vault"
  | "Intelligence Network"
  | "Reports";

const navigation: { label: WorkspacePage; icon: string }[] = [
  { label: "Dashboard", icon: "▦" },
  { label: "Investigations", icon: "▣" },
  { label: "Image Forensics", icon: "◈" },
  { label: "Face Intelligence", icon: "◎" },
  { label: "Evidence Vault", icon: "⬡" },
  { label: "Intelligence Network", icon: "⌘" },
  { label: "Reports", icon: "▤" },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function App() {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [activities, setActivities] = useState<CaseActivity[]>([]);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [activePage, setActivePage] =
    useState<WorkspacePage>("Dashboard");

  const [selectedCaseId, setSelectedCaseId] =
    useState<string | null>(null);

  const [selectedImageCaseId, setSelectedImageCaseId] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setError("");

        const [health, caseResponse] = await Promise.all([
          getSystemHealth(),
          getCases(),
        ]);

        if (cancelled) return;

        setSystemStatus(health.status.toUpperCase());
        setCases(caseResponse.cases);

        if (caseResponse.cases.length > 0) {
          const latestCase = caseResponse.cases[0];

          const [evidenceResponse, activityResponse] =
            await Promise.all([
              getCaseEvidence(latestCase.case_id),
              getCaseActivity(latestCase.case_id),
            ]);

          if (cancelled) return;

          setEvidenceCount(evidenceResponse.total_evidence);
          setActivities(activityResponse.activities);
        } else {
          setEvidenceCount(0);
          setActivities([]);
        }
      } catch (err) {
        if (!cancelled) {
          setSystemStatus("OFFLINE");
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function navigateTo(page: WorkspacePage) {
    setSelectedCaseId(null);
    setSelectedImageCaseId(null);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCase(caseId: string) {
    setSelectedCaseId(caseId);
  }

  function handleCaseUpdated() {
    setRefreshKey((previous) => previous + 1);
  }

  const pageTitles: Record<WorkspacePage, string> = {
    Dashboard: "Intelligence Dashboard",
    Investigations: "Investigation Register",
    "Image Forensics": "Image Forensics Laboratory",
    "Face Intelligence": "Face Intelligence Laboratory",
    "Evidence Vault": "Digital Evidence Vault",
    "Intelligence Network": "Public-Source Intelligence",
    Reports: "Investigation Reports",
  };

  if (selectedCaseId) {
    return (
      <CaseDetails
        caseId={selectedCaseId}
        onBack={() => setSelectedCaseId(null)}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">अ</div>
          <div>
            <h2>
              ANVĪKṢĀ <span>INTEL</span>
            </h2>
            <small>DIGITAL INVESTIGATION PLATFORM</small>
          </div>
        </div>

        <div className="nav-heading">
          INVESTIGATION WORKSPACE
        </div>

        <nav>
          {navigation.map((item) => (
            <button
              type="button"
              key={item.label}
              className={
                activePage === item.label
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => navigateTo(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-indicator">
            <span className="online-dot"></span>
            {systemStatus === "HEALTHY"
              ? "Backend connected"
              : systemStatus}
          </div>

          <small>ANVĪKṢĀ INTEL · VERSION 0.1.0</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              ANVĪKṢĀ INTEL / {activePage.toUpperCase()}
            </span>

            <h1>{pageTitles[activePage]}</h1>
          </div>

          <div className="topbar-right">
            <span className="environment-tag">
              DEVELOPMENT ENVIRONMENT
            </span>
            <div className="user-avatar">RK</div>
          </div>
        </header>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* DASHBOARD */}

        {activePage === "Dashboard" && (
          <>
            <section className="welcome-section">
              <div>
                <p className="eyebrow">COMMAND OVERVIEW</p>
                <h2>Investigation & Intelligence Center</h2>
                <p className="muted">
                  A unified workspace for authorised investigations,
                  digital evidence preservation and public-source
                  intelligence.
                </p>
              </div>

              <div className="date-display">
                {systemStatus === "HEALTHY"
                  ? "SYSTEM ONLINE"
                  : systemStatus}
              </div>
            </section>

            <section className="stats-grid">
              <StatCard
                label="TOTAL INVESTIGATIONS"
                value={loading ? "..." : String(cases.length).padStart(2, "0")}
                icon="▣"
              />

              <StatCard
                label="LINKED EVIDENCE"
                value={loading ? "..." : String(evidenceCount).padStart(2, "0")}
                icon="◈"
              />

              <StatCard
                label="CASE ACTIVITIES"
                value={loading ? "..." : String(activities.length).padStart(2, "0")}
                icon="◎"
              />

              <StatCard
                label="BACKEND STATUS"
                value={systemStatus}
                icon="⌘"
              />
            </section>

            <CreateCase onCreated={handleCaseUpdated} />

            <section className="content-grid">
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent Investigations</h3>
                    <p>Live records from the case database</p>
                  </div>
                  <span className="panel-label">CASE REGISTER</span>
                </div>

                <CaseList
                  cases={cases.slice(0, 5)}
                  loading={loading}
                  onOpen={openCase}
                />

                <button
                  type="button"
                  className="workspace-action"
                  onClick={() => navigateTo("Investigations")}
                >
                  View all investigations →
                </button>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Platform Modules</h3>
                    <p>Current implementation status</p>
                  </div>
                </div>

                {[
                  ["Image Forensics", "Implemented"],
                  ["Evidence Management", "Implemented"],
                  ["Case Management", "Implemented"],
                  ["Public-Source Intelligence", "Implemented"],
                  ["Intelligence Correlation", "Planned"],
                  ["Report Generation", "Implemented"],
                ].map(([label, status]) => (
                  <div className="module-row" key={label}>
                    <span>{label}</span>
                    <span
                      className={
                        status === "Implemented"
                          ? "module-ready"
                          : "module-planned"
                      }
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h3>Investigation Activity</h3>
                  <p>Latest activity from the case database</p>
                </div>
                <span className="panel-label">ACTIVITY MONITOR</span>
              </div>

              {loading ? (
                <p className="muted">Loading activity...</p>
              ) : activities.length === 0 ? (
                <p className="muted">No activity recorded yet.</p>
              ) : (
                activities.map((activity) => (
                  <div className="activity-row" key={activity.activity_id}>
                    <span className="activity-dot"></span>
                    <div>
                      <strong>
                        {activity.activity_type.replaceAll("_", " ")}
                      </strong>
                      <p>{activity.description}</p>
                    </div>
                    <span className="activity-type">
                      {formatDate(activity.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {/* INVESTIGATIONS */}

        {activePage === "Investigations" && (
          <section className="panel workspace-panel">
            <div className="panel-heading">
              <div>
                <h3>Investigation Register</h3>
                <p>Browse and open existing investigation records.</p>
              </div>
              <span className="panel-label">CASE DATABASE</span>
            </div>

            <CreateCase onCreated={handleCaseUpdated} />

            <h3 className="workspace-subheading">
              Registered investigations
            </h3>

            <CaseList
              cases={cases}
              loading={loading}
              onOpen={openCase}
            />
          </section>
        )}

        {/* IMAGE FORENSICS */}

        {activePage === "Image Forensics" && (
          <section className="workspace-panel">
            {selectedImageCaseId ? (
              <div>
                <button
                  type="button"
                  className="workspace-action"
                  onClick={() => setSelectedImageCaseId(null)}
                  style={{ marginBottom: "18px" }}
                >
                  ← Back to investigations
                </button>

                <ImageInvestigation
                  caseId={selectedImageCaseId}
                  onComplete={handleCaseUpdated}
                />
              </div>
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Image Forensics Laboratory</h3>
                    <p>
                      Select an investigation to analyse and preserve
                      its image evidence.
                    </p>
                  </div>
                  <span className="panel-label">IMAGE ANALYSIS</span>
                </div>

                {cases.length === 0 ? (
                  <p className="muted">
                    Create an investigation before uploading image evidence.
                  </p>
                ) : (
                  <>
                    <p className="muted">
                      Select the investigation to which the image evidence
                      should be linked.
                    </p>

                    <div className="case-list">
                      {cases.map((item) => (
                        <div className="case-row" key={item.case_id}>
                          <div className="case-symbol">अ</div>

                          <div className="case-info">
                            <strong>{item.title}</strong>
                            <span>{item.case_id}</span>
                          </div>

                          <button
                            type="button"
                            className="workspace-action"
                            onClick={() =>
                              setSelectedImageCaseId(item.case_id)
                            }
                          >
                            Open image laboratory →
                          </button>
                        </div>
                      ))}
                    </div>

                    <p className="research-disclaimer">
                      Image analysis, evidence preservation and local
                      whole-image similarity searches are available
                      within the selected investigation.
                    </p>
                  </>
                )}
              </section>
            )}
          </section>
        )}

        {/* FACE INTELLIGENCE */}

        {activePage === "Face Intelligence" && (
          <FaceIntelligence />
        )}

        {/* EVIDENCE VAULT */}

        {activePage === "Evidence Vault" && (
          <EvidenceVault />
        )}

        {/* INTELLIGENCE NETWORK */}

        {activePage === "Intelligence Network" && (
          <section className="workspace-panel">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Public-Source Intelligence Network</h3>
                  <p>
                    Search permitted public sources using descriptive
                    text queries.
                  </p>
                </div>
                <span className="panel-label">OSINT WORKSPACE</span>
              </div>

              <ExternalIntelligence />
            </div>
          </section>
        )}

        {/* REPORTS */}

        {activePage === "Reports" && (
          <ReportsWorkspace cases={cases} />
        )}

        <footer>
          ANVĪKṢĀ INTEL · DIGITAL INVESTIGATION & INTELLIGENCE
          <span>DEVELOPMENT BUILD · NOT FOR OPERATIONAL USE</span>
        </footer>
      </main>
    </div>
  );
}

// REPORTS WORKSPACE

function ReportsWorkspace({
  cases,
}: {
  cases: InvestigationCase[];
}) {
  const [reports, setReports] =
    useState<(FaceAnalysisReportSummary & { case_id: string; case_title: string })[]>([]);

  const [selectedReport, setSelectedReport] =
    useState<FaceAnalysisReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const results = await Promise.all(
          cases.map(async (item) => {
            const response = await getFaceAnalysisReports(item.case_id);

            return response.reports.map((report) => ({
              ...report,
              case_id: item.case_id,
              case_title: item.title,
            }));
          })
        );

        if (!cancelled) {
          setReports(results.flat());
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve investigation reports."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [cases, refreshKey]);

  async function openReport(reportId: string) {
    try {
      setOpening(true);
      setError("");
      setSelectedReport(null);

      const result = await getFaceAnalysisReport(reportId);
      setSelectedReport(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open report."
      );
    } finally {
      setOpening(false);
    }
  }

  const analysis = selectedReport?.analysis as {
    image?: {
      width?: number;
      height?: number;
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
          reliable?: boolean;
          assessment?: string;
        };
      }>;
    };
    limitations?: string[];
  } | undefined;

  return (
    <section className="panel workspace-panel">
      <div className="panel-heading">
        <div>
          <h3>Investigation Reports</h3>
          <p>
            Saved facial-analysis reports across all investigations.
          </p>
        </div>

        <span className="panel-label">
          {reports.length} REPORTS
        </span>
      </div>

      <button
        type="button"
        className="workspace-action"
        onClick={() => setRefreshKey((value) => value + 1)}
        disabled={loading}
      >
        ↻ {loading ? "Loading..." : "Refresh reports"}
      </button>

      {loading ? (
        <p className="muted" style={{ marginTop: "20px" }}>
          Retrieving reports from investigation records...
        </p>
      ) : error && reports.length === 0 ? (
        <p className="error-message" style={{ marginTop: "20px" }}>
          {error}
        </p>
      ) : reports.length === 0 ? (
        <div className="module-placeholder" style={{ marginTop: "20px" }}>
          <div className="placeholder-icon">▤</div>
          <h3>No saved reports found</h3>
          <p>
            Save a facial-analysis report from Face Intelligence
            to see it listed here.
          </p>
        </div>
      ) : (
        <div className="case-list" style={{ marginTop: "20px" }}>
          {reports.map((report) => (
            <div
              className="case-row"
              key={report.report_id}
              style={{ display: "block", marginBottom: "14px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div className="case-symbol">▤</div>

                <div className="case-info" style={{ flex: 1, minWidth: 0 }}>
                  <strong>{report.report_id}</strong>
                  <span>{report.case_title}</span>
                  <span>Case: {report.case_id}</span>
                  <span>Evidence: {report.evidence_id}</span>
                  <span>Created: {formatDate(report.created_at)}</span>
                </div>

                <span className="module-ready">SAVED</span>
              </div>

              <button
                type="button"
                className="workspace-action"
                style={{ marginTop: "14px" }}
                onClick={() => openReport(report.report_id)}
                disabled={opening}
              >
                {opening ? "Opening..." : "Open report →"}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && reports.length > 0 && (
        <p className="error-message" style={{ marginTop: "14px" }}>
          {error}
        </p>
      )}

      {selectedReport && (
        <div className="panel" style={{ marginTop: "24px", padding: "18px" }}>
          <div className="panel-heading">
            <div>
              <h3>Report Details</h3>
              <p>Stored facial-analysis report</p>
            </div>
            <span className="panel-label">ANALYSIS RECORD</span>
          </div>

          <div className="detail-grid">
            <div>
              <small>REPORT ID</small>
              <strong>{selectedReport.report_id}</strong>
            </div>

            <div>
              <small>CASE ID</small>
              <strong>{selectedReport.case_id}</strong>
            </div>

            <div>
              <small>EVIDENCE ID</small>
              <strong>{selectedReport.evidence_id}</strong>
            </div>

            <div>
              <small>MODEL</small>
              <strong>{selectedReport.model_name || "Not specified"}</strong>
            </div>

            <div>
              <small>FACES DETECTED</small>
              <strong>
                {analysis?.face_analysis?.faces_detected ?? "N/A"}
              </strong>
            </div>

            <div>
              <small>IMAGE RESOLUTION</small>
              <strong>
                {analysis?.image?.width ?? "N/A"} ×{" "}
                {analysis?.image?.height ?? "N/A"}
              </strong>
            </div>

            <div>
              <small>CREATED AT</small>
              <strong>{formatDate(selectedReport.created_at)}</strong>
            </div>
          </div>

          <div style={{ marginTop: "18px" }}>
            <small>REPORT SHA-256</small>
            <p className="uuid-text" style={{ overflowWrap: "anywhere" }}>
              {selectedReport.report_sha256}
            </p>
          </div>

          {analysis?.face_analysis?.faces &&
            analysis.face_analysis.faces.length > 0 && (
              <>
                <h3 style={{ marginTop: "24px" }}>
                  Face Observations
                </h3>

                {analysis.face_analysis.faces.map((face, index) => (
                  <div
                    className="case-row"
                    key={face.face_number ?? index}
                    style={{ marginTop: "12px" }}
                  >
                    <strong>FACE {face.face_number ?? index + 1}</strong>

                    <div className="detail-grid" style={{ marginTop: "12px" }}>
                      <div>
                        <small>LANDMARK COUNT</small>
                        <strong>{face.landmark_count ?? "N/A"}</strong>
                      </div>

                      <div>
                        <small>IMAGE AREA</small>
                        <strong>
                          {face.image_area_percentage ?? "N/A"}
                          {face.image_area_percentage !== undefined ? "%" : ""}
                        </strong>
                      </div>

                      <div>
                        <small>SHARPNESS</small>
                        <strong>{face.quality?.sharpness ?? "N/A"}</strong>
                      </div>

                      <div>
                        <small>LIGHTING</small>
                        <strong>{face.quality?.lighting ?? "N/A"}</strong>
                      </div>

                      <div>
                        <small>POSE RELIABILITY</small>
                        <strong>
                          {face.head_pose?.reliable
                            ? "Reliable flag true"
                            : "Interpret cautiously"}
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

          {analysis?.limitations && analysis.limitations.length > 0 && (
            <div style={{ marginTop: "22px" }}>
              <h3>Analytical Limitations</h3>
              <ul style={{ paddingLeft: "20px" }}>
                {analysis.limitations.map((item, index) => (
                  <li
                    key={index}
                    className="muted"
                    style={{ marginTop: "8px" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="research-disclaimer" style={{ marginTop: "18px" }}>
            This report records automated visual analysis. It does not
            identify a person, establish identity, or establish image
            authenticity. The report checksum is not proof of evidentiary
            authenticity.
          </p>
        </div>
      )}

      {opening && (
        <p className="muted" style={{ marginTop: "12px" }}>
          Retrieving selected report...
        </p>
      )}
    </section>
  );
}

function CaseList({
  cases,
  loading,
  onOpen,
}: {
  cases: InvestigationCase[];
  loading: boolean;
  onOpen: (caseId: string) => void;
}) {
  if (loading) {
    return <p className="muted">Loading investigations...</p>;
  }

  if (cases.length === 0) {
    return <p className="muted">No investigation cases found.</p>;
  }

  return (
    <div className="case-list">
      {cases.map((item) => (
        <button
          type="button"
          className="case-row case-row-button"
          key={item.internal_id}
          onClick={() => onOpen(item.case_id)}
        >
          <div className="case-symbol">अ</div>
          <div className="case-info">
            <strong>{item.title}</strong>
            <span>
              {item.case_id} · {item.priority}
            </span>
          </div>
          <div className="case-status">{item.status}</div>
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>Live backend data</small>
    </div>
  );
}

export default App;
