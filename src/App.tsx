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
  const [framework, setFramework] = useState<Framework>('CSA');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ESGAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'scoring' | 'improvement'>('summary');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt']
    },
    multiple: false,
    noClick: false,
    noKeyboard: false
  });

  const handleAnalyze = async () => {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('檔案過大（超過 50MB），為了穩定性，請上傳小於 50MB 的 PDF 或 Markdown 檔案。');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzeESGReport(file, framework);
      setResult(analysisResult);
      setIsAnalyzing(false);
    } catch (err: any) {
      console.error('Analysis Error:', err);
      const errorMessage = err.message || JSON.stringify(err);

      if (errorMessage.includes('xhr error') || errorMessage.includes('500') || errorMessage.includes('Failed to fetch')) {
        setError('連線逾時或是後端服務無法處理此大型檔案。建議：1. 檢查伺服器是否啟動 2. 嘗試稍後再試。');
      } else {
        setError(`分析失敗: ${errorMessage}`);
      }
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  if (isAnalyzing) {
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
            <p className="animate-pulse-subtle delay-75">⚖️ 依據 {framework} 框架進行合規性審查</p>
            <p className="animate-pulse-subtle delay-150">📊 計算各維度評分與缺口分析</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">AI ESG 永續評估引擎</h1>
            </div>
            <button
              onClick={reset}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
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
                  <span className="text-5xl font-bold text-slate-900">{result.dashboard_summary.overall_score}</span>
                  <span className="text-slate-400 font-medium">/ 100</span>
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

                {/* Keyword Gap Analysis */}
                <div className="bg-slate-900 p-8 rounded-2xl text-white">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Search className="w-5 h-5 text-emerald-400" />
                      關鍵字缺口分析 (Keyword Gap)
                    </h3>
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Missing Keywords</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {result.keyword_gap_analysis.missing_keywords.map((kw, i) => (
                      <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-slate-300 hover:bg-white/10 transition-colors">
                        {kw}
                      </div>
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
                              "inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold",
                              q.score >= 80 ? "bg-emerald-100 text-emerald-700" :
                                q.score >= 50 ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                            )}>
                              {q.score}
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-sm text-slate-600 line-clamp-3">{q.consistency_analysis}</p>
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
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setFramework('CSA')}
              className={cn(
                "px-8 py-3 rounded-xl text-sm font-bold transition-all border-2",
                framework === 'CSA'
                  ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              S&P Global CSA
            </button>
            <button
              onClick={() => setFramework('CDP')}
              className={cn(
                "px-8 py-3 rounded-xl text-sm font-bold transition-all border-2",
                framework === 'CDP'
                  ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              CDP Climate Change
            </button>
          </div>

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={cn(
              "relative group cursor-pointer max-w-xl mx-auto",
              "p-12 border-2 border-dashed rounded-3xl transition-all",
              isDragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                isDragActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
              )}>
                <FileUp className="w-8 h-8" />
              </div>
              {file ? (
                <div className="text-center">
                  <p className="text-slate-900 font-bold mb-1">{file.name}</p>
                  <p className="text-slate-400 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-900 font-bold mb-2">點擊或拖拽永續報告書 PDF/MD 至此</p>
                  <p className="text-slate-400 text-sm">支援 PDF 或 Markdown 格式，上限 50MB</p>
                </>
              )}
            </div>
          </div>

          {file && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-xl shadow-emerald-200 transition-all flex items-center gap-3 mx-auto"
              >
                開始 AI 永續評估分析
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
