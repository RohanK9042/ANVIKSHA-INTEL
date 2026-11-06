
const API_BASE_URL = "http://127.0.0.1:8000";

export interface InvestigationCase {
  internal_id: string;
  case_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface CaseActivity {
  activity_id: string;
  activity_type: string;
  description: string;
  timestamp: string;
}

export interface EvidenceRecord {
  evidence_id: string;
  linked_at: string;
}

async function apiRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export function getSystemHealth() {
  return apiRequest<{ status: string; service: string }>("/health");
}

export function getCases() {
  return apiRequest<{
    total: number;
    cases: InvestigationCase[];
  }>("/api/v1/cases");
}

export function getCaseEvidence(caseId: string) {
  return apiRequest<{
    case_id: string;
    total_evidence: number;
    evidence: EvidenceRecord[];
  }>(`/api/v1/cases/${encodeURIComponent(caseId)}/evidence`);
}

export function getCaseActivity(caseId: string) {
  return apiRequest<{
    case_id: string;
    total_activities: number;
    activities: CaseActivity[];
  }>(`/api/v1/cases/${encodeURIComponent(caseId)}/activity`);
}

export async function createCase(data: {
  title: string;
  description: string;
  priority: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/v1/cases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Unable to create investigation.");
  }

  return response.json();
}

export interface ImageAnalysisResult {
  status: string;
  filename: string;
  analysis: Record<string, unknown>;
}

export interface EvidenceIngestResult {
  status: string;
  message: string;
  manifest: {
    evidence_id: string;
    [key: string]: unknown;
  };
}

export async function analyseImage(file: File): Promise<ImageAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/image/analyse`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.status}`);
  }

  return response.json();
}

export async function ingestEvidence(
  file: File
): Promise<EvidenceIngestResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/evidence/ingest`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Evidence ingestion failed: ${response.status}`);
  }

  return response.json();
}
export async function linkEvidenceToCase(
  caseId: string,
  evidenceId: string
) {
  const endpoint =
    `${API_BASE_URL}/api/v1/cases/${encodeURIComponent(caseId)}/evidence` +
    `?evidence_id=${encodeURIComponent(evidenceId)}`;

  const response = await fetch(endpoint, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.detail || `Evidence linking failed: ${response.status}`
    );
  }

  return response.json();
}

// ==========================================
// EXTERNAL INTELLIGENCE - WIKIMEDIA SEARCH
// ==========================================

export interface WikipediaArticleResult {
  title: string;
  url: string | null;
  description: string;
  page_id: number | null;
  source: string;
  retrieved_at: string;
}

export interface WikimediaImageResult {
  title: string;
  image_url: string | null;
  original_url: string | null;
  source_page: string;
  license: string | null;
  artist: string | null;
  source: string;
  retrieved_at: string;
}

export interface WikimediaSearchResponse<T> {
  success: boolean;
  provider: string;
  result_count: number;
  results: T[];
}

async function wikimediaRequest<T>(
  endpoint: string,
  query: string,
  limit: number
): Promise<WikimediaSearchResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
    }),
  });

  if (!response.ok) {
    let message = `Search failed: ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}

export function searchWikipedia(
  query: string,
  limit = 10
) {
  return wikimediaRequest<WikipediaArticleResult>(
    "/api/v1/osint/wikimedia/articles",
    query,
    limit
  );
}

export function searchWikimediaImages(
  query: string,
  limit = 10
) {
  return wikimediaRequest<WikimediaImageResult>(
    "/api/v1/osint/wikimedia/images",
    query,
    limit
  );
}

export interface ImageIndexResult {
  status: string;
  evidence_id: string;
  indexed_at: string;
  fingerprint_method: string;
}

export interface SimilarImageMatch {
  evidence_id: string;
  similarity_score: number;
  hash_distance: number;
  indexed_width: number;
  indexed_height: number;
  indexed_at: string;
  match_method: string;
}

export interface ImageSimilarityResponse {
  status: string;
  query_evidence_id: string;
  provider: string;
  total_indexed_images: number;
  result_count: number;
  results: SimilarImageMatch[];
  limitations: string[];
}

export async function indexEvidenceImage(
  evidenceId: string
): Promise<ImageIndexResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/image-index/index/${encodeURIComponent(evidenceId)}`,
    { method: "POST" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Unable to index image.");
  }

  return response.json();
}

export async function searchSimilarEvidenceImages(
  evidenceId: string,
  limit = 10
): Promise<ImageSimilarityResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/image-index/search/${encodeURIComponent(evidenceId)}?limit=${limit}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Image similarity search failed.");
  }

  return response.json();
}

// ==========================================
// AEGIS INTEL - SOCIAL PROFILE SEARCH
// ==========================================

export interface SocialProfileResult {
  display_name: string | null;
  handle?: string;
  username?: string;
  account?: string;
  profile_url: string | null;
  description: string;
  avatar: string | null;
  source: string;
  retrieved_at: string;
  instance?: string;
}

export interface SocialSearchResponse {
  success: boolean;
  provider: string;
  query: string;
  result_count: number;
  results: SocialProfileResult[];
}

async function socialSearchRequest(
  endpoint: string,
  query: string,
  limit = 10
): Promise<SocialSearchResponse> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
    }),
  });

  if (!response.ok) {
    let message = `Social search failed: ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}

export function searchBlueskyProfiles(
  query: string,
  limit = 10
) {
  return socialSearchRequest(
    "/api/v1/osint/social/bluesky",
    query,
    limit
  );
}

export function searchMastodonProfiles(
  query: string,
  limit = 10
) {
  return socialSearchRequest(
    "/api/v1/osint/social/mastodon",
    query,
    limit
  );
}

 // ==========================================
 // EVIDENCE VAULT - MANIFEST & INTEGRITY
 // ==========================================

export interface EvidenceManifest {
  evidence_id: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  original_sha256: string;
  storage_filename: string;
  encryption: string;
  created_at: string;
  status: string;
}

export interface EvidenceVerificationResult {
  evidence_id: string;
  integrity_verified: boolean;
  original_sha256: string;
  calculated_sha256: string;
}

// Retrieve evidence manifest
export async function getEvidenceManifest(
  evidenceId: string
): Promise<EvidenceManifest> {
  return apiRequest<EvidenceManifest>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/manifest`
  );
}

// Verify evidence integrity
export async function verifyEvidence(
  evidenceId: string
): Promise<EvidenceVerificationResult> {
  return apiRequest<EvidenceVerificationResult>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/verify`
  );
}

// ==========================================
// CENTRAL EVIDENCE REGISTER
// ==========================================

export interface AllEvidenceResponse {
  total: number;
  evidence: EvidenceManifest[];
}

export async function getAllStoredEvidence(): Promise<AllEvidenceResponse> {
  return apiRequest<AllEvidenceResponse>("/api/v1/evidence");
}

// ==========================================
// FACE INTELLIGENCE LABORATORY
// ==========================================

export interface FaceIntelligenceResponse {
  status: string;
  filename: string;
  analysis: Record<string, unknown>;
}

export async function analyseFaces(
  file: File
): Promise<FaceIntelligenceResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/face-intelligence/analyse`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    let message = `Face analysis failed: ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}

// ==========================================
// FACE INTELLIGENCE - PERSISTENT REPORTS
// ==========================================

export interface FaceAnalysisReport {
  report_id: string;
  case_id: string;
  evidence_id: string;
  model_name: string | null;
  analysis: Record<string, unknown>;
  report_sha256: string;
  created_at: string;
}

export interface FaceAnalysisReportSummary {
  report_id: string;
  evidence_id: string;
  model_name: string | null;
  report_sha256: string;
  created_at: string;
}

export interface SaveFaceAnalysisReportResponse {
  status: string;
  message: string;
  report: FaceAnalysisReport & {
    status: string;
  };
}

export interface FaceAnalysisReportsResponse {
  case_id: string;
  total_reports: number;
  reports: FaceAnalysisReportSummary[];
}

// Save a facial-analysis report against a case and evidence
export async function saveFaceAnalysisReport(
  caseId: string,
  evidenceId: string,
  analysis: Record<string, unknown>
): Promise<SaveFaceAnalysisReportResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/cases/${encodeURIComponent(caseId)}/face-reports`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        evidence_id: evidenceId,
        analysis,
      }),
    }
  );

  if (!response.ok) {
    let message = `Unable to save facial-analysis report: ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}

// Retrieve all facial-analysis reports for a case
export async function getFaceAnalysisReports(
  caseId: string
): Promise<FaceAnalysisReportsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/cases/${encodeURIComponent(caseId)}/face-reports`
  );

  if (!response.ok) {
    let message = `Unable to retrieve facial-analysis reports: ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}

// Retrieve one complete facial-analysis report
export async function getFaceAnalysisReport(
  reportId: string
): Promise<FaceAnalysisReport> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/face-reports/${encodeURIComponent(reportId)}`
  );

  if (!response.ok) {
    let message = `Unable to retrieve facial-analysis report: ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}
