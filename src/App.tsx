import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileUp,
  ShieldCheck,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  FileText,
  Search,
  Lightbulb,
  Globe,
  LayoutDashboard,
  ClipboardCheck,
  History,
  Trash2,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  analyzeESGReport,
  fetchHistory,
  fetchResultById,
  fetchUrlText,
  deleteResult,
  ESGAnalysisResult,
  HistoryRecord,
} from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [benchmarkFile, setBenchmarkFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  // URL inputs
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [urlTexts, setUrlTexts] = useState<{ url: string; text: string }[]>([]);
  const [fetchingUrl, setFetchingUrl] = useState<number | null>(null);
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('');
  const [result, setResult] = useState<ESGAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'scoring' | 'improvement'>('summary');
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Scoring tab filters
  const [scoringDimFilter, setScoringDimFilter] = useState<string>('all');
  const [scoringScoreFilter, setScoringScoreFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [scoringSearch, setScoringSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await fetchHistory();
      setHistory(records);
    } catch {
      // history unavailable — not a fatal error
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFetchUrl = async (idx: number) => {
    const url = urlInputs[idx]?.trim();
    if (!url) return;
    setFetchingUrl(idx);
    setUrlErrors(prev => { const n = { ...prev }; delete n[idx]; return n; });
    try {
      const data = await fetchUrlText(url);
      setUrlTexts(prev => {
        const next = prev.filter(u => u.url !== url);
        return [...next, { url: data.url, text: data.text }];
      });
    } catch (e: any) {
      setUrlErrors(prev => ({ ...prev, [idx]: e.message || '抓取失敗' }));
    } finally {
      setFetchingUrl(null);
    }
  };

  const handleAnalyze = async (mainFile: File, optionalRefFile?: File | null) => {
    if (mainFile.size > 50 * 1024 * 1024 || (optionalRefFile && optionalRefFile.size > 50 * 1024 * 1024)) {
      setError('檔案過大（超過 50MB），請上傳小於 50MB 的 PDF 或 Markdown 檔案。');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalyzeStep('上傳檔案並等待 Gemini 處理...');
    try {
      setAnalyzeStep('Agent 1-3 並行評分 (#03 / #04 / #05)...');
      const analysisResult = await analyzeESGReport(
        mainFile,
        optionalRefFile || undefined,
        extraFiles.length > 0 ? extraFiles : undefined,
        urlTexts.length > 0 ? urlTexts : undefined,
      );
      setResult(analysisResult);
      loadHistory();
    } catch (err: any) {
      const errorMessage = err.message || JSON.stringify(err);
      if (errorMessage.includes('xhr error') || errorMessage.includes('Failed to fetch')) {
        setError('連線逾時或後端無回應。請確認伺服器已啟動（npm run dev）。');
      } else {
        setError(`分析失敗: ${errorMessage}`);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep('');
    }
  };

  const handleLoadHistory = async (id: number) => {
    try {
      const row = await fetchResultById(id);
      setResult(row.result_json);
      setActiveTab('summary');
    } catch {
      setError('無法載入歷史記錄。');
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteResult(id);
    setHistory(prev => prev.filter(r => r.id !== id));
  };

  const onMainDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) { setFile(acceptedFiles[0]); setError(null); }
  }, []);
  const onBenchmarkDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setBenchmarkFile(acceptedFiles[0]);
  }, []);
  const onExtraDrop = useCallback((acceptedFiles: File[]) => {
    setExtraFiles(prev => [...prev, ...acceptedFiles].slice(0, 5));
  }, []);

  const acceptedTypes = { 'application/pdf': ['.pdf'], 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] };

  const { getRootProps: getMainRootProps, getInputProps: getMainInputProps, isDragActive: isMainDragActive } = useDropzone({
    onDrop: onMainDrop, accept: acceptedTypes, multiple: false,
  });
  const { getRootProps: getBenchmarkRootProps, getInputProps: getBenchmarkInputProps, isDragActive: isBenchmarkDragActive } = useDropzone({
    onDrop: onBenchmarkDrop, accept: acceptedTypes, multiple: false,
  });
  const { getRootProps: getExtraRootProps, getInputProps: getExtraInputProps, isDragActive: isExtraDragActive } = useDropzone({
    onDrop: onExtraDrop, accept: acceptedTypes, multiple: true,
  });

  const reset = () => {
    setFile(null); setBenchmarkFile(null); setExtraFiles([]);
    setUrlInputs(['']); setUrlTexts([]); setUrlErrors({});
    setResult(null); setError(null); setIsAnalyzing(false); setAnalyzeStep('');
  };

  // ─── Loading Screen ──────────────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg w-full">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mx-auto relative" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">AI 4-Agent 並行分析中</h2>
          <p className="text-slate-400 text-sm mb-8">S&P Global CSA (ELQ) · 111 題全覆蓋</p>
          <div className="space-y-3 text-left">
            {([
              { label: 'Agent 1 — #03 Governance & Economic', desc: '45 題：治理、薪酬、供應鏈、資安…', color: 'bg-blue-500' },
              { label: 'Agent 2 — #04 Environmental',         desc: '39 題：氣候、能源、水資源、生物多樣性…', color: 'bg-emerald-500' },
              { label: 'Agent 3 — #05 Social',                desc: '27 題：勞工、人權、職安、客戶關係…', color: 'bg-violet-500' },
              { label: 'Agent 4 — Synthesis（診斷 & 建議）',  desc: '彙整 3 維度分數 → 產出診斷與改善路徑', color: 'bg-amber-500' },
            ] as const).map((agent, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
                <div className={`w-2 h-10 rounded-full ${agent.color} animate-pulse`} style={{ animationDelay: `${i * 0.3}s` }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800">{agent.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{agent.desc}</div>
                </div>
                <Loader2 className="w-4 h-4 text-slate-300 animate-spin shrink-0" style={{ animationDelay: `${i * 0.2}s` }} />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-6">預計需要 2–4 分鐘，請勿關閉視窗</p>
        </motion.div>
      </div>
    );
  }

  // ─── Result Screen ───────────────────────────────────────────────────────
  if (result) {
    const isEnglishReport = result.dashboard_summary.report_language === 'en';

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">AI ESG 引擎</h1>
                <p className="text-xs text-slate-400">S&P Global CSA (ELQ)</p>
              </div>
            </div>
            <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors px-4 py-2 rounded-lg border border-slate-200 bg-white">
              重新上傳報告
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Score + Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {result.dashboard_summary.framework} 綜合評分
              </span>
              <div className="relative">
                <svg className="w-48 h-48">
                  <circle className="text-slate-100" strokeWidth="12" stroke="currentColor" fill="transparent" r="80" cx="96" cy="96" />
                  <circle
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                    strokeWidth="12"
                    strokeDasharray={502.4}
                    strokeDashoffset={502.4 - (502.4 * result.dashboard_summary.overall_score) / 100}
                    strokeLinecap="round" stroke="currentColor" fill="transparent" r="80" cx="96" cy="96"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-slate-900">{result.dashboard_summary.overall_score}</span>
                  <span className="text-slate-400 font-medium">/ 100</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                {Object.entries(result.dashboard_summary.dimension_scores).map(([key, score]) => (
                  <div key={key} className="text-center">
                    <div className="text-xs font-medium text-slate-400 mb-1">{key}</div>
                    <div className="text-sm font-bold text-slate-700">{score}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />合規性分析雷達圖
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={result.dashboard_summary.radar_chart_data}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="score" stroke="#059669" fill="#10b981" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
            {[
              { id: 'summary', label: '高階診斷', icon: LayoutDashboard },
              { id: 'scoring', label: '題項評分', icon: ClipboardCheck },
              { id: 'improvement', label: '改善路徑', icon: Lightbulb },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={cn("flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  activeTab === tab.id ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />核心優勢
                    </h3>
                    <ul className="space-y-3">
                      {result.executive_diagnosis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-3 text-slate-600">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500" />主要缺口
                    </h3>
                    <ul className="space-y-3">
                      {result.executive_diagnosis.gaps.map((g, i) => (
                        <li key={i} className="flex items-start gap-3 text-slate-600">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-100 p-8 rounded-2xl">
                  <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />關鍵缺失揭露項目
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {result.executive_diagnosis.critical_missing_elements.map((e, i) => (
                      <span key={i} className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-full text-sm font-medium shadow-sm">{e}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Scoring Tab */}
            {activeTab === 'scoring' && (() => {
              const allDims = Array.from(new Set(result.question_level_scoring.map(q => q.dimension)));

              // Filtered list
              const filtered = result.question_level_scoring.filter(q => {
                const dimOk = scoringDimFilter === 'all' || q.dimension === scoringDimFilter;
                const scoreOk = scoringScoreFilter === 'all'
                  ? true : scoringScoreFilter === 'low' ? q.score <= 50
                  : scoringScoreFilter === 'mid' ? (q.score > 50 && q.score < 75)
                  : q.score >= 75;
                const kw = scoringSearch.toLowerCase();
                const searchOk = !kw || q.question_name.toLowerCase().includes(kw) || q.question_code.toLowerCase().includes(kw);
                return dimOk && scoreOk && searchOk;
              });

              const dimStyle = (dim: string) =>
                dim.includes('04') || dim.toLowerCase().includes('environmental')
                  ? { header: 'bg-teal-50 border-teal-200 text-teal-700', badge: 'bg-teal-100 text-teal-700' }
                  : dim.includes('05') || dim.toLowerCase().includes('social')
                    ? { header: 'bg-blue-50 border-blue-200 text-blue-700', badge: 'bg-blue-100 text-blue-700' }
                    : { header: 'bg-violet-50 border-violet-200 text-violet-700', badge: 'bg-violet-100 text-violet-700' };

              // Group filtered by dimension
              const grouped = allDims.map(dim => ({
                dim,
                qs: filtered.filter(q => q.dimension === dim),
              })).filter(g => g.qs.length > 0);

              return (
                <motion.div key="scoring" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-4">

                  {/* ── Filter Bar ── */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
                    <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />

                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text" value={scoringSearch}
                        onChange={e => setScoringSearch(e.target.value)}
                        placeholder="搜尋題目名稱…"
                        className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                      {scoringSearch && (
                        <button onClick={() => setScoringSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dimension filter */}
                    <div className="flex gap-1.5 flex-wrap">
                      {[{ v: 'all', label: '全部維度' }, ...allDims.map(d => ({ v: d, label: d.replace('#0', '#').split(' ')[0] }))].map(opt => (
                        <button key={opt.v} onClick={() => setScoringDimFilter(opt.v)}
                          className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                            scoringDimFilter === opt.v
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Score filter */}
                    <div className="flex gap-1.5">
                      {([
                        { v: 'all', label: '全部分數' },
                        { v: 'low', label: '⚠ ≤50' },
                        { v: 'mid', label: '51–74' },
                        { v: 'high', label: '✓ ≥75' },
                      ] as const).map(opt => (
                        <button key={opt.v} onClick={() => setScoringScoreFilter(opt.v)}
                          className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                            scoringScoreFilter === opt.v
                              ? opt.v === 'low' ? 'bg-red-500 text-white'
                                : opt.v === 'mid' ? 'bg-amber-400 text-white'
                                : opt.v === 'high' ? 'bg-emerald-500 text-white'
                                : 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <span className="text-xs text-slate-400 ml-auto shrink-0">
                      顯示 {filtered.length} / {result.question_level_scoring.length} 題
                    </span>
                  </div>

                  {/* ── Question Cards ── */}
                  {grouped.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                      <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>找不到符合條件的題目</p>
                    </div>
                  ) : grouped.map(({ dim, qs }) => {
                    const style = dimStyle(dim);
                    const dimAvg = Math.round(qs.reduce((a, q) => a + q.score, 0) / qs.length);
                    return (
                      <div key={dim} className={cn('rounded-2xl border overflow-hidden', style.header.split(' ').slice(1).join(' '))}>
                        {/* Dimension header */}
                        <div className={cn('px-6 py-4 flex items-center justify-between border-b', style.header)}>
                          <h4 className="font-bold text-base">{dim}</h4>
                          <div className={cn('px-3 py-1 rounded-full text-sm font-bold', style.badge)}>
                            平均 {dimAvg} 分 · {qs.length} 題
                          </div>
                        </div>

                        {/* Questions */}
                        <div className="divide-y divide-slate-100 bg-white">
                          {qs.map((q, i) => (
                            <div key={i} className="px-6 py-5 hover:bg-slate-50/40 transition-colors">
                              {/* Row 1: code + name + score */}
                              <div className="flex items-start gap-4 mb-3">
                                <code className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded break-all leading-relaxed shrink-0 max-w-[220px]">
                                  {q.question_code}
                                </code>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 leading-snug">{q.question_name}</p>
                                  {q.standard_requirement && q.standard_requirement !== '報告書未揭露此項目' && (
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                      <span className="font-semibold text-slate-500">準則：</span>{q.standard_requirement}
                                    </p>
                                  )}
                                </div>
                                <div className={cn(
                                  'shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold',
                                  q.score >= 75 ? 'bg-emerald-100 text-emerald-700'
                                    : q.score >= 51 ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700',
                                )}>
                                  <span className="text-xl leading-none">{q.score}</span>
                                  <span className="text-xs opacity-60">/100</span>
                                </div>
                              </div>
                              {/* Row 2: Sub-options checklist (DJSI logic) */}
                              {q.sub_options && q.sub_options.length > 0 && (
                                <div className="mb-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
                                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">子選項覆蓋狀態（DJSI 評分依據）</span>
                                    <span className={cn(
                                      'text-xs font-bold px-2 py-0.5 rounded-full',
                                      q.sub_options.filter(o => o.is_covered).length === q.sub_options.length
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : q.sub_options.filter(o => o.is_covered).length === 0
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-amber-100 text-amber-700',
                                    )}>
                                      {q.sub_options.filter(o => o.is_covered).length} / {q.sub_options.length} 已涵蓋
                                    </span>
                                  </div>
                                  <div className="divide-y divide-slate-50">
                                    {q.sub_options.map((opt, oi) => (
                                      <div key={oi} className={cn(
                                        'flex items-start gap-3 px-4 py-2.5 text-sm',
                                        opt.is_covered ? 'bg-emerald-50/30' : 'bg-red-50/20',
                                      )}>
                                        <span className={cn(
                                          'shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5',
                                          opt.is_covered ? 'bg-emerald-500' : 'bg-red-400',
                                        )}>
                                          {opt.is_covered ? '✓' : '✗'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <span className={cn(
                                            'font-medium',
                                            opt.is_covered ? 'text-slate-700' : 'text-slate-500',
                                          )}>
                                            {opt.option_text}
                                          </span>
                                          {opt.is_covered && opt.evidence && (
                                            <p className="mt-0.5 text-xs text-emerald-700 italic leading-relaxed">
                                              「{opt.evidence}」
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Row 3: analysis + evidence */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">一致性分析</div>
                                  <p className="text-sm text-slate-600 leading-relaxed">
                                    {q.consistency_analysis || '—'}
                                  </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">報告書引用</div>
                                  <p className="text-sm italic text-slate-500 leading-relaxed">
                                    {q.evidence_excerpt && q.evidence_excerpt !== '報告書未揭露此項目'
                                      ? `"${q.evidence_excerpt}"`
                                      : '（報告書未揭露相關內容）'}
                                  </p>
                                  {q.page_reference && q.page_reference !== '報告書未揭露此項目' && (
                                    <span className="inline-block mt-2 text-xs font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                      p.{q.page_reference}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              );
            })()}

            {/* Improvement Tab */}
            {activeTab === 'improvement' && (
              <motion.div key="improvement" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                {/* Keyword Adjustments */}
                {result.keyword_gap_analysis?.adjustments?.length > 0 && (
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-amber-200">
                    <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
                      <span>✍️</span>純文字與關鍵字校準
                      <span className="text-sm font-normal text-amber-600">Wording & Terminology Adjustments</span>
                    </h3>
                    <p className="text-sm text-amber-700 mb-6">
                      以下項目並非制度缺失，而是報告書中使用的意涵與準則字眼不夠吻合。建議直接抽換以下字詞以提高 CSA 機器審查的命中率。
                    </p>
                    <div className="space-y-4">
                      {result.keyword_gap_analysis.adjustments.map((adj, i) => (
                        <div key={i} className="rounded-xl border border-amber-100 bg-amber-50/30 overflow-hidden">
                          {/* Header: question code */}
                          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-700">關聯題項</span>
                            <code className="text-xs font-mono text-amber-600 bg-white border border-amber-200 px-2 py-0.5 rounded break-all">
                              {adj.question_code}
                            </code>
                          </div>
                          {/* Body: 3 columns on md+ */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-amber-100">
                            {/* Current wording */}
                            <div className="p-4">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">目前報告書用語</div>
                              <p className="text-sm text-slate-500 line-through decoration-red-400/60 leading-relaxed break-words">
                                {adj.current_wording}
                              </p>
                              {isEnglishReport && adj.current_wording_zh && (
                                <p className="text-xs text-slate-400 line-through decoration-red-300/40 italic mt-1 break-words">
                                  {adj.current_wording_zh}
                                </p>
                              )}
                            </div>
                            {/* Required keyword */}
                            <div className="p-4">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">建議替換為</div>
                              <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg leading-relaxed break-words inline-block">
                                {adj.required_keyword}
                              </p>
                              {isEnglishReport && adj.required_keyword_zh && (
                                <p className="text-xs text-emerald-600 mt-2 italic break-words">
                                  {adj.required_keyword_zh}
                                </p>
                              )}
                            </div>
                            {/* Explanation */}
                            <div className="p-4 bg-white/60">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">調整原因說明</div>
                              <p className="text-sm text-slate-600 leading-relaxed">{adj.explanation}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improvement Actions */}
                <div className="grid grid-cols-1 gap-6">
                  {result.improvement_path.improvement_actions.map((action, i) => (
                    <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8">
                      <div className="md:w-1/3">
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">{action.topic}</div>
                        <h4 className="text-lg font-bold text-slate-900 mb-4">現況缺口</h4>
                        <p className="text-slate-600 text-sm">{action.gap}</p>
                      </div>
                      <div className="md:w-2/3 bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-emerald-600" />建議行動方案
                        </h4>
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-700 leading-relaxed">{action.recommendation_zh}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border border-slate-200 border-dashed">
                            <p className="text-xs text-slate-500 italic font-mono">{action.recommendation_en}</p>
                          </div>
                          {action.benchmark_reference && (
                            <div className="mt-6 bg-blue-50/50 p-5 rounded-xl border border-blue-200">
                              <h5 className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-3">
                                <span>🏆</span>標竿對齊 ({action.benchmark_reference.company_name})
                              </h5>
                              <div className="space-y-3">
                                <div className="bg-white p-3 rounded border border-blue-100 italic text-sm text-slate-600 border-l-4 border-l-blue-400">
                                  "{action.benchmark_reference.excerpt}"
                                </div>
                                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                  <span className="font-bold text-blue-900">AI 解析：</span>{action.benchmark_reference.explanation}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggested Disclosure */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />建議揭露文本 (Suggested Disclosure)
                  </h3>
                  <div className="space-y-6">
                    {result.suggested_disclosure_text.suggested_text.map((text, i) => (
                      <div key={i}>
                        <div className="text-xs font-bold text-slate-400 mb-2">{text.topic}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg text-sm text-slate-700">{text.text_zh}</div>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 font-mono italic">{text.text_en}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

  // ─── Upload Screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold mb-8">
            <ShieldCheck className="w-4 h-4" />專業級 AI ESG 永續評估引擎
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            深度分析永續報告書，<br />
            <span className="text-emerald-600">模擬 S&P Global CSA 評級標準。</span>
          </h1>
          <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
            上傳您的永續報告書，AI 將依據 S&P Global CSA (ELQ) 框架進行全面審查，提供具備證據支持的評分與改善建議。
          </p>

          {/* ── Row 1: Main Report + Benchmark ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-4">
            {/* Main File */}
            <div {...getMainRootProps()}
              className={cn("relative group cursor-pointer p-8 border-2 border-dashed rounded-3xl transition-all h-full flex flex-col items-center justify-center",
                isMainDragActive ? "border-emerald-500 bg-emerald-50" : file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50")}>
              <input {...getMainInputProps()} />
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                file ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}>
                <FileUp className="w-6 h-6" />
              </div>
              {file ? (
                <div className="text-center">
                  <p className="text-slate-900 font-bold mb-1 truncate max-w-[200px]">{file.name}</p>
                  <p className="text-emerald-600 text-xs font-bold bg-emerald-100 px-2 py-1 rounded-md inline-block">主要報告書已就緒</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-slate-900 font-bold mb-2">上傳主要報告書 (必填)</p>
                  <p className="text-slate-400 text-xs">PDF / TXT / Markdown</p>
                </div>
              )}
            </div>

            {/* Benchmark File */}
            <div {...getBenchmarkRootProps()}
              className={cn("relative group cursor-pointer p-8 border-2 border-dashed rounded-3xl transition-all h-full flex flex-col items-center justify-center",
                isBenchmarkDragActive ? "border-blue-500 bg-blue-50" : benchmarkFile ? "border-blue-300 bg-blue-50/50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50")}>
              <input {...getBenchmarkInputProps()} />
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                benchmarkFile ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400")}>
                <FileUp className="w-6 h-6" />
              </div>
              {benchmarkFile ? (
                <div className="text-center">
                  <p className="text-slate-900 font-bold mb-1 truncate max-w-[200px]">{benchmarkFile.name}</p>
                  <p className="text-blue-600 text-xs font-bold bg-blue-100 px-2 py-1 rounded-md inline-block">標竿報告書已就緒</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-slate-900 font-bold mb-2">上傳標竿報告書 (選填)</p>
                  <p className="text-slate-400 text-xs">AI 優先引用此報告書作為標竿建議</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: Extra Files + URL Inputs ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-4">
            {/* Extra files (annual report, website export…) */}
            <div {...getExtraRootProps()}
              className={cn("group cursor-pointer p-6 border-2 border-dashed rounded-3xl transition-all flex flex-col items-center justify-center min-h-[140px]",
                isExtraDragActive ? "border-violet-500 bg-violet-50" : extraFiles.length > 0 ? "border-violet-300 bg-violet-50/40" : "border-slate-200 hover:border-violet-400 hover:bg-slate-50")}>
              <input {...getExtraInputProps()} />
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110",
                extraFiles.length > 0 ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-400")}>
                <FileText className="w-5 h-5" />
              </div>
              {extraFiles.length > 0 ? (
                <div className="text-center w-full">
                  <p className="text-violet-700 text-xs font-bold mb-1">已加入 {extraFiles.length} 個補充文件</p>
                  <div className="space-y-0.5">
                    {extraFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-500 bg-white border border-slate-100 px-2 py-1 rounded">
                        <span className="truncate max-w-[140px]">{f.name}</span>
                        <button onClick={e => { e.stopPropagation(); setExtraFiles(prev => prev.filter((_, pi) => pi !== i)); }}
                          className="ml-2 text-slate-300 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-slate-700 font-bold text-sm mb-1">年報 / 附加文件 (選填)</p>
                  <p className="text-slate-400 text-xs">可上傳多個：年報、官網匯出、其他 PDF</p>
                </div>
              )}
            </div>

            {/* URL inputs */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">官網 / 年報網址 (選填)</span>
              </div>
              {urlInputs.map((url, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="url" value={url}
                      onChange={e => setUrlInputs(prev => prev.map((u, i) => i === idx ? e.target.value : u))}
                      placeholder="https://www.example.com/sustainability"
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button onClick={() => handleFetchUrl(idx)} disabled={!url.trim() || fetchingUrl === idx}
                      className={cn("px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0",
                        urlTexts.some(u => u.url === url.trim()) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                      {fetchingUrl === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                        urlTexts.some(u => u.url === url.trim()) ? '✓ 已抓取' : '抓取'}
                    </button>
                  </div>
                  {urlErrors[idx] && <p className="text-xs text-red-500">{urlErrors[idx]}</p>}
                </div>
              ))}
              {urlInputs.length < 4 && (
                <button onClick={() => setUrlInputs(prev => [...prev, ''])}
                  className="text-xs text-slate-400 hover:text-emerald-600 transition-colors self-start">+ 新增網址</button>
              )}
              {urlTexts.length > 0 && (
                <p className="text-xs text-emerald-600 font-medium">✓ {urlTexts.length} 個網頁已擷取（共 {urlTexts.reduce((a, u) => a + u.text.length, 0).toLocaleString()} 字）</p>
              )}
            </div>
          </div>

          {file && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
              <button onClick={() => handleAnalyze(file, benchmarkFile)} disabled={isAnalyzing}
                className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-xl shadow-emerald-200 transition-all flex items-center gap-3 mx-auto">
                啟動 CSA 分析<ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {error && <p className="mt-4 text-red-500 text-sm font-medium">{error}</p>}
        </div>
      </div>

      {/* History Section */}
      <div className="max-w-4xl mx-auto w-full px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-700">歷史分析記錄</h2>
          {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {history.length === 0 && !loadingHistory ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">尚無歷史記錄</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((record) => (
              <motion.div key={record.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => handleLoadHistory(record.id)}
                className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                    record.overall_score >= 75 ? "bg-emerald-100 text-emerald-700" :
                      record.overall_score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                    {record.overall_score}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{record.filename}</p>
                    <p className="text-xs text-slate-400">{formatDate(record.created_at)} · {record.report_language === 'en' ? '英文報告' : '中文報告'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={(e) => handleDeleteHistory(e, record.id)}
                    className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Globe className="w-6 h-6" /></div>
          <h3 className="text-xl font-bold text-slate-900">國際合規標準</h3>
          <p className="text-slate-500 leading-relaxed">內建 S&P Global CSA (ELQ) 評分邏輯，精準對齊國際永續揭露框架，確保評估結果具備專業參考價值。</p>
        </div>
        <div className="space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Search className="w-6 h-6" /></div>
          <h3 className="text-xl font-bold text-slate-900">證據導向分析</h3>
          <p className="text-slate-500 leading-relaxed">所有評分皆附帶報告書原文引用與頁碼，拒絕憑空假設，為企業提供可稽核、可追蹤的審查診斷。</p>
        </div>
        <div className="space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Lightbulb className="w-6 h-6" /></div>
          <h3 className="text-xl font-bold text-slate-900">行動化改善建議</h3>
          <p className="text-slate-500 leading-relaxed">不只指出缺點，更提供具體的改善路徑與建議揭露文本，協助企業在下一年度的永續報告中取得更高評分。</p>
        </div>
      </div>

      <footer className="mt-auto py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">© 2026 AI ESG 永續評估引擎. 專業 ESG 顧問級別分析工具.</p>
        </div>
      </footer>
    </div>
  );
}
