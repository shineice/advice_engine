/**
 * ESG Engine — Automated Test Suite
 *
 * Covers:
 *  1. Pure utility functions  (extractJson, repairTruncatedJson, safeParseJson)
 *  2. CSA scoring logic       (QUESTIONS counts, CRITERION_WEIGHTS totals, calculateCSAWeightedScore)
 *  3. HTTP API endpoints      (/api/health, /api/results, /api/fetch-url, /api/analyze)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import {
    extractJson,
    repairTruncatedJson,
    safeParseJson,
    calculateCSAWeightedScore,
    QUESTIONS,
    CRITERION_WEIGHTS,
} from '../server/utils.js';

// ─── 1. extractJson ───────────────────────────────────────────────────────────
describe('extractJson', () => {
    it('returns clean JSON object unchanged', () => {
        const input = '{"foo":"bar"}';
        expect(extractJson(input)).toBe(input);
    });

    it('returns clean JSON array unchanged', () => {
        const input = '[1,2,3]';
        expect(extractJson(input)).toBe(input);
    });

    it('strips ```json ... ``` markdown fences', () => {
        const input = '```json\n{"score":42}\n```';
        expect(extractJson(input)).toBe('{"score":42}');
    });

    it('strips ``` ... ``` without language tag', () => {
        const input = '```\n{"x":1}\n```';
        expect(extractJson(input)).toBe('{"x":1}');
    });

    it('extracts JSON from surrounding prose', () => {
        const input = 'Here is the result: {"dimension_score":55} done.';
        const result = extractJson(input);
        expect(() => JSON.parse(result)).not.toThrow();
    });

    it('returns input unchanged when no JSON found', () => {
        const input = 'no json here';
        expect(extractJson(input)).toBe(input);
    });
});

// ─── 2. repairTruncatedJson ───────────────────────────────────────────────────
describe('repairTruncatedJson', () => {
    it('returns already-valid JSON unchanged', () => {
        const valid = '{"dimension_score":50,"question_level_scoring":[],"keyword_adjustments":[]}';
        expect(repairTruncatedJson(valid)).toBe(valid);
    });

    it('repairs a truncated question_level_scoring array (strategy: last },)', () => {
        // Simulate output cut off mid-array
        const truncated = '{"dimension_score":60,"question_level_scoring":[{"question_code":"G03","score":50},{"question_code":"G04","score":70}';
        const repaired = repairTruncatedJson(truncated);
        expect(() => JSON.parse(repaired)).not.toThrow();
        const parsed = JSON.parse(repaired);
        expect(Array.isArray(parsed.question_level_scoring)).toBe(true);
        expect(parsed.question_level_scoring.length).toBeGreaterThanOrEqual(1);
    });

    it('repairs when only root brace is missing', () => {
        const truncated = '{"dimension_score":30,"question_level_scoring":[],"keyword_adjustments":[]';
        const repaired = repairTruncatedJson(truncated);
        expect(() => JSON.parse(repaired)).not.toThrow();
    });

    it('returns input when repair is impossible', () => {
        const garbage = 'this is not json at all ###';
        // Should not throw; may return original or attempt repair
        expect(() => repairTruncatedJson(garbage)).not.toThrow();
    });
});

// ─── 3. safeParseJson ─────────────────────────────────────────────────────────
describe('safeParseJson', () => {
    it('parses clean JSON', () => {
        const result = safeParseJson('{"score":88}', 'test');
        expect(result.score).toBe(88);
    });

    it('parses markdown-fenced JSON', () => {
        const result = safeParseJson('```json\n{"ok":true}\n```', 'test');
        expect(result.ok).toBe(true);
    });

    it('repairs and parses truncated JSON', () => {
        const truncated = '{"dimension_score":70,"question_level_scoring":[{"score":60}';
        const result = safeParseJson(truncated, 'test');
        expect(result).toBeDefined();
    });

    it('throws for completely unparseable input', () => {
        expect(() => safeParseJson('not json at all !!!', 'test')).toThrow(/invalid JSON/i);
    });
});

// ─── 4. QUESTIONS list integrity ─────────────────────────────────────────────
describe('QUESTIONS list integrity', () => {
    it('has exactly 45 questions in Dimension #03', () => {
        expect(QUESTIONS['03']).toHaveLength(45);
    });

    it('has exactly 39 questions in Dimension #04', () => {
        expect(QUESTIONS['04']).toHaveLength(39);
    });

    it('has exactly 27 questions in Dimension #05', () => {
        expect(QUESTIONS['05']).toHaveLength(27);
    });

    it('totals exactly 111 questions across all dimensions', () => {
        const total = QUESTIONS['03'].length + QUESTIONS['04'].length + QUESTIONS['05'].length;
        expect(total).toBe(111);
    });

    it('has no duplicate question names within any dimension', () => {
        for (const dim of ['03', '04', '05']) {
            const names = QUESTIONS[dim];
            const unique = new Set(names);
            expect(unique.size).toBe(names.length);
        }
    });

    it('D03 batch split gives 23 + 22', () => {
        expect(QUESTIONS['03'].slice(0, 23)).toHaveLength(23);
        expect(QUESTIONS['03'].slice(23)).toHaveLength(22);
    });

    it('D04 batch split gives 20 + 19', () => {
        expect(QUESTIONS['04'].slice(0, 20)).toHaveLength(20);
        expect(QUESTIONS['04'].slice(20)).toHaveLength(19);
    });

    it('D05 batch split gives 14 + 13', () => {
        expect(QUESTIONS['05'].slice(0, 14)).toHaveLength(14);
        expect(QUESTIONS['05'].slice(14)).toHaveLength(13);
    });
});

// ─── 5. CRITERION_WEIGHTS integrity ──────────────────────────────────────────
describe('CRITERION_WEIGHTS integrity', () => {
    it('has exactly 22 criteria', () => {
        expect(CRITERION_WEIGHTS).toHaveLength(22);
    });

    it('all weights sum to 1.00 (±0.001)', () => {
        const total = CRITERION_WEIGHTS.reduce((s, c) => s + c.weight, 0);
        expect(total).toBeCloseTo(1.0, 2);
    });

    it('#03 criteria weights sum to 0.35', () => {
        const d03 = CRITERION_WEIGHTS.filter(c => c.dim === '03').reduce((s, c) => s + c.weight, 0);
        expect(d03).toBeCloseTo(0.35, 2);
    });

    it('#04 criteria weights sum to 0.35', () => {
        const d04 = CRITERION_WEIGHTS.filter(c => c.dim === '04').reduce((s, c) => s + c.weight, 0);
        expect(d04).toBeCloseTo(0.35, 2);
    });

    it('#05 criteria weights sum to 0.30', () => {
        const d05 = CRITERION_WEIGHTS.filter(c => c.dim === '05').reduce((s, c) => s + c.weight, 0);
        expect(d05).toBeCloseTo(0.30, 2);
    });

    it('every criterion has at least one question keyword', () => {
        CRITERION_WEIGHTS.forEach(c => {
            expect(c.questions.length).toBeGreaterThan(0);
        });
    });
});

// ─── 6. calculateCSAWeightedScore ─────────────────────────────────────────────
describe('calculateCSAWeightedScore', () => {
    it('returns 0 for empty question list', () => {
        const result = calculateCSAWeightedScore([]);
        expect(result.overall_score).toBe(0);
        expect(result.dimension_scores.d03).toBe(0);
        expect(result.dimension_scores.d04).toBe(0);
        expect(result.dimension_scores.d05).toBe(0);
    });

    it('returns 100 when all questions score 100 and match all criteria', () => {
        // Build a mock question for every criterion keyword
        const allQuestions = CRITERION_WEIGHTS.flatMap(c =>
            c.questions.map(kw => ({
                question_code: `code → ${kw}`,
                question_name: kw,
                score: 100,
            }))
        );
        const result = calculateCSAWeightedScore(allQuestions);
        expect(result.overall_score).toBe(100);
    });

    it('dimension scores are integers (not floats)', () => {
        const qs = [{ question_code: 'G03 → Board Independence', question_name: 'Board Independence', score: 60 }];
        const result = calculateCSAWeightedScore(qs);
        expect(Number.isInteger(result.dimension_scores.d03)).toBe(true);
        expect(Number.isInteger(result.dimension_scores.d04)).toBe(true);
        expect(Number.isInteger(result.dimension_scores.d05)).toBe(true);
    });

    it('overall_score is an integer', () => {
        const qs = [{ question_code: 'G03 → Board Independence', question_name: 'Board Independence', score: 75 }];
        const result = calculateCSAWeightedScore(qs);
        expect(Number.isInteger(result.overall_score)).toBe(true);
    });

    it('scores never exceed 100', () => {
        const qs = CRITERION_WEIGHTS.flatMap(c =>
            c.questions.map(kw => ({ question_code: `code → ${kw}`, question_name: kw, score: 200 }))
        );
        const result = calculateCSAWeightedScore(qs);
        expect(result.overall_score).toBeLessThanOrEqual(100);
        expect(result.dimension_scores.d03).toBeLessThanOrEqual(100);
        expect(result.dimension_scores.d04).toBeLessThanOrEqual(100);
        expect(result.dimension_scores.d05).toBeLessThanOrEqual(100);
    });

    it('criterion_scores contains all 22 criterion names', () => {
        const result = calculateCSAWeightedScore([]);
        expect(Object.keys(result.criterion_scores)).toHaveLength(22);
    });
});

// ─── 7. HTTP API Endpoints ────────────────────────────────────────────────────
describe('HTTP API', () => {
    // Import app lazily so NODE_ENV=test is set before module loads
    let app: any;

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        // Dynamic import to ensure test mode is active
        const mod = await import('../server/index.js');
        app = mod.app;
    });

    it('GET /api/health → 200 with status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.time).toBeDefined();
    });

    it('GET /api/results → 200 with array', async () => {
        const res = await request(app).get('/api/results');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/results/99999 → 404 for non-existent record', async () => {
        const res = await request(app).get('/api/results/99999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBeDefined();
    });

    it('POST /api/fetch-url without body → 400', async () => {
        const res = await request(app).post('/api/fetch-url').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('POST /api/fetch-url with non-existent host → 400 with error message', async () => {
        const res = await request(app)
            .post('/api/fetch-url')
            .send({ url: 'http://this-host-does-not-exist-esg.invalid' })
            .timeout(20000);
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    it('POST /api/analyze without file → 400', async () => {
        const res = await request(app).post('/api/analyze');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('DELETE /api/results/99999 → succeeds (idempotent delete)', async () => {
        const res = await request(app).delete('/api/results/99999');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
