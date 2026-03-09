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

app.use(cors());
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
        const criteriaText = fs.readFileSync(criteriaFilePath, 'utf-8');

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

        // 3. Construct the prompt and System Instruction
        const systemInstruction = `你是一個「AI ESG 永續評估引擎」，具備 10 年以上 ESG 顧問與永續報告書審查經驗。
你的任務是分析使用者上傳的內容（例如 ESG 永續報告書 PDF），並嚴格比對我提供的 ${framework} 評分項目檔案（以下稱為 Criteria）。

嚴格遵守以下原則：
1. 目標：比較上傳資料與 Criteria 的要求，產出分數與具體的填答建議。你必須特別指出上傳檔案中缺失了 Criteria 的哪些重點。
2. 缺乏 Criteria 要求的證據必須降低評分，並在「一致性分析」描述缺口。
3. 輸出格式必須為 JSON，完全依照 schema。
4. 所有 UI 內容使用繁體中文。
5. **重要**：為了確保回應速度與準確度，請找出並深度分析 最關鍵且最具代表性的 8-10 個指標題項 即可。

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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
