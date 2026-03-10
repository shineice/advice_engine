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

// Check API Key
if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not set in .env!");
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for disk storage to handle large files (>20MB) smoothly
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

// Helper to define response schema
const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        dashboard_summary: {
            type: SchemaType.OBJECT,
            properties: {
                framework: { type: SchemaType.STRING },
                overall_score: { type: SchemaType.NUMBER },
                dimension_scores: { type: SchemaType.OBJECT },
                radar_chart_data: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            dimension: { type: SchemaType.STRING },
                            score: { type: SchemaType.NUMBER },
                        },
                    },
                },
            },
            required: ["framework", "overall_score", "radar_chart_data"]
        },
        executive_diagnosis: {
            type: SchemaType.OBJECT,
            properties: {
                summary: { type: SchemaType.STRING },
                strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                gaps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                critical_missing_elements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
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
                    consistency_analysis: { type: SchemaType.STRING },
                    standard_requirement: { type: SchemaType.STRING },
                    evidence_excerpt: { type: SchemaType.STRING },
                    page_reference: { type: SchemaType.STRING },
                },
                required: ["question_code", "question_name", "dimension", "score", "consistency_analysis", "standard_requirement", "evidence_excerpt", "page_reference"]
            },
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
                missing_keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ["missing_keywords"]
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
};

app.post('/api/analyze', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded or invalid file format.' });
            return;
        }

        const { framework } = req.body;
        if (!framework || (framework !== 'CDP' && framework !== 'CSA')) {
            res.status(400).json({ error: 'Missing or invalid framework parameter. Must be "CDP" or "CSA".' });
            return;
        }

        // 1. Read the matching criteria file
        const criteriaFileName = framework === 'CDP'
            ? 'Full_Corporate_Questionnaire_Modules_1-6.txt'
            : 'CSA_requirement.txt';
        const criteriaFilePath = path.join(__dirname, 'criteria', criteriaFileName);

        if (!fs.existsSync(criteriaFilePath)) {
            res.status(500).json({ error: `Criteria file for ${framework} is missing. Please check the backend configuration.` });
            return;
        }
        let criteriaText = fs.readFileSync(criteriaFilePath, 'utf-8');
        // Prevent massive system instructions causing timeouts with large frameworks like CDP
        if (criteriaText.length > 600000) {
            console.log(`Truncating criteria text from ${criteriaText.length} to 600000 characters...`);
            criteriaText = criteriaText.substring(0, 600000);
        }

        console.log(`Analyzing file: ${req.file.originalname} (${req.file.size} bytes) for ${framework}...`);

        // 2. Upload the file to Gemini using File API (handles large files)
        const uploadedFile = await fileManager.uploadFile(req.file.path, {
            mimeType: req.file.mimetype,
            displayName: req.file.originalname,
        });
        console.log(`Uploaded to Gemini API as: ${uploadedFile.file.name}`);

        // Wait until the file is PROCESSED in Gemini
        let fileState = await fileManager.getFile(uploadedFile.file.name);
        while (fileState.state === 'PROCESSING') {
            console.log('Gemini is processing the file, waiting 3s...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
            fileState = await fileManager.getFile(uploadedFile.file.name);
        }

        if (fileState.state === 'FAILED') {
            throw new Error('File processing failed on Gemini servers.');
        }

        const systemInstruction = `你是一個專業且平衡的「AI ESG 永續評估引擎審計員」，具備豐富的 ESG 顧問與永續報告書輔導經驗。
你的任務是分析使用者上傳的內容，並「逐項」比對我提供的 ${framework} 評分項目檔案（以下稱為 Criteria），確定每一題都有評分到。

請依循以下「自訂評分級距與規則（Scoring Rules）」來判斷分數，絕不給予區間外其他的畸零分數：
1. 【100分 - 標竿等級】：報告書中「明確說明」該 Criteria 的所有核心要求，包含具體數據、中長期目標、基準年與完整的管理政策（如適用）。有高度說服力的實績。
2. 【75分 - 達標等級】：報告書中有提到該 Criteria 的大部分要求，包含管理方針或部分數據，但缺乏「量化目標」或「足夠的細節證據」。
3. 【50分 - 起步等級】：報告書中僅「模糊提及」該概念或有相關的名詞，但缺乏實質的管理政策、數據或任何具體行動方案支援。有提及就算數，但無法證明有在落實。
4. 【0分 - 缺失等級】：報告書中「完全沒有」提及該項目的任何相關內容，或提及的內容與 Criteria 完全扯不上關係。

其他嚴格要求：
1. 深入子題項 (Sub-questions)：你必須針對具體的細部題項進行評分（例如：深入到具體的問卷題目層級，如同 Criteria 檔案中的具體發問），「絕對不能」只給出大維度（例如：1.0 氣候變遷）的籠統概括分數。
2. 題號標記 (Question Codes)：在 JSON 輸出的 \`question_code\` 欄位中，你「必須」自己為每一題編上詳細的數字題號（例如：1.1, 1.2, 1.3 或 2.1.1），以對應其在該維度下的順序與階層，絕對不可以只填寫 "1" 或 "2" 這種單一數字大項。
3. 逐題掃描：你必須檢視 Criteria 中的細部題項，確認是否有在報告書中被提及，找出最具代表性且報告書有詳細著墨或嚴重缺失的 15-20 個「細部指標題項」做為最終 JSON 的呈現清單。
4. 驗證查核點 (Checkpoints)：在「一致性分析」中，簡短條列出該題的得分理由，例如：「符合：提及溫室氣體盤查。缺失：未說明範疇三數據，因此判為 75 分。」
5. 輸出格式必須為 JSON，完全依照指定的 schema。所有 UI 內容使用繁體中文。

以下是完整的 ${framework} 評分項目檔案（Criteria）：
---
${criteriaText}
---`;

        const prompt = `請分析我上傳的檔案，並依據上面的 ${framework} Criteria 進行深度比對。提出得分、弱點、以及符合更高分的建議填答方式（Suggested Disclosure）。`;

        // 4. Generate Content via Gemini
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash", // Using gemini-2.5-flash as it is supported by the user's preview API key
            systemInstruction,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2, // Low temperature for consistent scoring
            }
        });

        const response = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadedFile.file.mimeType,
                    fileUri: uploadedFile.file.uri
                }
            },
            { text: prompt },
        ]);

        const result = JSON.parse(response.response.text() || "{}");

        // 5. Clean up temporary files
        try {
            await fileManager.deleteFile(uploadedFile.file.name);
            fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {
            console.error('Warning: Failed to cleanup files', cleanupErr);
        }

        res.json(result);
    } catch (error) {
        console.error("ESG Analysis Error:", error);
        try {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (e) { }

        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to analyze ESG report.'
        });
    }
});

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
