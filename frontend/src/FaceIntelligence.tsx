
import { useEffect, useRef, useState } from "react";

import {
  analyseFaces,
  getCases,
  ingestEvidence,
  linkEvidenceToCase,
  getEvidenceManifest,
  saveFaceAnalysisReport,
  type FaceIntelligenceResponse,
  type InvestigationCase,
  type EvidenceManifest,
} from "./api";

import FaceComparison from "./FaceComparison";
import "./FaceIntelligence.css";

type FaceResult = {
  face_number: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  image_area_percentage: number;
  landmark_count: number;
  head_pose: {
    available: boolean;
    pitch_degrees?: number;
    yaw_degrees?: number;
    roll_degrees?: number;
    reliable?: boolean;
    assessment?: string;
    reason?: string;
  };
  quality: {
    blur_indicator: number | null;
    sharpness: string;
    brightness: number | null;
    lighting: string;
  };
  visibility_note: string;
};

type Analysis = {
  image: {
    width: number;
    height: number;
    size_bytes: number;
  };
  face_analysis: {
    faces_detected: number;
    model: string;
    landmark_model: string;
    faces: FaceResult[];
  };
  visualisation: {
    format: string;
    encoding: string;
    image: string;
  };
  limitations: string[];
};

export default function FaceIntelligence() {
  const fileInput = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<
    "image" | "comparison"
  >("image");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] =
    useState<FaceIntelligenceResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFace, setSelectedFace] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);

  // Investigation case states
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [casesLoading, setCasesLoading] = useState(false);
  const [caseLoadError, setCaseLoadError] = useState("");

  // Evidence storage states
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [evidenceId, setEvidenceId] = useState("");
  const [evidenceManifest, setEvidenceManifest] =
    useState<EvidenceManifest | null>(null);

  const [linkedCaseId, setLinkedCaseId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Persistent analysis report states
  const [savingReport, setSavingReport] = useState(false);
  const [reportId, setReportId] = useState("");
  const [reportHash, setReportHash] = useState("");
  const [reportMessage, setReportMessage] = useState("");

  const analysis = result?.analysis as unknown as Analysis | undefined;
  const faces = analysis?.face_analysis?.faces ?? [];
  const activeFace = faces[selectedFace];

  // Load available investigation cases
  useEffect(() => {
    let active = true;

    async function loadCases() {
      setCasesLoading(true);
      setCaseLoadError("");

      try {
        const response = await getCases();

        if (active) {
          setCases(response.cases);
        }
      } catch (err) {
        if (active) {
          setCaseLoadError(
            err instanceof Error
              ? err.message
              : "Unable to load investigation cases."
          );
        }
      } finally {
        if (active) {
          setCasesLoading(false);
        }
      }
    }

    loadCases();

    return () => {
      active = false;
    };
  }, []);

  // Select an image
  function selectFile(selected: File | undefined) {
    if (!selected || savingEvidence || savingReport) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(selected.type)
    ) {
      setError("Please select a JPEG, PNG or WEBP image.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError("Image exceeds the 10 MB upload limit.");
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError("");
    setSelectedFace(0);
    setShowOriginal(false);

    setEvidenceId("");
    setEvidenceManifest(null);
    setLinkedCaseId("");
    setSaveMessage("");

    setReportId("");
    setReportHash("");
    setReportMessage("");
  }

  // Run facial analysis
  async function runAnalysis() {
    if (!file || loading || savingReport) return;

    setLoading(true);
    setError("");
    setResult(null);

    setReportId("");
    setReportHash("");
    setReportMessage("");

    try {
      const response = await analyseFaces(file);
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Face analysis failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // Preserve original image and link it to an investigation
  async function saveAsEvidence() {
    if (
      !file ||
      !analysis ||
      !selectedCaseId ||
      savingEvidence ||
      savingReport
    ) {
      return;
    }

    setSavingEvidence(true);
    setError("");
    setSaveMessage("");

    try {
      let currentEvidenceId = evidenceId;

      if (!currentEvidenceId) {
        const stored = await ingestEvidence(file);

        currentEvidenceId = stored.manifest.evidence_id;
        setEvidenceId(currentEvidenceId);
      }

      const manifest = await getEvidenceManifest(currentEvidenceId);
      setEvidenceManifest(manifest);

      await linkEvidenceToCase(selectedCaseId, currentEvidenceId);

      setLinkedCaseId(selectedCaseId);

      setReportId("");
      setReportHash("");
      setReportMessage("");

      setSaveMessage(
        `Evidence successfully linked to ${selectedCaseId}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save or link evidence."
      );
    } finally {
      setSavingEvidence(false);
    }
  }

  // Save structured facial-analysis report
  async function saveAnalysisReport() {
    if (
      !analysis ||
      !evidenceId ||
      !selectedCaseId ||
      linkedCaseId !== selectedCaseId ||
      savingReport ||
      reportId
    ) {
      return;
    }

    setSavingReport(true);
    setError("");
    setReportMessage("");

    try {
      const response = await saveFaceAnalysisReport(
        selectedCaseId,
        evidenceId,
        analysis as unknown as Record<string, unknown>
      );

      const savedReport = response.report;

      setReportId(savedReport.report_id);
      setReportHash(savedReport.report_sha256);

      setReportMessage(
        `Analysis report successfully saved to ${selectedCaseId}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save analysis report."
      );
    } finally {
      setSavingReport(false);
    }
  }

  function formatBytes(bytes: number) {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <main className="face-lab">
      <header className="face-lab-header">
        <div>
          <div className="face-eyebrow">
            ANVĪKṢĀ INTEL / ANALYTICAL DIVISION
          </div>

          <h1>
            Face Intelligence <span>Laboratory</span>
          </h1>

          <p>
            Facial detection, landmark geometry and visual quality diagnostics.
          </p>
        </div>

        <div className="face-system-status">
          <span className="status-dot" />
          ANALYSIS ENGINE READY
        </div>
      </header>

      {/* MODE NAVIGATION */}
      <nav className="face-mode-bar">
        <button
          type="button"
          className={
            activeMode === "image"
              ? "face-mode active"
              : "face-mode"
          }
          onClick={() => setActiveMode("image")}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            font: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>01</span> IMAGE INVESTIGATION
        </button>

        <button
          type="button"
          className={
            activeMode === "comparison"
              ? "face-mode active"
              : "face-mode"
          }
          onClick={() => setActiveMode("comparison")}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            font: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>02</span> TWO-IMAGE COMPARISON
        </button>

        <div className="face-mode disabled">
          <span>03</span> LIVE CAMERA
          <small>COMING NEXT</small>
        </div>
      </nav>

      {activeMode === "comparison" ? (
        <FaceComparison />
      ) : (
        <>
          {/* SINGLE IMAGE WORKSPACE */}
          <section className="face-workspace">
            <div className="face-panel face-upload-panel">
              <div className="face-panel-heading">
                <span className="panel-index">01</span>

                <div>
                  <h2>Image evidence</h2>
                  <p>Upload an image for facial analysis</p>
                </div>
              </div>

              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={savingEvidence || savingReport}
                onChange={(event) =>
                  selectFile(event.target.files?.[0])
                }
              />

              <button
                className="face-upload-zone"
                onClick={() => fileInput.current?.click()}
                type="button"
                disabled={savingEvidence || savingReport}
              >
                <span className="upload-icon">＋</span>

                <strong>
                  {file ? file.name : "Select image evidence"}
                </strong>

                <span>
                  JPEG · PNG · WEBP · Maximum 10 MB
                </span>
              </button>

              {preview && (
                <div className="face-original-preview">
                  <img
                    src={preview}
                    alt="Original uploaded evidence"
                  />

                  <span>ORIGINAL IMAGE</span>
                </div>
              )}

              {file && (
                <div className="face-file-details">
                  <div>
                    <span>FILE SIZE</span>
                    <strong>{formatBytes(file.size)}</strong>
                  </div>

                  <div>
                    <span>FORMAT</span>
                    <strong>
                      {file.type.split("/")[1].toUpperCase()}
                    </strong>
                  </div>
                </div>
              )}

              <button
                className="face-analyse-button"
                onClick={runAnalysis}
                disabled={
                  !file ||
                  loading ||
                  savingEvidence ||
                  savingReport
                }
              >
                {loading
                  ? "PROCESSING IMAGE..."
                  : "RUN FACE ANALYSIS →"}
              </button>

              {error && (
                <div className="face-error">{error}</div>
              )}

              {loading && (
                <div className="face-processing">
                  <span className="processing-line" />
                  Running facial landmark inference...
                </div>
              )}
            </div>

            <div className="face-panel face-visual-panel">
              <div className="face-panel-heading">
                <span className="panel-index">02</span>

                <div>
                  <h2>Visual analysis</h2>
                  <p>Facial mesh and detection overlay</p>
                </div>

                {analysis && (
                  <span className="face-live-tag">PROCESSED</span>
                )}
              </div>

              {analysis ? (
                <>
                  <div className="face-image-view">
                    <img
                      src={
                        showOriginal
                          ? preview
                          : `data:image/jpeg;base64,${analysis.visualisation.image}`
                      }
                      alt={
                        showOriginal
                          ? "Original image"
                          : "Facial landmark analysis"
                      }
                    />

                    <span className="image-corner-label">
                      {showOriginal
                        ? "SOURCE IMAGE"
                        : "LANDMARK OVERLAY"}
                    </span>
                  </div>

                  <button
                    className="face-toggle-button"
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {showOriginal
                      ? "VIEW ANALYSED IMAGE"
                      : "VIEW ORIGINAL IMAGE"}
                  </button>
                </>
              ) : (
                <div className="face-empty-visual">
                  <div className="face-target">
                    <span>◎</span>
                  </div>

                  <strong>AWAITING IMAGE ANALYSIS</strong>

                  <p>
                    Upload an image and run the analysis engine.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ANALYSIS RESULTS */}
          {analysis && (
            <>
              <section className="face-stat-grid">
                <div className="face-stat">
                  <span>FACES DETECTED</span>
                  <strong>
                    {analysis.face_analysis.faces_detected}
                  </strong>
                </div>

                <div className="face-stat">
                  <span>IMAGE RESOLUTION</span>
                  <strong>
                    {analysis.image.width} × {analysis.image.height}
                  </strong>
                </div>

                <div className="face-stat">
                  <span>LANDMARK MODEL</span>
                  <strong>478 POINTS</strong>
                </div>

                <div className="face-stat">
                  <span>FILE SIZE</span>
                  <strong>
                    {formatBytes(analysis.image.size_bytes)}
                  </strong>
                </div>
              </section>

              {faces.length > 0 && (
                <section className="face-panel face-diagnostics">
                  <div className="face-panel-heading">
                    <span className="panel-index">03</span>

                    <div>
                      <h2>Face diagnostics</h2>
                      <p>
                        Observable geometry and image quality indicators
                      </p>
                    </div>
                  </div>

                  <div className="face-selector">
                    {faces.map((face, index) => (
                      <button
                        key={face.face_number}
                        className={
                          selectedFace === index ? "selected" : ""
                        }
                        onClick={() => setSelectedFace(index)}
                      >
                        FACE {face.face_number}
                      </button>
                    ))}
                  </div>

                  {activeFace && (
                    <div className="face-diagnostic-grid">
                      <div className="diagnostic-card">
                        <span>LANDMARKS</span>
                        <strong>{activeFace.landmark_count}</strong>
                        <small>Detected geometric points</small>
                      </div>

                      <div className="diagnostic-card">
                        <span>IMAGE AREA</span>
                        <strong>
                          {activeFace.image_area_percentage}%
                        </strong>
                        <small>
                          Approximate face bounding area
                        </small>
                      </div>

                      <div className="diagnostic-card">
                        <span>SHARPNESS</span>
                        <strong>
                          {activeFace.quality.sharpness}
                        </strong>
                        <small>
                          Blur indicator:{" "}
                          {activeFace.quality.blur_indicator ?? "N/A"}
                        </small>
                      </div>

                      <div className="diagnostic-card">
                        <span>LIGHTING</span>
                        <strong>
                          {activeFace.quality.lighting}
                        </strong>
                        <small>
                          Brightness:{" "}
                          {activeFace.quality.brightness ?? "N/A"}
                        </small>
                      </div>
                    </div>
                  )}

                  {activeFace && (
                    <>
                      <h3 className="face-subheading">
                        BOUNDING BOX GEOMETRY
                      </h3>

                      <div className="face-bbox-grid">
                        {Object.entries(
                          activeFace.bounding_box
                        ).map(([key, value]) => (
                          <div key={key}>
                            <span>{key.toUpperCase()}</span>
                            <strong>{value} PX</strong>
                          </div>
                        ))}
                      </div>

                      <h3 className="face-subheading">
                        HEAD ORIENTATION ESTIMATE
                      </h3>

                      {activeFace.head_pose.available ? (
                        <>
                          <div className="face-pose-grid">
                            <div>
                              <span>PITCH</span>
                              <strong>
                                {activeFace.head_pose.pitch_degrees}°
                              </strong>
                            </div>

                            <div>
                              <span>YAW</span>
                              <strong>
                                {activeFace.head_pose.yaw_degrees}°
                              </strong>
                            </div>

                            <div>
                              <span>ROLL</span>
                              <strong>
                                {activeFace.head_pose.roll_degrees}°
                              </strong>
                            </div>
                          </div>

                          <div
                            className={
                              activeFace.head_pose.reliable
                                ? "pose-note"
                                : "pose-note warning"
                            }
                          >
                            {activeFace.head_pose.assessment}

                            {!activeFace.head_pose.reliable &&
                              " — Do not interpret these angles as reliable measurements."}
                          </div>
                        </>
                      ) : (
                        <p className="face-muted">
                          {activeFace.head_pose.reason ??
                            "Pose estimate unavailable."}
                        </p>
                      )}

                      <p className="face-muted">
                        {activeFace.visibility_note}
                      </p>
                    </>
                  )}
                </section>
              )}

              {faces.length === 0 && (
                <section className="face-panel">
                  <h2>No faces detected</h2>

                  <p className="face-muted">
                    The model did not detect a face in this image.
                    This does not establish that a face is absent.
                  </p>
                </section>
              )}

              {/* INVESTIGATION EVIDENCE INTEGRATION */}
              <section className="face-panel face-diagnostics">
                <div className="face-panel-heading">
                  <span className="panel-index">04</span>

                  <div>
                    <h2>Investigation evidence integration</h2>
                    <p>
                      Preserve the original image and associate it
                      with an investigation.
                    </p>
                  </div>
                </div>

                <label
                  className="face-subheading"
                  htmlFor="face-case-select"
                >
                  SELECT INVESTIGATION CASE
                </label>

                <select
                  id="face-case-select"
                  value={selectedCaseId}
                  onChange={(event) => {
                    setSelectedCaseId(event.target.value);
                    setSaveMessage("");

                    setReportId("");
                    setReportHash("");
                    setReportMessage("");
                  }}
                  disabled={
                    casesLoading ||
                    savingEvidence ||
                    savingReport
                  }
                  style={{
                    width: "100%",
                    padding: "13px",
                    marginTop: "10px",
                    marginBottom: "16px",
                    background: "#171b19",
                    color: "#f2eee5",
                    border: "1px solid #8c7442",
                    borderRadius: "6px",
                  }}
                >
                  <option value="">
                    {casesLoading
                      ? "Loading cases..."
                      : "Choose an investigation"}
                  </option>

                  {cases.map((item) => (
                    <option
                      key={item.case_id}
                      value={item.case_id}
                    >
                      {item.case_id} — {item.title}
                    </option>
                  ))}
                </select>

                {caseLoadError && (
                  <div className="face-error">
                    {caseLoadError}
                  </div>
                )}

                {!casesLoading &&
                  !caseLoadError &&
                  cases.length === 0 && (
                    <p className="face-muted">
                      No investigation cases found. Create a case
                      before linking evidence.
                    </p>
                  )}

                <button
                  className="face-analyse-button"
                  type="button"
                  onClick={saveAsEvidence}
                  disabled={
                    !analysis ||
                    !file ||
                    !selectedCaseId ||
                    savingEvidence ||
                    savingReport ||
                    linkedCaseId === selectedCaseId
                  }
                >
                  {savingEvidence
                    ? "SAVING EVIDENCE..."
                    : linkedCaseId === selectedCaseId
                      ? "EVIDENCE LINKED SUCCESSFULLY"
                      : evidenceId
                        ? "LINK EXISTING EVIDENCE TO CASE"
                        : "SAVE ORIGINAL & LINK TO CASE"}
                </button>

                {saveMessage && (
                  <div className="pose-note">
                    {saveMessage}
                  </div>
                )}

                {evidenceManifest && (
                  <div className="face-file-details">
                    <div>
                      <span>EVIDENCE ID</span>
                      <strong>
                        {evidenceManifest.evidence_id}
                      </strong>
                    </div>

                    <div>
                      <span>ENCRYPTION</span>
                      <strong>
                        {evidenceManifest.encryption}
                      </strong>
                    </div>

                    <div>
                      <span>SHA-256</span>
                      <strong style={{ wordBreak: "break-all" }}>
                        {evidenceManifest.original_sha256}
                      </strong>
                    </div>

                    <div>
                      <span>STORAGE STATUS</span>
                      <strong>
                        {evidenceManifest.status}
                      </strong>
                    </div>
                  </div>
                )}

                <h3 className="face-subheading">
                  PERSISTENT ANALYSIS REPORT
                </h3>

                <p className="face-muted">
                  Save the structured facial-analysis results
                  against the selected investigation and its
                  linked original evidence.
                </p>

                <button
                  className="face-analyse-button"
                  type="button"
                  onClick={saveAnalysisReport}
                  disabled={
                    !analysis ||
                    !evidenceId ||
                    !selectedCaseId ||
                    linkedCaseId !== selectedCaseId ||
                    savingEvidence ||
                    savingReport ||
                    Boolean(reportId)
                  }
                >
                  {savingReport
                    ? "SAVING ANALYSIS REPORT..."
                    : reportId
                      ? "ANALYSIS REPORT SAVED"
                      : "SAVE ANALYSIS REPORT →"}
                </button>

                {reportMessage && (
                  <div className="pose-note">
                    {reportMessage}
                  </div>
                )}

                {reportId && (
                  <div className="face-file-details">
                    <div>
                      <span>REPORT ID</span>
                      <strong>{reportId}</strong>
                    </div>

                    <div>
                      <span>REPORT SHA-256</span>
                      <strong style={{ wordBreak: "break-all" }}>
                        {reportHash}
                      </strong>
                    </div>
                  </div>
                )}

                <p className="face-muted">
                  The original uploaded file is preserved separately
                  from the annotated facial-analysis image. The
                  report checksum verifies the stored report data;
                  it does not establish the authenticity of the
                  original image or the accuracy of the analysis.
                </p>
              </section>

              {/* ANALYTICAL LIMITATIONS */}
              <section className="face-panel face-limitations">
                <h2>Analytical limitations</h2>

                <ul>
                  {analysis.limitations.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      <footer className="face-lab-footer">
        ANVĪKṢĀ INTEL · DEVELOPMENT BUILD · NOT FOR OPERATIONAL USE
      </footer>
    </main>
  );
}
