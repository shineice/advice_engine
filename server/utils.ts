// ─── CSA ELQ Criterion Weights (2025, Electrical Components & Equipment) ─────
export const CRITERION_WEIGHTS: { name: string; weight: number; dim: '03' | '04' | '05'; questions: string[] }[] = [
    // ── #03 Governance & Economic (35% total) ──
    { name: 'Transparency & Reporting',            weight: 0.01, dim: '03', questions: ['Sustainability Reporting Boundaries', 'Sustainability Reporting Assurance', 'Sustainability Taxonomies'] },
    { name: 'Corporate Governance',                weight: 0.08, dim: '03', questions: ['Board Independence', 'Board Type', 'Non-Executive Chairperson', 'Board Diversity Policy', 'Board Gender Diversity', 'Board Accountability', 'Board Average Tenure', 'Board Industry Experience', 'CEO Compensation', 'Government Ownership', 'Family Ownership', 'CEO-to-Employee Pay Ratio', 'Employee Compensation', 'ESG Governance Oversight'] },
    { name: 'Materiality',                         weight: 0.03, dim: '03', questions: ['Materiality Analysis', 'Material Issues for Enterprise Value Creation', 'Materiality Metrics for Enterprise Value Creation', 'Material Issues for External Stakeholders', 'Materiality Metrics for External Stakeholders'] },
    { name: 'Risk & Crisis Management',            weight: 0.03, dim: '03', questions: ['Risk Governance', 'Risk Management Processes', 'Emerging Risks'] },
    { name: 'Business Ethics',                     weight: 0.07, dim: '03', questions: ['UN Global Compact Membership', 'Codes of Conduct', 'Anti-Bribery', 'Whistleblowing Mechanism'] },
    { name: 'Policy Influence',                    weight: 0.02, dim: '03', questions: ['Policy Influence', 'Contributions & Other Spending', 'Largest Contributions', 'Lobbying and Trade Associations'] },
    { name: 'Supply Chain Management',             weight: 0.07, dim: '03', questions: ['Supplier Code of Conduct', 'Supplier ESG Programs', 'Supplier Screening', 'Supplier Assessment and Development', 'KPIs for Supplier Screening', 'KPIs for Supplier Assessment', 'Conflict Minerals'] },
    { name: 'Information Security',                weight: 0.02, dim: '03', questions: ['Information Security Governance', 'Information Security Policy', 'Information Security Management Programs'] },
    { name: 'Product Quality & Recall Management', weight: 0.02, dim: '03', questions: ['Product Quality Programs', 'Product Recalls'] },
    // ── #04 Environmental (35% total) ──
    { name: 'Environmental Policy & Management',   weight: 0.04, dim: '04', questions: ['Environmental Policy', 'Environmental Management Systems Verification', 'Return on Environmental Investments', 'Environmental Violations'] },
    { name: 'Energy',                              weight: 0.03, dim: '04', questions: ['Energy Management Programs', 'Energy Consumption'] },
    { name: 'Waste & Pollutants',                  weight: 0.03, dim: '04', questions: ['Waste Management Programs', 'Waste Disposal', 'Hazardous Waste', 'Volatile Organic Compounds Emissions'] },
    { name: 'Water',                               weight: 0.01, dim: '04', questions: ['Water Efficiency Management Programs', 'Water Consumption'] },
    { name: 'Climate Strategy',                    weight: 0.10, dim: '04', questions: ['Greenhouse Gas Emissions (Scope 1)', 'Greenhouse Gas Emissions (Scope 2)', 'Greenhouse Gas Emissions (Scope 3)', 'Climate Governance', 'TCFD Disclosure', 'Climate-Related Management Incentives', 'Climate Risk Management', 'Financial Risks of Climate Change', 'Financial Opportunities Arising from Climate Change', 'Climate-Related Scenario Analysis', 'Physical Climate Risk Adaptation', 'Emissions Reduction Targets', 'Internal Carbon Pricing', 'Net-Zero Commitment'] },
    { name: 'Biodiversity',                        weight: 0.03, dim: '04', questions: ['Biodiversity Risk Assessment', 'Biodiversity Commitment', 'No Deforestation Commitment'] },
    { name: 'Product Stewardship',                 weight: 0.08, dim: '04', questions: ['Product Design Criteria', 'Life Cycle Assessment', 'Exposure to Hazardous Substances', 'Hazardous Substances Commitment', 'End of Life Cycle Responsibility', 'Revenues from Eco-labeled Products'] },
    { name: 'Sustainable Raw Materials',           weight: 0.03, dim: '04', questions: ['Raw Materials Policy', 'Raw Materials Programs', 'Plastic Raw Materials', 'Metal Raw Materials'] },
    // ── #05 Social (30% total) ──
    { name: 'Labor Practices',                     weight: 0.05, dim: '05', questions: ['Labor Practices Commitment', 'Labor Practices Programs', 'Discrimination & Harassment', 'Workforce Breakdown: Gender', 'Workforce Breakdown: Race'] },
    { name: 'Human Rights',                        weight: 0.04, dim: '05', questions: ['Human Rights Commitment', 'Human Rights Due Diligence Process', 'Human Rights Assessment', 'Human Rights Mitigation', 'Gender Pay Indicators', 'Freedom of Association'] },
    { name: 'Human Capital Management',            weight: 0.11, dim: '05', questions: ['Training & Development Inputs', 'Employee Development Programs', 'Human Capital Return on Investment', 'Hiring', 'Employee Turnover Rate', 'Long-Term Incentives for Employees', 'Employee Support Programs', 'Type of Performance Appraisal', 'Trend of Employee Wellbeing'] },
    { name: 'Occupational Health & Safety',        weight: 0.07, dim: '05', questions: ['OHS Policy', 'OHS Programs', 'Fatalities', 'Lost-Time Injury Frequency Rate'] },
    { name: 'Customer Relations',                  weight: 0.03, dim: '05', questions: ['Online Strategies', 'Customer Satisfaction Measurement'] },
];

// ─── Question Lists (per dimension) ──────────────────────────────────────────
export const QUESTIONS: Record<string, string[]> = {
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

// ─── JSON Helpers ─────────────────────────────────────────────────────────────
export function extractJson(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (fenced) return fenced[1].trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return trimmed;
    }
    const start = trimmed.indexOf('{');
    const end   = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
    return trimmed;
}

export function repairTruncatedJson(text: string): string {
    try { JSON.parse(text); return text; } catch { /* continue */ }

    const closings = [
        ']}',
        '],"keyword_adjustments":[]}',
        '],"keyword_adjustments":[],"dimension_score":0}',
    ];

    const strategies: Array<(s: string) => string[]> = [
        s => { const i = s.lastIndexOf('},'); return i > 0 ? closings.map(c => s.slice(0, i + 1) + c) : []; },
        s => { const i = s.lastIndexOf('}'); return i > 0 ? closings.map(c => s.slice(0, i + 1) + c) : []; },
        s => s.trimEnd().endsWith(']') ? [s + '}'] : [],
        s => [s.trimEnd() + '}'],
    ];

    const cleaned = extractJson(text);
    for (const strategy of strategies) {
        for (const candidate of strategy(cleaned)) {
            try { JSON.parse(candidate); return candidate; } catch { /* try next */ }
        }
    }
    return text;
}

export function safeParseJson(raw: string, label: string): any {
    const cleaned = extractJson(raw);
    try { return JSON.parse(cleaned); } catch { /* try repair */ }

    const repaired = repairTruncatedJson(cleaned);
    try { return JSON.parse(repaired); } catch { /* fall through */ }

    throw new Error(`${label} returned invalid JSON. Raw length: ${raw.length}`);
}

// ─── CSA Weighted Score ───────────────────────────────────────────────────────
export function calculateCSAWeightedScore(allQuestions: any[]): {
    overall_score: number;
    dimension_scores: { d03: number; d04: number; d05: number };
    criterion_scores: Record<string, number>;
} {
    const criterion_scores: Record<string, number> = {};
    let overall = 0;
    const dimRaw: Record<string, number> = { '03': 0, '04': 0, '05': 0 };

    for (const criterion of CRITERION_WEIGHTS) {
        const matched = allQuestions.filter((q: any) => {
            const codeParts = (q.question_code || '').split(' → ');
            const nameFromCode = (codeParts[1] || '').trim().toLowerCase();
            const questionName = (q.question_name || '').toLowerCase();
            return criterion.questions.some(kw =>
                nameFromCode.includes(kw.toLowerCase().substring(0, 12)) ||
                questionName.includes(kw.toLowerCase().substring(0, 8))
            );
        });

        const avgScore = matched.length > 0
            ? matched.reduce((s: number, q: any) => s + (Number(q.score) || 0), 0) / matched.length
            : 0;

        criterion_scores[criterion.name] = Math.round(avgScore);
        const contribution = avgScore * criterion.weight;
        overall += contribution;
        dimRaw[criterion.dim] += contribution;
    }

    const D_WEIGHTS: Record<string, number> = { '03': 0.35, '04': 0.35, '05': 0.30 };
    return {
        overall_score: Math.min(100, Math.round(overall)),
        dimension_scores: {
            d03: Math.min(100, Math.round(dimRaw['03'] / D_WEIGHTS['03'])),
            d04: Math.min(100, Math.round(dimRaw['04'] / D_WEIGHTS['04'])),
            d05: Math.min(100, Math.round(dimRaw['05'] / D_WEIGHTS['05'])),
        },
        criterion_scores,
    };
}
