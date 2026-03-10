export interface ESGAnalysisResult {
  dashboard_summary: {
    framework: string;
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
    }[];
  };
  keyword_gap_analysis: {
    missing_keywords: string[];
  };
  suggested_disclosure_text: {
    suggested_text: {
      topic: string;
      text_zh: string;
      text_en: string;
    }[];
  };
}

export async function analyzeESGReport(
  file: File,
  framework: "CDP" | "CSA"
): Promise<ESGAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('framework', framework);

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("ESG Analysis Error (Backend API):", error);
    throw error;
  }
}
