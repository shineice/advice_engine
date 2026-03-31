export interface ESGAnalysisResult {
  dashboard_summary: {
    framework: string;
    report_language: 'en' | 'zh';
    overall_score: number;
    dimension_scores: Record<string, number>;
    criterion_scores?: Record<string, number>; // CSA weighted criterion breakdown
    radar_chart_data: { dimension: string; score: number }[];
  };
  executive_diagnosis: {
    summary: string;
    strengths: string[];
    gaps: string[];
    critical_missing_elements: string[];
  };
  question_level_scoring: {
    question_code: string;
    question_name: string;
    dimension: string;
    score: number;
    /** DJSI sub-option checklist: each item is one CSA criterion checkbox */
    sub_options: {
      option_text: string;
      /** 受評報告書是否明確涵蓋 */
      is_covered: boolean;
      /** 受評報告書的引用原文（is_covered=true 時） */
      evidence: string;
      /** 標竿報告書是否明確涵蓋（無標竿時為 false） */
      benchmark_covered: boolean;
      /** 標竿報告書的具體做法原文（benchmark_covered=true 時） */
      benchmark_evidence: string;
    }[];
    consistency_analysis: string;
    standard_requirement: string;
    evidence_excerpt: string;
    page_reference: string;
  }[];
  improvement_path: {
    improvement_actions: {
      topic: string;
      gap: string;
      recommendation_zh: string;
      recommendation_en: string;
      benchmark_reference?: {
        company_name: string;
        excerpt: string;
        explanation: string;
      };
    }[];
  };
  keyword_gap_analysis: {
    adjustments: {
      question_code: string;
      current_wording: string;
      required_keyword: string;
      current_wording_zh: string;
      required_keyword_zh: string;
      explanation: string;
    }[];
  };
  suggested_disclosure_text: {
    suggested_text: {
      topic: string;
      text_zh: string;
      text_en: string;
    }[];
  };
}

export interface HistoryRecord {
  id: number;
  filename: string;
  overall_score: number;
  report_language: 'en' | 'zh';
  created_at: string;
}

const getApiUrl = () => {
  // If explicitly set in .env, use that. Otherwise auto-detect from current hostname.
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return `${window.location.protocol}//${window.location.hostname}:3001`;
};

export async function fetchUrlText(url: string): Promise<{ url: string; text: string; length: number }> {
  const response = await fetch(`${getApiUrl()}/api/fetch-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch URL`);
  }
  return response.json();
}

export async function analyzeESGReport(
  file: File,
  benchmarkFile?: File,
  extraFiles?: File[],
  websiteTexts?: { url: string; text: string }[]
): Promise<ESGAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (benchmarkFile) formData.append('benchmarkFile', benchmarkFile);
  if (extraFiles) extraFiles.forEach(f => formData.append('extraFiles', f));
  if (websiteTexts && websiteTexts.length > 0)
    formData.append('websiteTexts', JSON.stringify(websiteTexts));

  const response = await fetch(`${getApiUrl()}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function fetchHistory(): Promise<HistoryRecord[]> {
  const response = await fetch(`${getApiUrl()}/api/results`);
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
}

export async function fetchResultById(id: number): Promise<{ result_json: ESGAnalysisResult } & HistoryRecord> {
  const response = await fetch(`${getApiUrl()}/api/results/${id}`);
  if (!response.ok) throw new Error('Failed to fetch result');
  return response.json();
}

export async function deleteResult(id: number): Promise<void> {
  await fetch(`${getApiUrl()}/api/results/${id}`, { method: 'DELETE' });
}
