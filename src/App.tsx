import React, { useState, useCallback } from 'react';
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
  ChevronRight,
  LayoutDashboard,
  ClipboardCheck
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeESGReport, ESGAnalysisResult } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Framework = 'CDP' | 'CSA';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [benchmarkFile, setBenchmarkFile] = useState<File | null>(null);
  const [activeFramework, setActiveFramework] = useState<Framework>('CSA');
  const [analyzingFramework, setAnalyzingFramework] = useState<Framework | null>(null);
  const [results, setResults] = useState<Record<Framework, ESGAnalysisResult | null>>({ CSA: null, CDP: null });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'scoring' | 'improvement'>('summary');

  const currentResult = results[activeFramework];

  const handleAnalyze = async (targetFramework: Framework, mainFile: File, optionalRefFile?: File | null) => {
    if (mainFile.size > 50 * 1024 * 1024 || (optionalRefFile && optionalRefFile.size > 50 * 1024 * 1024)) {
      setError('檔案過大（超過 50MB），為了穩定性，請上傳小於 50MB 的 PDF 或 Markdown 檔案。');
      return;
    }

    setAnalyzingFramework(targetFramework);
    setError(null);

    try {
      const analysisResult = await analyzeESGReport(mainFile, targetFramework, optionalRefFile || undefined);
      setResults(prev => ({ ...prev, [targetFramework]: analysisResult }));
      setAnalyzingFramework(null);
    } catch (err: any) {
      console.error('Analysis Error:', err);
      const errorMessage = err.message || JSON.stringify(err);

      if (errorMessage.includes('xhr error') || errorMessage.includes('Failed to fetch')) {
        setError('連線逾時或是後端服務無回應。建議：1. 檢查伺服器是否啟動 2. 嘗試稍後再試。');
      } else {
        setError(`分析失敗: ${errorMessage}`);
      }
      setAnalyzingFramework(null);
    }
  };

  const onMainDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const uploadedFile = acceptedFiles[0];
      setFile(uploadedFile);
      setError(null);
    }
  }, []);

  const onBenchmarkDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setBenchmarkFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps: getMainRootProps, getInputProps: getMainInputProps, isDragActive: isMainDragActive } = useDropzone({
    onDrop: onMainDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const { getRootProps: getBenchmarkRootProps, getInputProps: getBenchmarkInputProps, isDragActive: isBenchmarkDragActive } = useDropzone({
    onDrop: onBenchmarkDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const triggerAnalysis = () => {
    if (file) {
      handleAnalyze(activeFramework, file, benchmarkFile);
    }
  };

  const handleTabSwitch = (framework: Framework) => {
    setActiveFramework(framework);
    if (!results[framework] && file && !analyzingFramework) {
      handleAnalyze(framework, file, benchmarkFile);
    }
  };

  const reset = () => {
    setFile(null);
    setBenchmarkFile(null);
    setResults({ CSA: null, CDP: null });
    setError(null);
    setActiveFramework('CSA');
    setAnalyzingFramework(null);
  };

  if (analyzingFramework === activeFramework) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mx-auto relative" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">正在進行 ESG 深度評估...</h2>
          <div className="space-y-3 text-slate-500">
            <p className="animate-pulse-subtle">🔍 正在解析永續報告書文本與數據</p>
            <p className="animate-pulse-subtle delay-75">⚖️ 依據 {analyzingFramework} 框架進行合規性審查</p>
            <p className="animate-pulse-subtle delay-150">📊 計算各維度評分與缺口分析</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (currentResult) {
    const result = currentResult;
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 p-2 sm:p-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto sm:h-16 py-3 sm:py-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 p-2 rounded-lg hidden sm:block mt-1">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 truncate hidden sm:block">AI ESG 引擎</h1>
              </div>

              {/* Framework Switcher (Global Top Bar) */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shadow-inner max-w-md w-full sm:w-auto justify-center">
                <button
                  onClick={() => handleTabSwitch('CSA')}
                  disabled={analyzingFramework === 'CSA'}
                  className={cn(
                    "flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all relative",
                    activeFramework === 'CSA'
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  )}
                >
                  S&P Global CSA
                  {analyzingFramework === 'CSA' && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-2.5 opacity-50 text-emerald-600" />}
                </button>
                <div className="w-px bg-slate-200 my-2 mx-1 hidden sm:block"></div>
                <button
                  onClick={() => handleTabSwitch('CDP')}
                  disabled={analyzingFramework === 'CDP'}
                  className={cn(
                    "flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all relative",
                    activeFramework === 'CDP'
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  )}
                >
                  CDP Climate
                  {analyzingFramework === 'CDP' && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-2.5 opacity-50 text-emerald-600" />}
                </button>
              </div>
            </div>

            <button
              onClick={reset}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm sm:border-0 sm:shadow-none sm:bg-transparent"
            >
              重新上傳報告
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Dashboard Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Score Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center"
            >
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {result.dashboard_summary.framework} 綜合評分
              </span>
              <div className="relative">
                <svg className="w-48 h-48">
                  <circle
                    className="text-slate-100"
                    strokeWidth="12"
                    stroke="currentColor"
                    fill="transparent"
                    r="80"
                    cx="96"
                    cy="96"
                  />
                  <circle
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                    strokeWidth="12"
                    strokeDasharray={502.4}
                    strokeDashoffset={502.4 - (502.4 * result.dashboard_summary.overall_score) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="80"
                    cx="96"
                    cy="96"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {result.dashboard_summary.letter_grade ? (
                    <>
                      <span className="text-[3.5rem] font-black text-slate-900 leading-none">{result.dashboard_summary.letter_grade}</span>
                      <span className="text-xs font-bold text-slate-400 mt-1">({result.dashboard_summary.overall_score} / 100)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-5xl font-bold text-slate-900">{result.dashboard_summary.overall_score}</span>
                      <span className="text-slate-400 font-medium">/ 100</span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-6 flex gap-4">
                {Object.entries(result.dashboard_summary.dimension_scores).map(([key, score]) => (
                  <div key={key} className="text-center">
                    <div className="text-xs font-medium text-slate-400 mb-1">{key}</div>
                    <div className="text-sm font-bold text-slate-700">{score}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Radar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-200"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                合規性分析雷達圖
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={result.dashboard_summary.radar_chart_data}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="#059669"
                      fill="#10b981"
                      fillOpacity={0.6}
                    />
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
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Executive Diagnosis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      核心優勢
                    </h3>
                    <ul className="space-y-3">
                      {result.executive_diagnosis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-3 text-slate-600">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      主要缺口
                    </h3>
                    <ul className="space-y-3">
                      {result.executive_diagnosis.gaps.map((g, i) => (
                        <li key={i} className="flex items-start gap-3 text-slate-600">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Critical Missing Elements */}
                <div className="bg-red-50 border border-red-100 p-8 rounded-2xl">
                  <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    關鍵缺失揭露項目
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {result.executive_diagnosis.critical_missing_elements.map((e, i) => (
                      <span key={i} className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-full text-sm font-medium shadow-sm">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>


              </motion.div>
            )}

            {activeTab === 'scoring' && (
              <motion.div
                key="scoring"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">題號</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">評估維度 / 題名</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">得分</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">一致性分析</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">證據引用</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.question_level_scoring.map((q, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-slate-400">{q.question_code}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs font-medium text-emerald-600 mb-1">{q.dimension}</div>
                            <div className="text-sm font-bold text-slate-900">{q.question_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={cn(
                              "inline-flex items-center justify-center min-w-[2.5rem] h-10 px-2 rounded-full text-sm font-bold",
                              (q.letter_grade?.startsWith('A') || q.letter_grade?.startsWith('B') || q.score >= 80) ? "bg-emerald-100 text-emerald-700" :
                                (q.letter_grade?.startsWith('C') || q.score >= 50) ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                            )}>
                              {q.letter_grade || q.score}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{q.consistency_analysis}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 italic text-xs text-slate-500">
                              "{q.evidence_excerpt}"
                              <div className="mt-2 font-bold text-slate-400">P. {q.page_reference}</div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'improvement' && (
              <motion.div
                key="improvement"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Keyword & Terminology Adjustments */}
                {result.keyword_gap_analysis?.adjustments && result.keyword_gap_analysis.adjustments.length > 0 && (
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-amber-200">
                    <h3 className="text-lg font-bold text-amber-900 mb-6 flex items-center gap-2">
                      <span>✍️</span>純文字與關鍵字校準 (Wording & Terminology Adjustments)
                    </h3>
                    <p className="text-sm text-amber-700 mb-6">
                      以下項目並非制度缺失，而是報告書中使用的意涵與準則字眼不夠吻合。建議直接抽換以下字詞以提高機器審查的命中率 (Keyword Match)。
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-amber-50 border-b border-amber-100">
                            <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider w-24">關聯題項</th>
                            <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider w-1/4">目前報告書用語</th>
                            <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider w-1/4">標準要求關鍵字</th>
                            <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">調整原因說明</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50">
                          {result.keyword_gap_analysis.adjustments.map((adj, i) => (
                            <tr key={i} className="hover:bg-amber-50/30 transition-colors bg-white">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="font-mono text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">{adj.question_code}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-sm font-medium text-slate-500 line-through decoration-red-400/50">{adj.current_wording}</div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-sm font-bold text-emerald-700 bg-emerald-50 inline-block px-2 py-1 rounded border border-emerald-100">
                                  {adj.required_keyword}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <p className="text-sm text-slate-600">{adj.explanation}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                          <ArrowRight className="w-4 h-4 text-emerald-600" />
                          建議行動方案
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

                {/* Suggested Disclosure Text */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    建議揭露文本 (Suggested Disclosure)
                  </h3>
                  <div className="space-y-6">
                    {result.suggested_disclosure_text.suggested_text.map((text, i) => (
                      <div key={i} className="group">
                        <div className="text-xs font-bold text-slate-400 mb-2">{text.topic}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg text-sm text-slate-700">
                            {text.text_zh}
                          </div>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 font-mono italic">
                            {text.text_en}
                          </div>
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero Section */}
      <div className="bg-white border-b border-slate-200 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold mb-8"
          >
            <ShieldCheck className="w-4 h-4" />
            專業級 AI ESG 永續評估引擎
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            深度分析永續報告書，<br />
            <span className="text-emerald-600">模擬國際評級標準。</span>
          </h1>
          <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
            上傳您的永續報告書 PDF，AI 將依據 CDP 或 S&P Global CSA 框架進行全面審查，提供具備證據支持的評分與改善建議。
          </p>

          {/* Framework Selector */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setActiveFramework('CSA')}
              className={cn(
                "px-8 py-3 rounded-xl text-sm font-bold transition-all border-2",
                activeFramework === 'CSA'
                  ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              優先分析: S&P Global CSA
            </button>
            <button
              onClick={() => setActiveFramework('CDP')}
              className={cn(
                "px-8 py-3 rounded-xl text-sm font-bold transition-all border-2",
                activeFramework === 'CDP'
                  ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              優先分析: CDP Climate Change
            </button>
          </div>

          {/* Upload Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-4">
            <div
              {...getMainRootProps()}
              className={cn(
                "relative group cursor-pointer p-8 border-2 border-dashed rounded-3xl transition-all h-full flex flex-col items-center justify-center",
                isMainDragActive ? "border-emerald-500 bg-emerald-50" : file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
              )}
            >
              <input {...getMainInputProps()} />
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                file ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
              )}>
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
                  <p className="text-slate-400 text-xs">PDF 或 Markdown 格式</p>
                </div>
              )}
            </div>

            <div
              {...getBenchmarkRootProps()}
              className={cn(
                "relative group cursor-pointer p-8 border-2 border-dashed rounded-3xl transition-all h-full flex flex-col items-center justify-center",
                isBenchmarkDragActive ? "border-blue-500 bg-blue-50" : benchmarkFile ? "border-blue-300 bg-blue-50/50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
              )}
            >
              <input {...getBenchmarkInputProps()} />
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                benchmarkFile ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"
              )}>
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
                  <p className="text-slate-400 text-xs">用於給予 AI 參考好的作法</p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10"
            >
              <button
                onClick={triggerAnalysis}
                disabled={analyzingFramework !== null}
                className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-xl shadow-emerald-200 transition-all flex items-center gap-3 mx-auto"
              >
                自動啟動 {activeFramework} 分析
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {error && (
            <p className="mt-4 text-red-500 text-sm font-medium">{error}</p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">國際合規標準</h3>
          <p className="text-slate-500 leading-relaxed">
            內建 CDP 與 S&P Global CSA 評分邏輯，精準對齊國際永續揭露框架，確保評估結果具備專業參考價值。
          </p>
        </div>
        <div className="space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">證據導向分析</h3>
          <p className="text-slate-500 leading-relaxed">
            所有評分皆附帶報告書原文引用與頁碼，拒絕憑空假設，為企業提供可稽核、可追蹤的審查診斷。
          </p>
        </div>
        <div className="space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">行動化改善建議</h3>
          <p className="text-slate-500 leading-relaxed">
            不只指出缺點，更提供具體的改善路徑與建議揭露文本，協助企業在下一年度的永續報告中取得更高評分。
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">© 2026 AI ESG 永續評估引擎. 專業 ESG 顧問級別分析工具.</p>
        </div>
      </footer>
    </div>
  );
}
