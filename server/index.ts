import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createRequire } from 'module';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

import { CRITERION_WEIGHTS, QUESTIONS, extractJson, repairTruncatedJson, calculateCSAWeightedScore } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// ─── SQLite ──────────────────────────────────────────────────────────────────
const dbPath = process.env.NODE_ENV === 'test'
    ? ':memory:'
    : path.join(__dirname, '..', 'results.db');
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL, overall_score INTEGER, report_language TEXT,
  result_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
const insertResult   = db.prepare(`INSERT INTO analysis_results (filename,overall_score,report_language,result_json) VALUES (@filename,@overall_score,@report_language,@result_json)`);
const listResults    = db.prepare(`SELECT id,filename,overall_score,report_language,created_at FROM analysis_results ORDER BY created_at DESC LIMIT 50`);
const getResultById  = db.prepare(`SELECT * FROM analysis_results WHERE id = ?`);
const deleteResultById = db.prepare(`DELETE FROM analysis_results WHERE id = ?`);

// ─── History Endpoints ───────────────────────────────────────────────────────
app.get('/api/results', (_req: Request, res: Response) => {
    try { res.json(listResults.all()); }
    catch { res.status(500).json({ error: 'Failed to fetch results.' }); }
});
app.get('/api/results/:id', (req: Request, res: Response) => {
    try {
        const row = getResultById.get(Number(req.params.id)) as any;
        if (!row) { res.status(404).json({ error: 'Result not found.' }); return; }
        res.json({ ...row, result_json: JSON.parse(row.result_json) });
    } catch { res.status(500).json({ error: 'Failed to fetch result.' }); }
});
app.delete('/api/results/:id', (req: Request, res: Response) => {
    try { deleteResultById.run(Number(req.params.id)); res.json({ success: true }); }
    catch { res.status(500).json({ error: 'Failed to delete result.' }); }
});
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── URL Fetch Endpoint ───────────────────────────────────────────────────────
app.post('/api/fetch-url', async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body;
    if (!url) { res.status(400).json({ error: 'URL is required.' }); return; }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const httpRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (ESG-Engine/2.0)' },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const html = await httpRes.text();
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 12000);
        res.json({ url, text, length: text.length });
    } catch (err: any) {
        res.status(400).json({ error: `無法抓取網頁：${err?.message ?? err}` });
    }
});

// CRITERION_WEIGHTS, QUESTIONS, calculateCSAWeightedScore imported from ./utils.js

// ─── File Upload ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.md', '.markdown', '.pdf', '.txt'].includes(ext))
            return cb(new Error('Only .pdf, .md, .markdown, or .txt files are allowed.'));
        cb(null, true);
    },
});

// multer fields config — used in /api/analyze
const analyzeUpload = upload.fields([
    { name: 'file',          maxCount: 1 },   // main report (required)
    { name: 'benchmarkFile', maxCount: 1 },   // benchmark report (optional)
    { name: 'extraFiles',    maxCount: 5 },   // annual reports / website exports / other
]);

// QUESTIONS imported from ./utils.js

const DIM_NAMES: Record<string, string> = {
    '03': '#03 Governance & Economic Dimension',
    '04': '#04 Environmental Dimension',
    '05': '#05 Social Dimension',
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
const subOptionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        option_text: {
            type: SchemaType.STRING,
            description: '從 CSA Criteria 擷取的子選項內容（例如：「確信範圍涵蓋環境 KPI」）',
        },
        is_covered: {
            type: SchemaType.BOOLEAN,
            description: '【受評報告書】是否明確且具體地涵蓋此子選項（模糊提及或間接相關不算）',
        },
        evidence: {
            type: SchemaType.STRING,
            description: '【受評報告書】若 is_covered=true，填入原文佐證（50字以內）；false 則填空字串',
        },
        benchmark_covered: {
            type: SchemaType.BOOLEAN,
            description: '【標竿報告書】是否明確且具體地涵蓋此子選項。若無標竿報告書則填 false',
        },
        benchmark_evidence: {
            type: SchemaType.STRING,
            description: '【標竿報告書】若 benchmark_covered=true，填入標竿報告書的對應原文（60字以內）；否則填空字串',
        },
    },
    required: ['option_text', 'is_covered', 'evidence', 'benchmark_covered', 'benchmark_evidence'],
};

const scoringItemSchema = {
    type: SchemaType.OBJECT,
    properties: {
        question_code:        { type: SchemaType.STRING },
        question_name:        { type: SchemaType.STRING, description: '繁體中文題目簡稱（15字以內）' },
        dimension:            { type: SchemaType.STRING },
        score:                { type: SchemaType.NUMBER, description: 'ROUND((is_covered=true 的數量 / sub_options 總數) × 100)' },
        sub_options: {
            type: SchemaType.ARRAY,
            items: subOptionSchema,
            description: '此題在 CSA Criteria 中的所有子選項，每項皆須逐一勾核',
        },
        consistency_analysis: { type: SchemaType.STRING, description: '整體一致性說明（80字以內）' },
        standard_requirement: { type: SchemaType.STRING, description: 'CSA 對此題的核心要求（50字以內）' },
        evidence_excerpt:     { type: SchemaType.STRING, description: '報告書中最具代表性的引用段落（60字以內）' },
        page_reference:       { type: SchemaType.STRING },
    },
    required: ['question_code','question_name','dimension','score','sub_options',
               'consistency_analysis','standard_requirement','evidence_excerpt','page_reference'],
};

const keywordItemSchema = {
    type: SchemaType.OBJECT,
    properties: {
        question_code:      { type: SchemaType.STRING },
        current_wording:    { type: SchemaType.STRING },
        required_keyword:   { type: SchemaType.STRING },
        current_wording_zh: { type: SchemaType.STRING },
        required_keyword_zh:{ type: SchemaType.STRING },
        explanation:        { type: SchemaType.STRING },
    },
    required: ['question_code','current_wording','required_keyword',
               'current_wording_zh','required_keyword_zh','explanation'],
};

// Agent 1/2/3 schema — scoring only for one dimension
const dimensionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        dimension_score:       { type: SchemaType.NUMBER },
        question_level_scoring: { type: SchemaType.ARRAY, items: scoringItemSchema },
        keyword_adjustments:   { type: SchemaType.ARRAY, items: keywordItemSchema },
    },
    required: ['dimension_score','question_level_scoring','keyword_adjustments'],
};

// Agent 4 schema — synthesis (no question scoring)
const synthesisSchema = {
    type: SchemaType.OBJECT,
    properties: {
        report_language: { type: SchemaType.STRING },
        overall_score:   { type: SchemaType.NUMBER },
        radar_chart_data: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: { dimension: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } },
                required: ['dimension','score'],
            },
        },
        executive_diagnosis: {
            type: SchemaType.OBJECT,
            properties: {
                summary:   { type: SchemaType.STRING },
                strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                gaps:      { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                critical_missing_elements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ['summary','strengths','gaps','critical_missing_elements'],
        },
        improvement_path: {
            type: SchemaType.OBJECT,
            properties: {
                improvement_actions: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            topic:             { type: SchemaType.STRING },
                            gap:               { type: SchemaType.STRING },
                            recommendation_zh: { type: SchemaType.STRING },
                            recommendation_en: { type: SchemaType.STRING },
                            benchmark_reference: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    company_name: { type: SchemaType.STRING },
                                    excerpt:      { type: SchemaType.STRING },
                                    explanation:  { type: SchemaType.STRING },
                                },
                                required: ['company_name','excerpt','explanation'],
                            },
                        },
                        required: ['topic','gap','recommendation_zh','recommendation_en'],
                    },
                },
            },
            required: ['improvement_actions'],
        },
        suggested_disclosure_text: {
            type: SchemaType.OBJECT,
            properties: {
                suggested_text: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            topic:   { type: SchemaType.STRING },
                            text_zh: { type: SchemaType.STRING },
                            text_en: { type: SchemaType.STRING },
                        },
                        required: ['topic','text_zh','text_en'],
                    },
                },
            },
            required: ['suggested_text'],
        },
    },
    required: ['report_language','overall_score','radar_chart_data','executive_diagnosis',
               'improvement_path','suggested_disclosure_text'],
};

// Agent 5 schema — web-search benchmark results (no JSON schema constraint, just for formatting call)
const webSearchResultSchema = {
    type: SchemaType.OBJECT,
    properties: {
        benchmark_references: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    topic:        { type: SchemaType.STRING, description: 'CSA 題項名稱（與 improvement_actions 對應）' },
                    company_name: { type: SchemaType.STRING },
                    excerpt:      { type: SchemaType.STRING, description: '該公司報告書或官網的具體揭露段落（50字以內）' },
                    explanation:  { type: SchemaType.STRING, description: '為何這份揭露值得學習（50字以內）' },
                    source_url:   { type: SchemaType.STRING, description: '資料來源 URL（若可取得）' },
                },
                required: ['topic', 'company_name', 'excerpt', 'explanation'],
            },
        },
    },
    required: ['benchmark_references'],
};

// extractJson, repairTruncatedJson imported from ./utils.js
// safeParseJson wrapper (with file logging) kept here
function safeParseJson(raw: string, label: string): any {
    const cleaned = extractJson(raw);
    try { return JSON.parse(cleaned); } catch { /* try repair */ }

    const repaired = repairTruncatedJson(cleaned);
    try {
        const result = JSON.parse(repaired);
        console.warn(`[ESG Engine] JSON repaired (${label}): raw=${raw.length} repaired=${repaired.length}`);
        return result;
    } catch { /* fall through to error */ }

    const preview = cleaned.substring(0, 600);
    fs.appendFileSync('server_error.log',
        `[${new Date().toISOString()}] JSON parse failed (${label})\n` +
        `  raw.length=${raw.length}  cleaned.length=${cleaned.length}\n` +
        `  preview: ${preview}\n`);
    console.error(`[ESG Engine] JSON parse failed (${label}). Raw=${raw.length}\n${preview}`);
    throw new Error(`${label} returned invalid JSON. Raw length: ${raw.length}`);
}

// ─── Scoring Rules ────────────────────────────────────────────────────────────
const csaScoringRules = `
【CSA / DJSI 子選項評分邏輯 — 請嚴格依照以下 5 個步驟執行】

步驟 1：閱讀該題在 Criteria 中的「Question Layout」與「Assessment Focus」，
        找出所有「評分子選項」（checkbox 項目或 sub-criteria）。
        若 Criteria 沒有明確條列，請從題目要求中自行拆解出 3~8 個核心子要素。

步驟 2：對每個子選項，在報告書（及上傳的公開網站內容，若有）中
        逐字尋找是否有「明確且具體」的對應描述。
        ✅ 算明確涵蓋：有清楚文字、數據、政策聲明或流程描述，可直接對應到該子選項
        ❌ 不算明確涵蓋：模糊提及、間接相關、使用了相近但不夠精確的詞彙

步驟 3：將每個子選項填入 sub_options 陣列，每筆需填寫四個欄位：
        ① is_covered / evidence：針對「受評報告書」逐一判斷
        ② benchmark_covered / benchmark_evidence：若有上傳標竿報告書，同樣逐一判斷；若無標竿報告書則全填 false / ""
        重點：benchmark_evidence 需引用標竿報告書的「具體原文段落或做法描述」，
              讓使用者清楚看到標竿公司在此子選項上「比受評公司寫得更好」的具體依據。

步驟 4：計算分數（只根據受評報告書）：
        score = ROUND( (is_covered=true 的子選項數 / sub_options 總數) × 100 )
        例：5 個子選項中有 3 個涵蓋 → score = 60

步驟 5：consistency_analysis 說明整體涵蓋情況，並特別指出受評報告書未涵蓋但標竿報告書有涵蓋的關鍵子選項。`;

// ─── Analyze Endpoint ────────────────────────────────────────────────────────
app.post('/api/analyze', analyzeUpload, async (req: Request, res: Response): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const mainFile      = files?.['file']?.[0];
    const benchmarkFile = files?.['benchmarkFile']?.[0];
    const extraFiles    = files?.['extraFiles'] ?? [];
    // Website texts pre-fetched by frontend and sent as JSON string
    const websiteTexts: { url: string; text: string }[] = (() => {
        try { return JSON.parse(req.body.websiteTexts || '[]'); } catch { return []; }
    })();

    if (!mainFile) {
        res.status(400).json({ error: 'No main file uploaded or invalid file format.' });
        return;
    }

    dotenv.config({ path: path.join(process.cwd(), '.env') });
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiKey) {
        res.status(401).json({ error: '找不到 Gemini API Key，請確認 .env 的 GEMINI_API_KEY 已設定。' });
        return;
    }

    const ai = new GoogleGenerativeAI(geminiKey);
    const fileManager = new GoogleAIFileManager(geminiKey);

    // Read & split criteria by dimension
    const criteriaFilePath = path.join(__dirname, 'criteria', 'CSA_ELQ.txt');
    if (!fs.existsSync(criteriaFilePath)) {
        res.status(500).json({ error: 'CSA ELQ criteria file is missing on the server.' });
        return;
    }
    const fullCriteria = fs.readFileSync(criteriaFilePath, 'utf-8');
    const dim04pos = fullCriteria.indexOf('# 04 Environmental Dimension');
    const dim05pos = fullCriteria.indexOf('# 05 Social Dimension');
    const criteriaByDim: Record<string, string> = {
        '03': fullCriteria.substring(0, dim04pos > 0 ? dim04pos : undefined),
        '04': dim04pos > 0 ? fullCriteria.substring(dim04pos, dim05pos > 0 ? dim05pos : undefined) : '',
        '05': dim05pos > 0 ? fullCriteria.substring(dim05pos) : '',
    };

    let uploadedMain: any = null;
    let uploadedBenchmark: any = null;
    const uploadedExtras: any[] = [];

    try {
        console.log(`[ESG Engine] Uploading: ${mainFile.originalname}`);
        uploadedMain = await fileManager.uploadFile(mainFile.path, {
            mimeType: mainFile.mimetype,
            displayName: mainFile.originalname,
        });
        if (benchmarkFile) {
            uploadedBenchmark = await fileManager.uploadFile(benchmarkFile.path, {
                mimeType: benchmarkFile.mimetype,
                displayName: benchmarkFile.originalname,
            });
        }
        for (const ef of extraFiles) {
            const up = await fileManager.uploadFile(ef.path, {
                mimeType: ef.mimetype, displayName: ef.originalname,
            });
            uploadedExtras.push({ upload: up, local: ef });
        }

        // Wait for Gemini file processing
        const waitReady = async (name: string) => {
            let f = await fileManager.getFile(name);
            while (f.state === 'PROCESSING') {
                await new Promise(r => setTimeout(r, 3000));
                f = await fileManager.getFile(name);
            }
            if (f.state === 'FAILED') throw new Error(`Gemini file processing failed: ${name}`);
        };
        await waitReady(uploadedMain.file.name);
        if (uploadedBenchmark) await waitReady(uploadedBenchmark.file.name);
        for (const ue of uploadedExtras) await waitReady(ue.upload.file.name);
        console.log('[ESG Engine] Files ready. Starting 3-agent parallel scoring...');

        // ── Helper: build content parts ──────────────────────────────────────
        const buildParts = (extraText?: string) => {
            const parts: any[] = [
                { text: '以下是正在受測的永續報告書：' },
                { fileData: { mimeType: uploadedMain.file.mimeType, fileUri: uploadedMain.file.uri } },
            ];
            if (uploadedBenchmark) {
                parts.push({ text: '以下是使用者上傳的「標竿報告書」，請特別留意其優秀揭露段落，撰寫 benchmark_reference 時優先引用此報告書：' });
                parts.push({ fileData: { mimeType: uploadedBenchmark.file.mimeType, fileUri: uploadedBenchmark.file.uri } });
            }
            for (const ue of uploadedExtras) {
                parts.push({ text: `以下是使用者上傳的補充文件（${ue.upload.file.displayName}），可做為評分與建議的參考依據：` });
                parts.push({ fileData: { mimeType: ue.upload.file.mimeType, fileUri: ue.upload.file.uri } });
            }
            if (websiteTexts.length > 0) {
                parts.push({ text: '以下是使用者提供的官方網站 / 年報網頁文字內容：\n' +
                    websiteTexts.map(w => `[來源: ${w.url}]\n${w.text}`).join('\n\n---\n\n') });
            }
            if (extraText) parts.push({ text: extraText });
            return parts;
        };

        // ── Agent 1/2/3: Parallel Dimension Scoring ──────────────────────────
        /** Run one dimension scoring call for a given question subset */
        const runDimBatch = async (
            dimCode: string, questions: string[], batchLabel: string
        ) => {
            const dimName  = DIM_NAMES[dimCode];
            const codePrefix = dimCode === '03' ? 'G03' : dimCode === '04' ? 'E04' : 'S05';
            const qList    = questions.map((q, i) => `[${String(i + 1).padStart(2, '0')}] ${q}`).join('\n');

            // Criteria text: cap at 150k to avoid overloading input context
            const criteriaText = criteriaByDim[dimCode].substring(0, 150000);

            const hasBenchmarkCtx = !!uploadedBenchmark;
            const benchmarkInstruction = hasBenchmarkCtx
                ? `\n【標竿報告書已上傳 — 重要】
對每個子選項，除了判斷受評報告書外，必須同時閱讀標竿報告書並填寫：
- benchmark_covered：標竿報告書是否明確涵蓋此子選項
- benchmark_evidence：若 benchmark_covered=true，填入標竿報告書的「具體原文或做法描述」（60字以內），
  讓使用者清楚了解標竿公司在此點做得更好的具體內容。`
                : `\n【無標竿報告書】所有 sub_options 的 benchmark_covered 填 false，benchmark_evidence 填空字串。`;

            const sysPrompt = `你是專業 CSA/DJSI ESG 審計 AI。你的任務是針對「${dimName}」(${batchLabel}) 依照 DJSI 真實評分邏輯逐題評分。
${benchmarkInstruction}

${csaScoringRules}

【強制規則】
- question_code 格式：「${codePrefix} → 題目英文名稱」
- dimension 欄位固定填：「${dimName}」
- question_name：填該題的繁體中文說明（15字以內）
- 以下所有 ${questions.length} 題必須全部出現，不可省略
- 每題必須填寫 sub_options（至少 3 個子選項）；若報告書完全未揭露，所有 sub_options.is_covered=false，score=0
- sub_options 中每個 option_text 必須來自 Criteria，或從題目核心要求合理拆解
- 各欄字數上限：consistency_analysis ≤ 50字、evidence ≤ 30字、benchmark_evidence ≤ 35字、evidence_excerpt ≤ 40字、standard_requirement ≤ 35字
- keyword_adjustments 只列出有明確用詞落差的題目（可為空陣列）

【必評題目清單】
${qList}

【本維度 CSA ELQ Criteria（節錄）— 請仔細閱讀每題的 Question Layout 以找出子選項】
---
${criteriaText}
---`;

            const model = ai.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: sysPrompt,
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: dimensionSchema as any,
                    temperature: 0.1,
                    maxOutputTokens: 65536,   // max for Flash — avoids truncation
                },
            });

            const prompt = `請依據上方報告書，對「${dimName}」(${batchLabel}) 的 ${questions.length} 題逐一評分。`;

            for (let attempt = 1; attempt <= 2; attempt++) {
                const response = await model.generateContent(buildParts(prompt));
                const raw = response.response.text();
                try {
                    const parsed = safeParseJson(raw, `${batchLabel} (attempt ${attempt})`);
                    console.log(`[ESG Engine] ${batchLabel} done — ${parsed.question_level_scoring?.length ?? 0} questions scored.`);
                    return parsed;
                } catch (err) {
                    if (attempt === 2) throw err;
                    console.warn(`[ESG Engine] ${batchLabel} parse failed (attempt ${attempt}), retrying…`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        };

        /** Merge two batch results into one dimension result */
        const mergeBatches = (a: any, b: any) => ({
            dimension_score: Math.round(((a.dimension_score ?? 0) + (b.dimension_score ?? 0)) / 2),
            question_level_scoring: [
                ...(a.question_level_scoring ?? []),
                ...(b.question_level_scoring ?? []),
            ],
            keyword_adjustments: [
                ...(a.keyword_adjustments ?? []),
                ...(b.keyword_adjustments ?? []),
            ],
        });

        // All dimensions split into ~20-question batches to stay under output token limits
        // D03: 45 → 23 + 22
        const D03_A = QUESTIONS['03'].slice(0, 23);
        const D03_B = QUESTIONS['03'].slice(23);
        // D04: 39 → 20 + 19
        const D04_A = QUESTIONS['04'].slice(0, 20);
        const D04_B = QUESTIONS['04'].slice(20);
        // D05: 27 → 14 + 13
        const D05_A = QUESTIONS['05'].slice(0, 14);
        const D05_B = QUESTIONS['05'].slice(14);

        // Run all 6 batches in parallel
        console.log('[ESG Engine] Starting 6-batch parallel scoring (D03×2, D04×2, D05×2)...');
        const [dim03a, dim03b, dim04a, dim04b, dim05a, dim05b] = await Promise.all([
            runDimBatch('03', D03_A, 'Dim #03-A'),
            runDimBatch('03', D03_B, 'Dim #03-B'),
            runDimBatch('04', D04_A, 'Dim #04-A'),
            runDimBatch('04', D04_B, 'Dim #04-B'),
            runDimBatch('05', D05_A, 'Dim #05-A'),
            runDimBatch('05', D05_B, 'Dim #05-B'),
        ]);
        const dim03 = mergeBatches(dim03a, dim03b);
        const dim04 = mergeBatches(dim04a, dim04b);
        const dim05 = mergeBatches(dim05a, dim05b);
        console.log(`[ESG Engine] All 6 batches done. D03:${dim03.question_level_scoring.length} D04:${dim04.question_level_scoring.length} D05:${dim05.question_level_scoring.length}. Running synthesis + web-search...`);

        // ── Agent 4: Synthesis ────────────────────────────────────────────────
        const allQuestions = [
            ...(dim03.question_level_scoring || []),
            ...(dim04.question_level_scoring || []),
            ...(dim05.question_level_scoring || []),
        ];

        // Build compact score summary for synthesis context
        const scoreSummary = allQuestions
            .map((q: any) => `[${q.question_code}] ${q.question_name} → ${q.score}分: ${q.consistency_analysis}`)
            .join('\n');

        // ── Weighted score using official CSA ELQ 2025 weights ───────────────
        const weighted = calculateCSAWeightedScore(allQuestions);
        const d03score = weighted.dimension_scores.d03;
        const d04score = weighted.dimension_scores.d04;
        const d05score = weighted.dimension_scores.d05;
        const overallEst = weighted.overall_score;
        console.log(`[ESG Engine] Weighted scores — Overall: ${overallEst} | #03: ${d03score} | #04: ${d04score} | #05: ${d05score}`);

        const hasBenchmark = !!uploadedBenchmark;
        const benchmarkNote = hasBenchmark
            ? `\n【標竿報告書已上傳】在 improvement_actions 的 benchmark_reference 中，請優先引用已上傳的標竿報告書內容，包含公司名稱、具體段落與學習重點。`
            : `\n【無標竿報告書】benchmark_reference 欄位可留空，由 Web Search Agent 補充。`;

        const criterionSummary = Object.entries(weighted.criterion_scores)
            .map(([name, score]) => `  ${name}: ${score}`)
            .join('\n');

        const synthSysPrompt = `你是專業 ESG 顧問 AI，負責根據三個維度的評分結果，撰寫整體診斷與改善建議報告。
【CSA 加權分數（官方 2025 ELQ 權重）】
整體加權分數：${overallEst} / 100
- ${DIM_NAMES['03']} (權重35%)：${d03score} 分
- ${DIM_NAMES['04']} (權重35%)：${d04score} 分
- ${DIM_NAMES['05']} (權重30%)：${d05score} 分

準則別分數（各準則在總分中的佔比見括號）：
${criterionSummary}
${benchmarkNote}

【語言偵測】
首先判斷報告書是英文（en）或中文（zh），填入 report_language。

【language rules for recommendations】
若報告書為英文：recommendation_en 填英文建議；recommendation_zh 填繁體中文翻譯
若報告書為中文：兩欄皆填繁體中文

【任務說明】
1. overall_score：依三維度加權，或直接用 ${overallEst}
2. radar_chart_data：只填以下固定三筆，不可增加：
   - { dimension: "Governance & Economic Dimension", score: ${d03score} }
   - { dimension: "Environmental Dimension",         score: ${d04score} }
   - { dimension: "Social Dimension",                score: ${d05score} }
3. executive_diagnosis：summary 2–3句、strengths 5條、gaps 5條、critical_missing_elements 取得0分題目
4. improvement_path：挑出得分 ≤ 50 的題目，給具體改善建議，最多 15 條${hasBenchmark ? '，benchmark_reference 必須引用標竿報告書' : ''}
5. suggested_disclosure_text：針對最重要的 5 個缺口題，提供建議揭露文本（中英文）

以下是所有題目的評分摘要（共 ${allQuestions.length} 題）：
---
${scoreSummary}
---`;

        // ── Agent 5: Web Search (runs in parallel with synthesis) ────────────
        const runWebSearchAgent = async (): Promise<any[]> => {
            // Pick top 8 weakest topics for search
            const weakTopics = [...allQuestions]
                .sort((a: any, b: any) => a.score - b.score)
                .slice(0, 8)
                .map((q: any) => q.question_name || q.question_code);

            if (weakTopics.length === 0) return [];

            console.log('[ESG Engine] Web Search Agent: searching for', weakTopics.slice(0, 3), '...');

            try {
                // Step 1: Search with Google Search grounding (cannot use JSON schema here)
                const searchModel = ai.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    tools: [{ googleSearch: {} } as any],
                });
                const searchPrompt = `你是 ESG 研究員。請搜尋以下 ESG 議題中，哪些知名上市公司（如台積電、Apple、Microsoft、Unilever、Sony 等）有特別優秀且具體的永續報告書揭露做法。
題項：${weakTopics.join(' / ')}

對每個題項，請找出：
1. 公司名稱
2. 該公司的具體揭露做法或報告書相關段落（請直接引用或描述）
3. 為何這份揭露值得學習

格式範例：
## [題項名稱]
公司：TSMC
揭露內容：「TSMC has set science-based targets aligned with 1.5°C pathway...」
學習重點：具體量化目標搭配時程，符合 CSA 要求`;

                const searchRes = await searchModel.generateContent(searchPrompt);
                const searchText = searchRes.response.text();

                // Step 2: Format into JSON
                const formatModel = ai.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    systemInstruction: '你是資料格式化 AI，將輸入的 ESG 標竿研究結果轉換成結構化 JSON。',
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: webSearchResultSchema as any,
                        temperature: 0.0,
                        maxOutputTokens: 8192,
                    },
                });
                const formatRes = await formatModel.generateContent(
                    `請將以下 ESG 標竿研究結果格式化：\n${searchText}`
                );
                const formatted = safeParseJson(formatRes.response.text(), 'WebSearch format');
                console.log(`[ESG Engine] Web Search Agent done — ${formatted.benchmark_references?.length ?? 0} references found.`);
                return formatted.benchmark_references ?? [];
            } catch (err) {
                console.warn('[ESG Engine] Web Search Agent failed (non-fatal):', err instanceof Error ? err.message : err);
                return [];
            }
        };

        const synthModel = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: synthSysPrompt,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: synthesisSchema as any,
                temperature: 0.2,
                maxOutputTokens: 32768,
            },
        });

        // Run synthesis + web search in parallel
        const [synthesis, webBenchmarks] = await Promise.all([
            synthModel.generateContent(buildParts('請根據以上所有題目評分結果，產出整體診斷報告、改善建議與建議揭露文本。'))
                .then(r => safeParseJson(r.response.text(), 'Synthesis agent')),
            runWebSearchAgent(),
        ]);
        console.log('[ESG Engine] Synthesis + Web Search done. Merging results...');

        // ── Merge into final ESGAnalysisResult ───────────────────────────────
        const allKeywords = [
            ...(dim03.keyword_adjustments || []),
            ...(dim04.keyword_adjustments || []),
            ...(dim05.keyword_adjustments || []),
        ];

        // Attach web-search benchmarks to improvement_actions that lack one
        const improvementActions = (synthesis.improvement_path?.improvement_actions ?? []).map((action: any) => {
            if (!action.benchmark_reference && webBenchmarks.length > 0) {
                const match = webBenchmarks.find((wb: any) =>
                    wb.topic && action.topic &&
                    (wb.topic.toLowerCase().includes(action.topic.toLowerCase()) ||
                     action.topic.toLowerCase().includes(wb.topic.toLowerCase()))
                ) ?? (webBenchmarks.shift()); // fallback: take next unused
                if (match) {
                    action.benchmark_reference = {
                        company_name: match.company_name,
                        excerpt: match.excerpt,
                        explanation: match.explanation + (match.source_url ? ` (來源: ${match.source_url})` : ''),
                    };
                }
            }
            return action;
        });

        const finalResult = {
            dashboard_summary: {
                framework: 'S&P Global CSA (ELQ)',
                report_language: synthesis.report_language || 'zh',
                overall_score: overallEst,          // ★ always use CSA-weighted score
                dimension_scores: {
                    '#03 Governance & Economic (35%)': d03score,
                    '#04 Environmental (35%)': d04score,
                    '#05 Social (30%)': d05score,
                },
                criterion_scores: weighted.criterion_scores, // per-criterion breakdown
                // ★ Hardcode exactly 3 radar dimensions with CSA-weighted scores
                radar_chart_data: [
                    { dimension: 'Governance & Economic', score: d03score },
                    { dimension: 'Environmental',         score: d04score },
                    { dimension: 'Social',                score: d05score },
                ],
            },
            executive_diagnosis: synthesis.executive_diagnosis,
            question_level_scoring: allQuestions,
            improvement_path: { improvement_actions: improvementActions },
            keyword_gap_analysis: { adjustments: allKeywords },
            suggested_disclosure_text: synthesis.suggested_disclosure_text,
        };

        // Save to SQLite
        try {
            insertResult.run({
                filename: mainFile.originalname,
                overall_score: finalResult.dashboard_summary.overall_score,
                report_language: finalResult.dashboard_summary.report_language,
                result_json: JSON.stringify(finalResult),
            });
            console.log(`[ESG Engine] Saved "${mainFile.originalname}" to DB.`);
        } catch (dbErr) {
            console.error('[ESG Engine] DB save warning:', dbErr);
        }

        // Cleanup
        try {
            await fileManager.deleteFile(uploadedMain.file.name);
            fs.unlinkSync(mainFile.path);
            if (uploadedBenchmark) {
                await fileManager.deleteFile(uploadedBenchmark.file.name);
                if (benchmarkFile) fs.unlinkSync(benchmarkFile.path);
            }
            for (const ue of uploadedExtras) {
                await fileManager.deleteFile(ue.upload.file.name).catch(() => {});
                if (fs.existsSync(ue.local.path)) fs.unlinkSync(ue.local.path);
            }
        } catch (cleanErr) {
            console.error('[ESG Engine] Cleanup warning:', cleanErr);
        }

        res.json(finalResult);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : msg;
        fs.appendFileSync('server_error.log', `[${new Date().toISOString()}] ${stack}\n`);
        console.error('[ESG Engine] Error:', msg);

        // Cleanup on error
        try {
            if (uploadedMain) await fileManager.deleteFile(uploadedMain.file.name).catch(() => {});
            if (uploadedBenchmark) await fileManager.deleteFile(uploadedBenchmark.file.name).catch(() => {});
            for (const ue of uploadedExtras) await fileManager.deleteFile(ue.upload.file.name).catch(() => {});
            if (mainFile?.path && fs.existsSync(mainFile.path)) fs.unlinkSync(mainFile.path);
            if (benchmarkFile?.path && fs.existsSync(benchmarkFile.path)) fs.unlinkSync(benchmarkFile.path);
            for (const ef of extraFiles) if (fs.existsSync(ef.path)) fs.unlinkSync(ef.path);
        } catch {}

        res.status(500).json({ error: msg });
    }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(PORT as number, '0.0.0.0', () => {
        console.log(`[ESG Engine] Server running on http://0.0.0.0:${PORT}`);
    });
    server.setTimeout(900000); // 15 min timeout for 4-agent pipeline
}
