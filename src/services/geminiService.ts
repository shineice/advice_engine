import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
  pdfBase64: string,
  framework: "CDP" | "CSA"
): Promise<ESGAnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `你是一個「AI ESG 永續評估引擎」，具備 10 年以上 ESG 顧問與永續報告書審查經驗。
你專精於 CDP (Carbon Disclosure Project) 與 S&P Global CSA (Corporate Sustainability Assessment)。
你的任務是分析永續報告書 PDF 並模擬專業評分。

嚴格遵守以下原則：
1. 依據文本證據，不可憑空假設。
2. 缺乏證據必須降低評分。
3. 輸出格式必須為 JSON。
4. 所有 UI 內容使用繁體中文。
5. **重要**：為了確保回應速度，請針對最關鍵的 8-10 個指標進行深度分析即可。

評估邏輯：
- CDP: 依照 CDP Climate Change Scoring Methodology (Disclosure, Awareness, Management, Leadership)。
- CSA: 使用 S&P Global CSA 評分邏輯，產業假設為 Steel (STL)。評估經濟與治理、環境、社會、產業特定、透明度。

必須輸出的 JSON 結構包含：
- dashboard_summary
- executive_diagnosis
- question_level_scoring (限制在 8-10 個關鍵題項)
- improvement_path
- keyword_gap_analysis
- suggested_disclosure_text`;

  const prompt = `請分析這份永續報告書，並使用 ${framework} 框架進行評估。請提供詳細的評分、診斷、改善建議與關鍵字缺口分析。`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dashboard_summary: {
              type: Type.OBJECT,
              properties: {
                framework: { type: Type.STRING },
                overall_score: { type: Type.NUMBER },
                dimension_scores: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
                radar_chart_data: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dimension: { type: Type.STRING },
                      score: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
            executive_diagnosis: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                critical_missing_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            question_level_scoring: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question_code: { type: Type.STRING },
                  question_name: { type: Type.STRING },
                  dimension: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  consistency_analysis: { type: Type.STRING },
                  standard_requirement: { type: Type.STRING },
                  evidence_excerpt: { type: Type.STRING },
                  page_reference: { type: Type.STRING },
                },
              },
            },
            improvement_path: {
              type: Type.OBJECT,
              properties: {
                improvement_actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic: { type: Type.STRING },
                      gap: { type: Type.STRING },
                      recommendation_zh: { type: Type.STRING },
                      recommendation_en: { type: Type.STRING },
                    },
                  },
                },
              },
            },
            keyword_gap_analysis: {
              type: Type.OBJECT,
              properties: {
                missing_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            suggested_disclosure_text: {
              type: Type.OBJECT,
              properties: {
                suggested_text: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic: { type: Type.STRING },
                      text_zh: { type: Type.STRING },
                      text_en: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
          required: [
            "dashboard_summary",
            "executive_diagnosis",
            "question_level_scoring",
            "improvement_path",
            "keyword_gap_analysis",
            "suggested_disclosure_text",
          ],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("ESG Analysis Error:", error);
    throw error;
  }
}
