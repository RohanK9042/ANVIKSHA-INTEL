
import { useEffect, useState } from "react";
import {
  analyseFaces,
  type FaceIntelligenceResponse,
} from "./api";

import "./FaceIntelligence.css";

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
    faces: Array<{
      face_number: number;
      landmark_count: number;
      image_area_percentage: number;
      quality: {
        sharpness: string;
        lighting: string;
        brightness: number | null;
        blur_indicator: number | null;
      };
      head_pose: {
        available: boolean;
        pitch_degrees?: number;
        yaw_degrees?: number;
        roll_degrees?: number;
        reliable?: boolean;
        assessment?: string;
      };
      visibility_note: string;
    }>;
  };
  visualisation: {
    format: string;
    encoding: string;
    image: string;
  };
  limitations: string[];
};

type ImageResult = {
  file: File;
  preview: string;
  result: FaceIntelligenceResponse;
};

export default function FaceComparison() {
  const [imageA, setImageA] = useState<ImageResult | null>(null);
  const [imageB, setImageB] = useState<ImageResult | null>(null);

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const [error, setError] = useState("");
  const [comparisonStarted, setComparisonStarted] = useState(false);

  useEffect(() => {
    return () => {
      if (imageA) URL.revokeObjectURL(imageA.preview);
      if (imageB) URL.revokeObjectURL(imageB.preview);
    };
  }, [imageA, imageB]);

  function validateFile(file: File): string | null {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return "Please select a JPEG, PNG or WEBP image.";
    }

    if (file.size > 10 * 1024 * 1024) {
      return "Image exceeds the 10 MB upload limit.";
    }

    return null;
  }

  function selectImage(file: File | undefined, side: "A" | "B") {
    if (!file) return;

    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setComparisonStarted(false);

    const newImage = {
      file,
      preview: URL.createObjectURL(file),
      result: null as unknown as FaceIntelligenceResponse,
    };

    if (side === "A") {
      setImageA(newImage);
    } else {
      setImageB(newImage);
    }
  }

  async function analyseImage(side: "A" | "B") {
    const selected = side === "A" ? imageA : imageB;

    if (!selected) return;

    if (side === "A") setLoadingA(true);
    else setLoadingB(true);

    setError("");
    setComparisonStarted(false);

    try {
      const result = await analyseFaces(selected.file);

      const updated = {
        ...selected,
        result,
      };

      if (side === "A") setImageA(updated);
      else setImageB(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Image ${side}: ${err.message}`
          : `Image ${side} analysis failed.`
      );
    } finally {
      if (side === "A") setLoadingA(false);
      else setLoadingB(false);
    }
  }

  function getAnalysis(image: ImageResult | null): Analysis | null {
    if (!image?.result) return null;

    return image.result.analysis as unknown as Analysis;
  }

  const analysisA = getAnalysis(imageA);
  const analysisB = getAnalysis(imageB);

  const faceA = analysisA?.face_analysis.faces[0] ?? null;
  const faceB = analysisB?.face_analysis.faces[0] ?? null;

  function compareValue(
    a: string | number | null | undefined,
    b: string | number | null | undefined
  ) {
    if (a === null || a === undefined) return "Unavailable";
    if (b === null || b === undefined) return "Unavailable";

    if (a === b) return "Same reported value";

    return "Different reported values";
  }

  return (
    <main className="face-lab">
      <header className="face-lab-header">
        <div>
          <div className="face-eyebrow">
            ANVĪKṢĀ INTEL / COMPARATIVE ANALYSIS
          </div>

          <h1>
            Two-Image <span>Visual Comparison</span>
          </h1>

          <p>
            Independent facial detection and comparison of observable
            image characteristics.
          </p>
        </div>

        <div className="face-system-status">
          <span className="status-dot" />
          COMPARISON ENGINE READY
        </div>
      </header>

      <section className="face-workspace">
        <ImageUploadPanel
          label="IMAGE A"
          image={imageA}
          loading={loadingA}
          onSelect={(file) => selectImage(file, "A")}
          onAnalyse={() => analyseImage("A")}
        />

        <ImageUploadPanel
          label="IMAGE B"
          image={imageB}
          loading={loadingB}
          onSelect={(file) => selectImage(file, "B")}
          onAnalyse={() => analyseImage("B")}
        />
      </section>

      {error && <div className="face-error">{error}</div>}

      <button
        type="button"
        className="face-analyse-button"
        disabled={
          !analysisA ||
          !analysisB ||
          loadingA ||
          loadingB
        }
        onClick={() => setComparisonStarted(true)}
      >
        GENERATE VISUAL COMPARISON →
      </button>

      {comparisonStarted && analysisA && analysisB && (
        <>
          <section className="face-stat-grid">
            <div className="face-stat">
              <span>IMAGE A FACES</span>
              <strong>
                {analysisA.face_analysis.faces_detected}
              </strong>
            </div>

            <div className="face-stat">
              <span>IMAGE B FACES</span>
              <strong>
                {analysisB.face_analysis.faces_detected}
              </strong>
            </div>

            <div className="face-stat">
              <span>IMAGE A RESOLUTION</span>
              <strong>
                {analysisA.image.width} × {analysisA.image.height}
              </strong>
            </div>

            <div className="face-stat">
              <span>IMAGE B RESOLUTION</span>
              <strong>
                {analysisB.image.width} × {analysisB.image.height}
              </strong>
            </div>
          </section>

          <section className="face-panel face-diagnostics">
            <div className="face-panel-heading">
              <span className="panel-index">01</span>
              <div>
                <h2>Visual comparison results</h2>
                <p>
                  Independently generated image measurements.
                </p>
              </div>
            </div>

            <div className="face-workspace">
              <ComparisonImage
                label="IMAGE A ANALYSIS"
                analysis={analysisA}
              />

              <ComparisonImage
                label="IMAGE B ANALYSIS"
                analysis={analysisB}
              />
            </div>

            <h3 className="face-subheading">
              OBSERVABLE CHARACTERISTICS
            </h3>

            <div className="face-comparison-table">
              <div className="comparison-row comparison-header">
                <span>CHARACTERISTIC</span>
                <span>IMAGE A</span>
                <span>IMAGE B</span>
              </div>

              <ComparisonRow
                label="Faces detected"
                a={analysisA.face_analysis.faces_detected}
                b={analysisB.face_analysis.faces_detected}
              />

              <ComparisonRow
                label="Image resolution"
                a={`${analysisA.image.width} × ${analysisA.image.height}`}
                b={`${analysisB.image.width} × ${analysisB.image.height}`}
              />

              <ComparisonRow
                label="Image size"
                a={`${(analysisA.image.size_bytes / 1024).toFixed(1)} KB`}
                b={`${(analysisB.image.size_bytes / 1024).toFixed(1)} KB`}
              />

              <ComparisonRow
                label="Landmark model"
                a={analysisA.face_analysis.landmark_model}
                b={analysisB.face_analysis.landmark_model}
              />

              <ComparisonRow
                label="Detected landmarks"
                a={faceA ? faceA.landmark_count : "No face detected"}
                b={faceB ? faceB.landmark_count : "No face detected"}
              />

              <ComparisonRow
                label="Sharpness"
                a={faceA?.quality.sharpness ?? "Unavailable"}
                b={faceB?.quality.sharpness ?? "Unavailable"}
              />

              <ComparisonRow
                label="Lighting"
                a={faceA?.quality.lighting ?? "Unavailable"}
                b={faceB?.quality.lighting ?? "Unavailable"}
              />

              <ComparisonRow
                label="Brightness"
                a={faceA?.quality.brightness ?? "Unavailable"}
                b={faceB?.quality.brightness ?? "Unavailable"}
              />

              <ComparisonRow
                label="Pose estimate available"
                a={faceA?.head_pose.available ? "Yes" : "No"}
                b={faceB?.head_pose.available ? "Yes" : "No"}
              />
            </div>
          </section>

          <section className="face-panel face-diagnostics">
            <div className="face-panel-heading">
              <span className="panel-index">02</span>
              <div>
                <h2>Measurement observations</h2>
                <p>
                  Differences in recorded diagnostic values.
                </p>
              </div>
            </div>

            {faceA && faceB ? (
              <>
                <Observation
                  title="Landmark detection"
                  value={compareValue(
                    faceA.landmark_count,
                    faceB.landmark_count
                  )}
                  description="Number of geometric landmarks detected on the first detected face in each image."
                />

                <Observation
                  title="Sharpness classification"
                  value={compareValue(
                    faceA.quality.sharpness,
                    faceB.quality.sharpness
                  )}
                  description="The reported image sharpness classifications."
                />

                <Observation
                  title="Lighting classification"
                  value={compareValue(
                    faceA.quality.lighting,
                    faceB.quality.lighting
                  )}
                  description="The reported lighting classifications."
                />

                <Observation
                  title="Face bounding area"
                  value={compareValue(
                    faceA.image_area_percentage,
                    faceB.image_area_percentage
                  )}
                  description="Approximate percentage of each image occupied by the detected face bounding box."
                />
              </>
            ) : (
              <p className="face-muted">
                A first detected face was not available in both images.
                Face-specific observations cannot be compared.
              </p>
            )}
          </section>

          <section className="face-panel face-limitations">
            <h2>Interpretation and limitations</h2>

            <ul>
              <li>
                Each image was analysed independently by the facial
                detection model.
              </li>
              <li>
                Different measurements do not establish that two images
                depict different people.
              </li>
              <li>
                Similar measurements do not establish that two images
                depict the same person.
              </li>
              <li>
                Lighting, camera angle, resolution, expression and
                image quality can affect the measurements.
              </li>
              <li>
                Head orientation estimates may be unreliable and should
                be interpreted cautiously.
              </li>
              <li>
                This feature does not perform facial recognition,
                biometric identity matching or identity verification.
              </li>
            </ul>
          </section>
        </>
      )}

      <footer className="face-lab-footer">
        ANVĪKṢĀ INTEL · DEVELOPMENT BUILD · NOT FOR OPERATIONAL USE
      </footer>
    </main>
  );
}

function ImageUploadPanel({
  label,
  image,
  loading,
  onSelect,
  onAnalyse,
}: {
  label: string;
  image: ImageResult | null;
  loading: boolean;
  onSelect: (file: File | undefined) => void;
  onAnalyse: () => void;
}) {
  return (
    <div className="face-panel face-upload-panel">
      <div className="face-panel-heading">
        <span className="panel-index">
          {label === "IMAGE A" ? "01" : "02"}
        </span>

        <div>
          <h2>{label}</h2>
          <p>Select an image for independent analysis</p>
        </div>
      </div>

      <label className="face-upload-zone">
        <span className="upload-icon">＋</span>
        <strong>
          {image ? image.file.name : `Select ${label}`}
        </strong>
        <span>JPEG · PNG · WEBP · Maximum 10 MB</span>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            onSelect(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {image && (
        <>
          <div className="face-original-preview">
            <img src={image.preview} alt={`${label} original`} />
            <span>ORIGINAL IMAGE</span>
          </div>

          <button
            type="button"
            className="face-analyse-button"
            onClick={onAnalyse}
            disabled={loading}
          >
            {loading ? "ANALYSING..." : `ANALYSE ${label} →`}
          </button>

          {image.result && (
            <div className="pose-note">
              Analysis complete ·{" "}
              {(
                image.result.analysis as unknown as Analysis
              ).face_analysis.faces_detected}{" "}
              face(s) detected
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ComparisonImage({
  label,
  analysis,
}: {
  label: string;
  analysis: Analysis;
}) {
  return (
    <div className="face-panel">
      <h3>{label}</h3>

      <div className="face-image-view">
        <img
          src={`data:image/jpeg;base64,${analysis.visualisation.image}`}
          alt={label}
        />
      </div>

      <p className="face-muted">
        {analysis.face_analysis.faces_detected} face(s) detected
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  a,
  b,
}: {
  label: string;
  a: string | number;
  b: string | number;
}) {
  return (
    <div className="comparison-row">
      <span>{label}</span>
      <strong>{a}</strong>
      <strong>{b}</strong>
    </div>
  );
}

function Observation({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="module-row"
      style={{ display: "block", padding: "14px 0" }}
    >
      <strong>{title}</strong>
      <p style={{ margin: "7px 0" }}>{value}</p>
      <small className="face-muted">{description}</small>
    </div>
  );
}
