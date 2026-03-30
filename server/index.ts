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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// ─── SQLite ──────────────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, '..', 'results.db');
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

// ─── Question Lists (per dimension) ──────────────────────────────────────────
const QUESTIONS: Record<string, string[]> = {
    '03': [
        'Sustainability Reporting Boundaries', 'Sustainability Reporting Assurance',
        'Sustainability Taxonomies', 'Board Independence', 'Board Type',
        'Non-Executive Chairperson / Lead Director', 'Board Diversity Policy',
        'Board Gender Diversity', 'Board Accountability', 'Board Average Tenure',
        'Board Industry Experience', 'CEO Compensation – Success Metrics',
        'CEO Compensation – Long-Term Performance Alignment', 'Government Ownership',
        'Family Ownership', 'CEO-to-Employee Pay Ratio', 'Employee Compensation',
        'ESG Governance Oversight', 'Materiality Analysis',
        'Material Issues for Enterprise Value Creation',
        'Materiality Metrics for Enterprise Value Creation',
        'Material Issues for External Stakeholders',
        'Materiality Metrics for External Stakeholders',
        'Risk Governance', 'Risk Management Processes', 'Emerging Risks',
        'UN Global Compact Membership', 'Codes of Conduct',
        'Anti-Bribery & Anti-Corruption Policy', 'Whistleblowing Mechanism',
        'Policy Influence', 'Contributions & Other Spending',
        'Largest Contributions & Expenditures',
        'Lobbying and Trade Associations – Climate Alignment',
        'Supplier Code of Conduct', 'Supplier ESG Programs', 'Supplier Screening',
        'Supplier Assessment and Development', 'KPIs for Supplier Screening',
        'KPIs for Supplier Assessment and/or Development', 'Conflict Minerals',
        'Information Security Governance', 'Information Security Policy',
        'Information Security Management Programs', 'Product Quality Programs & Product Recalls',
    ],
    '04': [
        'Environmental Policy', 'Environmental Management Systems Verification',
        'Return on Environmental Investments', 'Environmental Violations',
        'Energy Management Programs', 'Energy Consumption',
        'Waste Management Programs', 'Waste Disposal', 'Hazardous Waste',
        'Volatile Organic Compounds Emissions', 'Water Efficiency Management Programs',
        'Water Consumption', 'Direct Greenhouse Gas Emissions (Scope 1)',
        'Indirect Greenhouse Gas Emissions (Scope 2)',
        'Indirect Greenhouse Gas Emissions (Scope 3)',
        'Climate Governance', 'TCFD Disclosure', 'Climate-Related Management Incentives',
        'Climate Risk Management', 'Financial Risks of Climate Change',
        'Financial Opportunities Arising from Climate Change',
        'Climate-Related Scenario Analysis', 'Physical Climate Risk Adaptation',
        'Emissions Reduction Targets', 'Internal Carbon Pricing', 'Net-Zero Commitment',
        'Biodiversity Risk Assessment', 'Biodiversity Commitment',
        'No Deforestation Commitment', 'Product Design Criteria', 'Life Cycle Assessment',
        'Exposure to Hazardous Substances', 'Hazardous Substances Commitment',
        'End of Life Cycle Responsibility', 'Revenues from Eco-labeled Products',
        'Raw Materials Policy', 'Raw Materials Programs', 'Plastic Raw Materials',
        'Metal Raw Materials',
    ],
    '05': [
        'Labor Practices Commitment', 'Labor Practices Programs',
        'Discrimination & Harassment', 'Workforce Breakdown: Gender',
        'Workforce Breakdown: Race / Ethnicity & Nationality',
        'Human Rights Commitment', 'Human Rights Due Diligence Process',
        'Human Rights Assessment', 'Human Rights Mitigation & Remediation',
        'Gender Pay Indicators', 'Freedom of Association',
        'Training & Development Inputs', 'Employee Development Programs',
        'Human Capital Return on Investment', 'Hiring', 'Employee Turnover Rate',
        'Long-Term Incentives for Employees', 'Employee Support Programs',
        'Type of Performance Appraisal', 'Trend of Employee Wellbeing',
        'OHS Policy', 'OHS Programs', 'Fatalities',
        'Lost-Time Injury Frequency Rate (LTIFR) – Employees',
        'Lost-Time Injury Frequency Rate (LTIFR) – Contractors',
        'Online Strategies & Customers Online', 'Customer Satisfaction Measurement',
    ],
};

const DIM_NAMES: Record<string, string> = {
    '03': '#03 Governance & Economic Dimension',
    '04': '#04 Environmental Dimension',
    '05': '#05 Social Dimension',
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
const scoringItemSchema = {
    type: SchemaType.OBJECT,
    properties: {
        question_code:        { type: SchemaType.STRING },
        question_name:        { type: SchemaType.STRING },
        dimension:            { type: SchemaType.STRING },
        score:                { type: SchemaType.NUMBER },
        consistency_analysis: { type: SchemaType.STRING },
        standard_requirement: { type: SchemaType.STRING },
        evidence_excerpt:     { type: SchemaType.STRING },
        page_reference:       { type: SchemaType.STRING },
    },
    required: ['question_code','question_name','dimension','score',
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

// ─── JSON Helpers ─────────────────────────────────────────────────────────────
/**
 * Gemini sometimes wraps JSON in ```json ... ``` markdown blocks.
 * This function strips the wrapper and attempts to return clean JSON text.
 */
function extractJson(raw: string): string {
    const trimmed = raw.trim();
    // Strip markdown code fences
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (fenced) return fenced[1].trim();
    // If starts/ends with { } or [ ] it's likely already clean
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return trimmed;
    }
    // Try to find the first { and last } as a fallback
    const start = trimmed.indexOf('{');
    const end   = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
    return trimmed;
}

function safeParseJson(raw: string, label: string): any {
    const cleaned = extractJson(raw);
    try {
        return JSON.parse(cleaned);
    } catch (e1) {
        // Log first 500 chars to help diagnose
        const preview = cleaned.substring(0, 500);
        fs.appendFileSync('server_error.log',
            `[${new Date().toISOString()}] JSON parse failed (${label})\n` +
            `  raw.length=${raw.length}  cleaned.length=${cleaned.length}\n` +
            `  preview: ${preview}\n`);
        console.error(`[ESG Engine] JSON parse failed (${label}). Preview:\n${preview}`);
        throw new Error(`${label} returned invalid JSON. Raw length: ${raw.length}`);
    }
}

// ─── Scoring Rules ────────────────────────────────────────────────────────────
const csaScoringRules = `
【評分規則】
100分（標竿）：報告書明確且具體地說明該 Criteria 的所有核心要求
75分（達標）：報告書有提到該 Criteria 的大部分要求
50分（起步）：報告書僅模糊提及該概念或有相關名詞
0分（缺失）：報告書完全沒有提及該項目`;

// ─── Analyze Endpoint ────────────────────────────────────────────────────────
app.post('/api/analyze', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'benchmarkFile', maxCount: 1 },
]), async (req: Request, res: Response): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const mainFile = files?.['file']?.[0];
    const benchmarkFile = files?.['benchmarkFile']?.[0];

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
        console.log('[ESG Engine] Files ready. Starting 3-agent parallel scoring...');

        // ── Helper: build content parts ──────────────────────────────────────
        const buildParts = (extraText?: string) => {
            const parts: any[] = [
                { text: '以下是正在受測的永續報告書：' },
                { fileData: { mimeType: uploadedMain.file.mimeType, fileUri: uploadedMain.file.uri } },
            ];
            if (uploadedBenchmark) {
                parts.push({ text: '以下是標竿報告書（請參考優秀做法）：' });
                parts.push({ fileData: { mimeType: uploadedBenchmark.file.mimeType, fileUri: uploadedBenchmark.file.uri } });
            }
            if (extraText) parts.push({ text: extraText });
            return parts;
        };

        // ── Agent 1/2/3: Parallel Dimension Scoring ──────────────────────────
        const runDimensionAgent = async (dimCode: string) => {
            const dimName = DIM_NAMES[dimCode];
            const qList = QUESTIONS[dimCode].map((q, i) => `[${String(i + 1).padStart(2, '0')}] ${q}`).join('\n');
            const prefix = `G${dimCode === '03' ? '03' : dimCode === '04' ? 'E04' : 'S05'}`;
            const codePrefix = dimCode === '03' ? 'G03' : dimCode === '04' ? 'E04' : 'S05';

            const sysPrompt = `你是專業 ESG 審計 AI。你的任務是針對「${dimName}」進行逐題評分。
${csaScoringRules}

【強制規則】
- question_code 格式：「${codePrefix} → 題目名稱」
- dimension 欄位固定填：「${dimName}」
- question_name：填該題的繁體中文說明（15字以內）
- 以下所有 ${QUESTIONS[dimCode].length} 題必須全部出現，不可省略。若報告書未提及，score=0，並在各欄填「報告書未揭露此項目」
- 各欄字數上限：consistency_analysis ≤ 80字、evidence_excerpt ≤ 60字、standard_requirement ≤ 50字
- keyword_adjustments 只列出有明確用詞落差的題目（可為空陣列）

【必評題目清單】
${qList}

【本維度 CSA ELQ Criteria】
---
${criteriaByDim[dimCode].substring(0, 280000)}
---`;

            const model = ai.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: sysPrompt,
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: dimensionSchema as any,
                    temperature: 0.1,
                    maxOutputTokens: 32768,
                },
            });

            const prompt = `請依據上方報告書，對「${dimName}」的所有 ${QUESTIONS[dimCode].length} 題逐一評分。`;

            // Retry up to 2 times on parse failure
            for (let attempt = 1; attempt <= 2; attempt++) {
                const response = await model.generateContent(buildParts(prompt));
                const raw = response.response.text();
                try {
                    const parsed = safeParseJson(raw, `Dimension ${dimCode} (attempt ${attempt})`);
                    console.log(`[ESG Engine] Dim #${dimCode} done — ${parsed.question_level_scoring?.length ?? 0} questions scored.`);
                    return parsed;
                } catch (err) {
                    if (attempt === 2) throw err;
                    console.warn(`[ESG Engine] Dim #${dimCode} parse failed on attempt ${attempt}, retrying…`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        };

        // Run 3 dimension agents in parallel
        const [dim03, dim04, dim05] = await Promise.all([
            runDimensionAgent('03'),
            runDimensionAgent('04'),
            runDimensionAgent('05'),
        ]);
        console.log('[ESG Engine] All 3 dimension agents done. Running synthesis agent...');

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

        const d03score = Number(dim03.dimension_score) || 0;
        const d04score = Number(dim04.dimension_score) || 0;
        const d05score = Number(dim05.dimension_score) || 0;
        const overallEst = Math.round((d03score + d04score + d05score) / 3);

        const synthSysPrompt = `你是專業 ESG 顧問 AI，負責根據三個維度的評分結果，撰寫整體診斷與改善建議報告。
已知三個維度評分：
- ${DIM_NAMES['03']}：${d03score} 分
- ${DIM_NAMES['04']}：${d04score} 分
- ${DIM_NAMES['05']}：${d05score} 分
整體估算分數：${overallEst} 分

【語言偵測】
首先判斷報告書是英文（en）或中文（zh），填入 report_language。

【關鍵字調整語言規則】（已整合進 improvement_path）
若報告書為英文：recommendation_en 填英文建議；recommendation_zh 填繁體中文翻譯
若報告書為中文：兩欄皆填繁體中文

【任務說明】
1. overall_score：依三維度加權（可參考 CSA 實際配比調整，或直接用 ${overallEst}）
2. radar_chart_data：包含三個維度 + 至多 5 個細項維度（取低分題的維度分類）
3. executive_diagnosis：summary 2–3句、strengths 5條、gaps 5條、critical_missing_elements 取得0分的題目
4. improvement_path：挑出得分 ≤ 50 的題目，給具體改善建議，最多 15 條
5. suggested_disclosure_text：針對最重要的 5 個缺口題，提供建議揭露文本（中英文）

以下是所有題目的評分摘要（共 ${allQuestions.length} 題）：
---
${scoreSummary}
---`;

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

        const synthResponse = await synthModel.generateContent(
            buildParts('請根據以上所有題目評分結果，產出整體診斷報告、改善建議與建議揭露文本。')
        );
        const synthesis = safeParseJson(synthResponse.response.text(), 'Synthesis agent');
        console.log('[ESG Engine] Synthesis done. Merging results...');

        // ── Merge into final ESGAnalysisResult ───────────────────────────────
        const allKeywords = [
            ...(dim03.keyword_adjustments || []),
            ...(dim04.keyword_adjustments || []),
            ...(dim05.keyword_adjustments || []),
        ];

        const finalResult = {
            dashboard_summary: {
                framework: 'S&P Global CSA (ELQ)',
                report_language: synthesis.report_language || 'zh',
                overall_score: synthesis.overall_score ?? overallEst,
                dimension_scores: {
                    '#03 Governance & Economic': d03score,
                    '#04 Environmental': d04score,
                    '#05 Social': d05score,
                },
                radar_chart_data: synthesis.radar_chart_data ?? [
                    { dimension: '#03 Governance & Economic', score: d03score },
                    { dimension: '#04 Environmental', score: d04score },
                    { dimension: '#05 Social', score: d05score },
                ],
            },
            executive_diagnosis: synthesis.executive_diagnosis,
            question_level_scoring: allQuestions,
            improvement_path: synthesis.improvement_path,
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
            if (mainFile?.path && fs.existsSync(mainFile.path)) fs.unlinkSync(mainFile.path);
            if (benchmarkFile?.path && fs.existsSync(benchmarkFile.path)) fs.unlinkSync(benchmarkFile.path);
        } catch {}

        res.status(500).json({ error: msg });
    }
});

const server = app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`[ESG Engine] Server running on http://0.0.0.0:${PORT}`);
});
server.setTimeout(900000); // 15 min timeout for 4-agent pipeline
