import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // Allow up to 50MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.md' && ext !== '.markdown' && ext !== '.pdf' && ext !== '.txt') {
            return cb(new Error('Only .pdf, .md, .markdown, or .txt files are allowed.'));
        }
        cb(null, true);
    },
});

const unifiedSchema = {
    type: SchemaType.OBJECT,
    properties: {
        dashboard_summary: {
            type: SchemaType.OBJECT,
            properties: {
                framework: { type: SchemaType.STRING },
                overall_score: { type: SchemaType.NUMBER },
                letter_grade: { type: SchemaType.STRING, description: "CDP專用，例如 A, A-, B, C-" },
                dimension_scores: { type: SchemaType.OBJECT },
                radar_chart_data: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: { dimension: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } },
                        required: ["dimension", "score"]
                    }
                }
            },
            required: ["framework", "overall_score", "dimension_scores", "radar_chart_data"]
        },
        executive_diagnosis: {
            type: SchemaType.OBJECT,
            properties: {
                summary: { type: SchemaType.STRING },
                strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                gaps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                critical_missing_elements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            },
            required: ["summary", "strengths", "gaps", "critical_missing_elements"]
        },
        question_level_scoring: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    question_code: { type: SchemaType.STRING },
                    question_name: { type: SchemaType.STRING },
                    dimension: { type: SchemaType.STRING },
                    score: { type: SchemaType.NUMBER },
                    letter_grade: { type: SchemaType.STRING, description: "CDP專用字母分數" },
                    consistency_analysis: { type: SchemaType.STRING },
                    standard_requirement: { type: SchemaType.STRING },
                    evidence_excerpt: { type: SchemaType.STRING },
                    page_reference: { type: SchemaType.STRING }
                },
                required: ["question_code", "question_name", "dimension", "score", "consistency_analysis", "standard_requirement", "evidence_excerpt", "page_reference"]
            }
        },
        improvement_path: {
            type: SchemaType.OBJECT,
            properties: {
                improvement_actions: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            topic: { type: SchemaType.STRING },
                            gap: { type: SchemaType.STRING },
                            recommendation_zh: { type: SchemaType.STRING },
                            recommendation_en: { type: SchemaType.STRING },
                            benchmark_reference: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    company_name: { type: SchemaType.STRING },
                                    excerpt: { type: SchemaType.STRING },
                                    explanation: { type: SchemaType.STRING }
                                },
                                required: ["company_name", "excerpt", "explanation"],
                                description: "如果使用者有上傳標竿報告書，且該題項標竿企業做得較好，請提供參考片段。"
                            }
                        },
                        required: ["topic", "gap", "recommendation_zh", "recommendation_en"]
                    },
                },
            },
            required: ["improvement_actions"]
        },
        keyword_gap_analysis: {
            type: SchemaType.OBJECT,
            properties: {
                adjustments: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            question_code: { type: SchemaType.STRING },
                            current_wording: { type: SchemaType.STRING, description: "報告書中目前使用的不太精準的詞彙" },
                            required_keyword: { type: SchemaType.STRING, description: "準則中要求必須出現的標準專有名詞或關鍵字" },
                            explanation: { type: SchemaType.STRING, description: "為什麼需要把原本的詞換成標準要求用詞？若不換會被如何判定？" }
                        },
                        required: ["question_code", "current_wording", "required_keyword", "explanation"]
                    }
                }
            },
            required: ["adjustments"]
        },
        suggested_disclosure_text: {
            type: SchemaType.OBJECT,
            properties: {
                suggested_text: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            topic: { type: SchemaType.STRING },
                            text_zh: { type: SchemaType.STRING },
                            text_en: { type: SchemaType.STRING },
                        },
                        required: ["topic", "text_zh", "text_en"]
                    },
                },
            },
            required: ["suggested_text"]
        },
    },
    required: ["dashboard_summary", "executive_diagnosis", "question_level_scoring", "improvement_path", "keyword_gap_analysis", "suggested_disclosure_text"]
};

app.post('/api/analyze', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'benchmarkFile', maxCount: 1 }
]), async (req: Request, res: Response): Promise<void> => {
    try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const mainFile = files?.['file']?.[0];
        const benchmarkFile = files?.['benchmarkFile']?.[0];

        if (!mainFile) {
            res.status(400).json({ error: 'No main file uploaded or invalid file format.' });
            return;
        }

        const { framework } = req.body;
        if (!framework || (framework !== 'CDP' && framework !== 'CSA')) {
            res.status(400).json({ error: 'Missing or invalid framework parameter. Must be "CDP" or "CSA".' });
            return;
        }

        dotenv.config({ path: path.join(process.cwd(), '.env') });
        const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!geminiKey) {
            res.status(401).json({ error: '找不到 Gemini API Key。請確認 .env 檔案中 GEMINI_API_KEY 是否已經設定並且「存檔」。' });
            return;
        }

        // Initialize Google Gen AI
        const ai = new GoogleGenerativeAI(geminiKey);
        const fileManager = new GoogleAIFileManager(geminiKey);

        const criteriaFileName = framework === 'CDP' ? 'Full_Corporate_Questionnaire_Modules_1-6.txt' : 'CSA_requirement.txt';
        const criteriaFilePath = path.join(__dirname, 'criteria', criteriaFileName);

        if (!fs.existsSync(criteriaFilePath)) {
            res.status(500).json({ error: `Criteria file for ${framework} is missing. Please check the backend configuration.` });
            return;
        }
        let criteriaText = fs.readFileSync(criteriaFilePath, 'utf-8');
        // Prevent massive system instructions causing timeouts
        if (criteriaText.length > 300000) {
            criteriaText = criteriaText.substring(0, 300000);
        }

        console.log(`Analyzing file: ${mainFile.originalname} (${mainFile.size} bytes) for ${framework}...`);

        const uploadedMainFile = await fileManager.uploadFile(mainFile.path, {
            mimeType: mainFile.mimetype,
            displayName: mainFile.originalname,
        });

        let uploadedBenchmarkFile: any = null;
        if (benchmarkFile) {
            uploadedBenchmarkFile = await fileManager.uploadFile(benchmarkFile.path, {
                mimeType: benchmarkFile.mimetype,
                displayName: benchmarkFile.originalname,
            });
        }

        const waitForGeminiFile = async (fileName: string) => {
            let fileState = await fileManager.getFile(fileName);
            while (fileState.state === 'PROCESSING') {
                console.log(`Gemini is processing ${fileName}, waiting 3s...`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
                fileState = await fileManager.getFile(fileName);
            }
            if (fileState.state === 'FAILED') {
                throw new Error(`File processing failed for ${fileName} on Gemini servers.`);
            }
        };

        await waitForGeminiFile(uploadedMainFile.file.name);
        if (uploadedBenchmarkFile) {
            await waitForGeminiFile(uploadedBenchmarkFile.file.name);
        }

        const csaScoringRules = `
1. 【100分 - 標竿等級】：報告書中「明確且具體地說明」該 Criteria 的所有核心要求...
2. 【75分 - 達標等級】：報告書中有提到該 Criteria 的大部分要求...
3. 【50分 - 起步等級】：報告書中僅「模糊提及」該概念或有相關的名詞...
4. 【0分 - 缺失等級】：報告書中「完全沒有」提及該項目的任何相關內容...`;

        const cdpScoringRules = `
CDP 採用階層式字母評分，請依據報告書展現的成熟度給予對應字母與 Score：
- 【Leadership (A/A-) | Score: 100/85】
- 【Management (B/B-) | Score: 75/65】
- 【Awareness (C/C-) | Score: 50/40】
- 【Disclosure (D/D-) | Score: 25/10】
- 【未提及 (F) | Score: 0】`;

        const scoringRules = framework === 'CDP' ? cdpScoringRules : csaScoringRules;

        const systemInstruction = `你是一個專業且平衡的「AI ESG 永續評估引擎審計員」，具備豐富的 ESG 顧問與永續報告書輔導經驗。
你的任務是分析使用者上傳的內容，並「逐項」比對 ${framework} 評分項目檔案（Criteria）。

請依循以下規則來判斷分數：\n${scoringRules}\n
其他嚴格要求：
1. 深入子題項：必須針對具體的細部題項進行評分。
2. 逐題掃描：你必須檢視 Criteria 中的細部題項，找出最具代表性且報告書有詳細著墨或嚴重缺失的「20 個細部指標題項」。
3. 輸出必須是一個合法的 JSON Object，符合給定的 schema。所有 UI 內容使用繁體中文。請確實提供完整的 20 題分析，不可因為長度而隨意截斷。
4. 標竿分析：若有提供標竿報告書，請查閱對應此弱點的作法。

以下是完整的 Criteria：
---
${criteriaText}
---`;

        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: unifiedSchema,
                temperature: 0.2,
                maxOutputTokens: 65536, // Using the new massive 65k output limit to fit the entire JSON safely
            }
        });

        const arr: any[] = [
            { text: "這是目前正在受測的主要報告書：" },
            { fileData: { mimeType: uploadedMainFile.file.mimeType, fileUri: uploadedMainFile.file.uri } }
        ];
        if (uploadedBenchmarkFile) {
            arr.push({ text: "這是作為對手或典範的『標竿報告書』。請參考優秀的撰寫段落供建議：" });
            arr.push({ fileData: { mimeType: uploadedBenchmarkFile.file.mimeType, fileUri: uploadedBenchmarkFile.file.uri } });
        }
        arr.push({ text: "請深度分析我上傳的主力報告書，並依據上面的 Criteria 進行嚴格的評分與比對。請產出完整的分析報告，確保輸出 JSON 的所有欄位與結構完整。" });

        console.log("Calling single Gemini generation with 65K max output tokens...");
        const response = await model.generateContent(arr);

        let result;
        try {
            console.log("Parsing generated JSON...");
            result = JSON.parse(response.response.text());
        } catch (parseError) {
            console.error("JSON Parse Error. Output might still be truncated.", parseError);
            throw new Error("AI 產生的分析報告過長，導致資料不完整。請嘗試減少分析項目或再試一次。");
        }

        // Clean up temporary files
        try {
            await fileManager.deleteFile(uploadedMainFile.file.name);
            fs.unlinkSync(mainFile.path);
            if (uploadedBenchmarkFile) {
                await fileManager.deleteFile(uploadedBenchmarkFile.file.name);
                fs.unlinkSync(benchmarkFile.path);
            }
        } catch (cleanupErr) {
            console.error('Warning: Failed to cleanup files', cleanupErr);
        }

        res.json(result);
    } catch (error) {
        fs.appendFileSync('server_error.log', `[${new Date().toISOString()}] ESG Analysis Error: ${error instanceof Error ? error.stack : error}\n`);
        console.error("ESG Analysis Error:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to analyze ESG report.' });
    }
});

const server = app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
server.setTimeout(600000); // 10 minutes timeout
