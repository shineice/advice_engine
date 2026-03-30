export interface ESGAnalysisResult {
  dashboard_summary: {
    framework: string;
    report_language: 'en' | 'zh';
    overall_score: number;
    dimension_scores: Record<string, number>;
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

export async function analyzeESGReport(
  file: File,
  benchmarkFile?: File
): Promise<ESGAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (benchmarkFile) formData.append('benchmarkFile', benchmarkFile);

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
