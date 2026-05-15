import { 
  LayoutDashboard, 
  ReceiptText, 
  Bot, 
  Settings, 
  Plus, 
  Search, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Copy, 
  X, 
  ChevronRight,
  ChevronLeft, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Tag,
  Leaf,
  LogOut,
  Monitor,
  Smartphone,
  FolderSync,
  RefreshCw,
  MoreHorizontal,
  Home,
  FileJson,
  BarChart2,
  Share2,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Folder,
  User,
  Mail,
  Ghost,
  Minus,
  Undo2,
  Redo2,
  ShieldCheck,
  Cloud,
  Play,
  Lock,
  ArrowDownUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
  Scale
} from 'chart.js';
import { Bar as ChartBar, Line as ChartLine, Doughnut } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'hammerjs';

// Removed import as requested for single-file/CDN compatibility
// import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cigrmsoprnefiwbenbuv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZ3Jtc29wcm5lZml3YmVuYnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM0ODIsImV4cCI6MjA5NDM4OTQ4Mn0.C_njZ0VD_qwKnGGgEcaBUy9Qm0xXbtia1inucnmqckg';

// Using global supabase object from CDN safely
let supabase: any = null;
try {
  // @ts-ignore
  if (window.supabase) {
    // @ts-ignore
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("Erro ao inicializar Supabase:", e);
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler,
  zoomPlugin
);

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'sonner';
import { initDB, getState, saveState, clearState } from './db';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// --- Types ---
type TransactionType = 'entrada' | 'saída';

interface Transaction {
  id: string;
  date: string;
  desc: string;
  value: number;
  category: string;
  type: TransactionType;
  profile_name: string;
}

interface Category {
  name: string;
  id: string;
  color?: string;
}

const DEFAULT_CATEGORIES = [
  'Moradia', 'Alimentação', 'Transporte', 'Educação', 'Lazer', 'Saúde', 'Trabalho', 'Outros'
];

type Tab = 'reports' | 'transactions' | 'ai' | 'categories' | 'settings' | 'about';

const VIBRANT_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', 
  '#06b6d4', '#10b981', '#f43f5e', '#6366f1', '#a855f7',
  '#ef4444', '#14b8a6', '#f59e0b', '#84cc16'
];

interface DateFilter {
  month: number;
  year: number;
  type: 'month' | 'custom' | 'all';
  startDate?: string;
  endDate?: string;
}

interface AnalyticsConfig {
  granularity: 'day' | 'month' | 'year';
  compareCategories: string[];
}

const CategoryDonut = ({ data, colorMode }: { 
  data: any[], 
  colorMode: 'unique' | 'flow'
}) => {
  const chartData = {
    labels: data.map(d => d.name),
    datasets: [{
      data: data.map(d => d.value),
      backgroundColor: data.map((d, i) => {
        if (colorMode === 'unique') {
          return VIBRANT_PALETTE[i % VIBRANT_PALETTE.length];
        }
        const dominantType = d.income >= d.expense ? 'entrada' : 'saída';
        // Dynamically varying shades/opacities for unique identifies in Flow Mode
        const hue = dominantType === 'entrada' ? 142 : 350; // Greenish vs Reddish
        const lightness = 45 + (i % 5) * 7;
        const opacity = 0.6 + (i % 3) * 0.1;
        return `hsla(${hue}, 70%, ${lightness}%, ${opacity})`;
      }),
      borderColor: 'rgba(255,255,255,0.05)',
      borderWidth: 2,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
           label: (context: any) => ` ${formatCurrency(context.raw)}`
        }
      },
      zoom: {
        pan: { enabled: true, mode: 'xy' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' as const }
      }
    },
    cutout: '70%'
  };

  return <Doughnut data={chartData} options={options} />;
};

const TimelineChart = ({ data, isPerformance = false, onPointClick, viewMode = 'tudo' }: { data: any[], type?: 'bar' | 'area', isPerformance?: boolean, onPointClick?: (date: string) => void, viewMode?: string }) => {
  const chartRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeData, setActiveData] = useState<{income: number, expense: number, net: number, cumulative?: number, date?: string} | null>(null);

  const handleReset = () => {
    chartRef.current?.resetZoom();
    setActiveIndex(null);
    setActiveData(null);
  };

  const cumulativeData = useMemo(() => {
    try {
      if (!isPerformance) return [];
      let runningSum = 0;
      return data.map(d => {
        let val = 0;
        if (viewMode === 'tudo' || viewMode === 'personalizado') {
          val = d.income - d.expense;
        } else if (viewMode === 'receitas') {
          val = d.income;
        } else if (viewMode === 'despesas') {
          val = d.expense;
        }
        runningSum += val;
        return runningSum;
      });
    } catch (e) {
      console.error("Erro ao calcular dados acumulados:", e);
      return [];
    }
  }, [data, isPerformance, viewMode]);

  const maxVal = useMemo(() => {
    try {
      if (isPerformance) {
          if (cumulativeData.length === 0) return 100;
          return Math.max(...cumulativeData.map(Math.abs), 100);
      }
      return Math.max(...data.flatMap(d => [d.income, d.expense]), 100);
    } catch (e) {
      return 100;
    }
  }, [data, isPerformance, cumulativeData]);
  
  const chartData = useMemo(() => {
    try {
      if (isPerformance) {
        const color = (viewMode === 'despesas') ? '#ef4444' : '#10b981';
        return {
          labels: data.map(d => d.name),
          datasets: [{
            label: 'Acumulado',
            data: cumulativeData,
            fill: true,
            tension: 0.4,
            borderColor: color,
            backgroundColor: `${color}33`,
            pointRadius: data.map((_, i) => i === activeIndex ? 6 : 0),
            pointBackgroundColor: data.map((_, i) => i === activeIndex ? '#ffffff' : color),
            pointHoverRadius: 8,
            pointHitRadius: 15,
          }]
        };
      }

      return {
        labels: data.map(d => d.name),
        datasets: [
          {
            label: 'Receitas (Base)',
            data: data.map(d => d.income),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: data.map((_, i) => i === activeIndex ? '#ffffff' : 'transparent'),
            borderWidth: data.map((_, i) => i === activeIndex ? 3 : 0),
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
            grouped: false,
            order: 2,
          },
          {
            label: 'Despesas (Base)',
            data: data.map(d => d.expense),
            backgroundColor: 'rgba(244, 63, 94, 0.8)',
            borderColor: data.map((_, i) => i === activeIndex ? '#ffffff' : 'transparent'),
            borderWidth: data.map((_, i) => i === activeIndex ? 3 : 0),
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
            grouped: false,
            order: 2,
          },
          {
            label: 'Receitas (Top)',
            data: data.map(d => d.income < d.expense ? d.income : 0),
            backgroundColor: 'rgba(16, 185, 129, 1)',
            borderColor: data.map((_, i) => i === activeIndex ? '#ffffff' : 'transparent'),
            borderWidth: data.map((_, i) => i === activeIndex ? 3 : 0),
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
            grouped: false,
            order: 1,
          },
          {
            label: 'Despesas (Top)',
            data: data.map(d => d.expense < d.income ? d.expense : 0),
            backgroundColor: 'rgba(244, 63, 94, 1)',
            borderColor: data.map((_, i) => i === activeIndex ? '#ffffff' : 'transparent'),
            borderWidth: data.map((_, i) => i === activeIndex ? 3 : 0),
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
            grouped: false,
            order: 1,
          }
        ]
      };
    } catch (e) {
      console.error("Erro ao gerar chartData:", e);
      return { labels: [], datasets: [] };
    }
  }, [data, activeIndex, isPerformance, cumulativeData, viewMode]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: {
      padding: { bottom: 25 }
    },
    onClick: (e: any, elements: any) => {
      try {
        const chart = chartRef.current;
        if (!chart) return;

        if (elements.length > 0) {
          const index = elements[0].index;
          setActiveIndex(index);
          const item = data[index];
          
          if (isPerformance) {
            setActiveData({
              income: item.income,
              expense: item.expense,
              net: item.income - item.expense,
              cumulative: cumulativeData[index],
              date: new Date(item.fullDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            });

            chart.data.datasets[0].pointRadius = data.map((_, i: number) => i === index ? 6 : 0);
            const color = (viewMode === 'despesas') ? '#ef4444' : '#10b981';
            chart.data.datasets[0].pointBackgroundColor = data.map((_, i: number) => i === index ? '#ffffff' : color);
          } else {
            setActiveData({
              income: item.income,
              expense: item.expense,
              net: item.income - item.expense
            });
            if (onPointClick) onPointClick(data[index].fullDate);
            
            chart.data.datasets.forEach((dataset: any) => {
              dataset.borderColor = data.map((_, i: number) => i === index ? '#ffffff' : 'transparent');
              dataset.borderWidth = data.map((_, i: number) => i === index ? 3 : 0);
            });
          }
        } else {
          setActiveIndex(null);
          setActiveData(null);
          if (isPerformance) {
            chart.data.datasets[0].pointRadius = 0;
          } else {
            chart.data.datasets.forEach((dataset: any) => {
              dataset.borderWidth = 0;
            });
          }
        }
        chart.update('none');
      } catch (err) {
        console.error("Erro ao manipular clique no gráfico:", err);
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy' as const,
          threshold: 10,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy' as const,
        },
        limits: {
          x: {
            min: -5,
            max: data.length + 5,
            minRange: 5
          }
        }
      }
    },
    scales: {
      x: { 
        stacked: false,
        grid: { 
          color: 'rgba(255,255,255,0.05)', 
          lineWidth: 1,
          drawBorder: true,
        }, 
        ticks: { 
          color: '#64748b', 
          font: { size: 10, weight: 'bold' as const },
          maxRotation: 0,
          autoSkip: false,
          padding: 10,
          callback: function(val: any, index: number) {
            const currentItem = data[val];
            if (!currentItem) return '';
            
            const date = new Date(currentItem.fullDate);
            const month = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
            const day = date.getDate();

            if (index === 0) return `${month} ${day}`;
            
            const prevItem = data[val - 1];
            if (!prevItem) return `${month} ${day}`;
            
            const prevDate = new Date(prevItem.fullDate);
            if (date.getMonth() !== prevDate.getMonth()) {
                return `${month} ${day}`;
            }
            
            return day.toString();
          }
        } 
      },
      y: { 
        stacked: false,
        min: isPerformance ? undefined : 0,
        max: maxVal * 1.2,
        grid: { color: 'rgba(255,255,255,0.03)' }, 
        ticks: { 
          color: '#475569', 
          font: { size: 10 },
          callback: (val: any) => formatCurrency(val)
        } 
      }
    }
  }), [data, onPointClick, maxVal, isPerformance, cumulativeData, viewMode]);

  try {
    return (
      <div className="w-full h-full relative group flex flex-col">
        {activeData && !isPerformance && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap justify-between items-center text-[10px] p-3 bg-slate-900/80 backdrop-blur-md rounded-xl mb-4 border border-white/5 shadow-2xl gap-3"
          >
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-400 font-black uppercase tracking-widest">Receitas:</span>
                <span className="text-emerald-400 font-black">{formatCurrency(activeData.income)}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-400 font-black uppercase tracking-widest">Despesas:</span>
                <span className="text-rose-400 font-black">{formatCurrency(activeData.expense)}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-400 font-black uppercase tracking-widest">Líquido:</span>
                <span className={cn("font-black", activeData.net >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatCurrency(activeData.net)}
                </span>
            </div>
          </motion.div>
        )}

        {activeData && isPerformance && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap justify-between items-center text-[10px] p-3 bg-slate-900/80 backdrop-blur-md rounded-xl mb-4 border border-white/5 shadow-2xl gap-3"
          >
            <div className="flex items-center gap-2">
                <span className="text-slate-400 font-black uppercase tracking-widest">Acumulado até {activeData.date}:</span>
                <span className={cn("font-black text-xs", (activeData.cumulative || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatCurrency(activeData.cumulative || 0)}
                </span>
            </div>
          </motion.div>
        )}

        <div className="flex justify-end items-center gap-2 mb-2">
          <div className="flex bg-slate-900/60 backdrop-blur-xl p-1 rounded-xl border border-white/10">
              <button 
                onClick={handleReset}
                className="px-3 h-8 flex items-center gap-2 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase text-slate-300 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                Resetar Zoom
              </button>
          </div>
        </div>

        <div className="flex-1 relative bg-black/10 rounded-2xl border border-white/5 shadow-inner overflow-hidden">
          <div className="w-full h-full relative">
            {isPerformance ? (
              <ChartLine 
                ref={chartRef} 
                data={chartData} 
                options={options} 
              />
            ) : (
              <ChartBar ref={chartRef} data={chartData} options={options} />
            )}
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error("Erro fatal ao renderizar TimelineChart:", err);
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 rounded-2xl border border-white/5 p-8 text-center gap-4">
        <Ghost className="w-10 h-10 text-slate-700" />
        <div className="space-y-1">
          <p className="text-xs font-black text-slate-500 uppercase">Ops! O Gráfico falhou</p>
          <p className="text-[10px] text-slate-600">Tente atualizar a página ou mudar os filtros.</p>
        </div>
      </div>
    );
  }
};


const ComparisonChart = ({ 
  data, 
  colorMode,
  setColorMode,
  viewMode,
  setViewMode,
  title 
}: { 
  data: any[], 
  colorMode: 'unique' | 'flow',
  setColorMode: (m: 'unique' | 'flow') => void,
  viewMode: 'tudo' | 'receitas' | 'despesas',
  setViewMode: (m: 'tudo' | 'receitas' | 'despesas') => void,
  title: string
}) => {
  return (
    <CategoryDonutSection 
      data={data}
      colorMode={colorMode}
      setColorMode={setColorMode}
      viewMode={viewMode}
      setViewMode={setViewMode}
      title={title}
    />
  );
};

const CategoryDonutSection = ({ 
  data, 
  colorMode, 
  setColorMode, 
  viewMode, 
  setViewMode,
  title
}: { 
  data: any[], 
  colorMode: 'unique' | 'flow', 
  setColorMode?: (m: 'unique' | 'flow') => void, 
  viewMode: 'tudo' | 'receitas' | 'despesas', 
  setViewMode?: (m: 'tudo' | 'receitas' | 'despesas') => void, 
  title: string
}) => {
  try {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-lg uppercase tracking-tighter">{title}</h3>
            {setColorMode && (
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button 
                    onClick={() => setColorMode('unique')}
                    className={cn("px-2 py-1 text-[8px] font-black rounded transition-all", colorMode === 'unique' ? "bg-white/10 text-white" : "text-slate-500")}
                  >
                    COLORIDO
                  </button>
                  <button 
                    onClick={() => setColorMode('flow')}
                    className={cn("px-2 py-1 text-[8px] font-black rounded transition-all", colorMode === 'flow' ? "bg-white/10 text-white" : "text-slate-500")}
                  >
                    FLUXO
                  </button>
              </div>
            )}
          </div>
          
          {setViewMode && (
            <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                {(['tudo', 'receitas', 'despesas'] as const).map(m => (
                  <button 
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-black rounded-xl transition-all", 
                      viewMode === m ? (m === 'tudo' ? "bg-white/10 text-white" : m === 'receitas' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white") : "text-slate-500"
                    )}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-h-[250px] relative">
          <CategoryDonut data={data} colorMode={colorMode} />
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 space-y-2 overflow-y-auto max-h-32 custom-scrollbar pr-2">
          <div className="text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">Mapa de Categorias (%)</div>
          <div className="grid grid-cols-1 gap-1.5">
              {data.sort((a, b) => b.value - a.value).map((cat, i) => {
                const dominantType = cat.income >= cat.expense ? 'entrada' : 'saída';
                let fill = colorMode === 'unique' ? VIBRANT_PALETTE[i % VIBRANT_PALETTE.length] : (dominantType === 'entrada' ? '#10b981' : '#f43f5e');

                return (
                  <div key={cat.name} className="flex items-center justify-between text-[10px] bg-white/2 p-2 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: fill, opacity: colorMode === 'unique' ? 1 : 0.4 + (i * 0.1) }} />
                      <span className="font-bold text-slate-400 truncate max-w-[120px] tracking-tight">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-white">{formatCurrency(cat.value)}</span>
                        <span className="text-[8px] text-slate-600 font-bold">{( (cat.value / (data.reduce((a,b)=>a+b.value, 0) || 1)) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error("Erro ao renderizar CategoryDonutSection:", err);
    return <div className="p-4 text-xs text-rose-500">Erro ao carregar análise de categorias</div>;
  }
};

type BootStage = 'splash' | 'presentation' | 'auth' | 'welcome' | 'profile_select' | 'ready' | 'syncing';

export default function App() {
  const [bootStage, setBootStage] = useState<BootStage>('syncing');
  const [user, setUser] = useState<any>(null);
  const [isCloudMode, setIsCloudMode] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('reports');
  const [activeProfile, setActiveProfile] = useState<string>(() => {
    return localStorage.getItem('verdegrana_active_profile') || 'Principal';
  });
  const [viewMode, setViewMode] = useState<'tudo' | 'receitas' | 'despesas' | 'personalizado'>('tudo');
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: '', description: '', action: () => {} });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('verdegrana_data');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<Transaction[][]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('verdegrana_categories');
    const defaultCats = DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c }));
    if (!saved) return defaultCats;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : defaultCats;
    } catch {
      return defaultCats;
    }
  });
  
  // Edge-Swipe Logic
  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [edgeSwipe, setEdgeSwipe] = useState<{
    side: 'left' | 'right' | null;
    distance: number;
    active: boolean;
  }>({ side: null, distance: 0, active: false });

  const onTouchStart = (e: React.TouchEvent) => {
    if (bootStage !== 'ready') return;
    
    const x = e.targetTouches[0].clientX;
    const y = e.targetTouches[0].clientY;
    const edgeThreshold = 40; // Slightly larger for better hit area

    let side: 'left' | 'right' | null = null;
    if (x < edgeThreshold) side = 'left';
    else if (x > window.innerWidth - edgeThreshold) side = 'right';

    if (side) {
      setEdgeSwipe({ side, distance: 0, active: true });
      touchStart.current = { x, y };
    } else {
      setEdgeSwipe({ side: null, distance: 0, active: false });
      touchStart.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!edgeSwipe.active || !touchStart.current) return;
    
    const x = e.targetTouches[0].clientX;
    const deltaX = x - touchStart.current.x;
    
    // For left edge, distance is deltaX. For right edge, distance is -deltaX.
    const distance = edgeSwipe.side === 'left' ? deltaX : -deltaX;
    
    setEdgeSwipe(prev => ({ ...prev, distance: Math.max(0, distance) }));
  };

  const onTouchEnd = () => {
    if (!edgeSwipe.active || !touchStart.current) {
      setEdgeSwipe({ side: null, distance: 0, active: false });
      return;
    }

    const threshold = 120;
    const mainTabs: Tab[] = ['reports', 'transactions', 'ai', 'settings'];
    const currentMainIndex = mainTabs.indexOf(activeTab as any);

    if (edgeSwipe.distance > threshold && currentMainIndex !== -1) {
      if (edgeSwipe.side === 'left' && currentMainIndex > 0) {
        setActiveTab(mainTabs[currentMainIndex - 1]);
      } else if (edgeSwipe.side === 'right' && currentMainIndex < mainTabs.length - 1) {
        setActiveTab(mainTabs[currentMainIndex + 1]);
      }
    }

    setEdgeSwipe({ side: null, distance: 0, active: false });
    touchStart.current = null;
  };
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error'>('idle');

  // UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>({ 
    month: new Date().getMonth() + 1, 
    year: new Date().getFullYear(),
    type: 'all'
  });
  const [analyticsConfig, setAnalyticsConfig] = useState<AnalyticsConfig>({
    granularity: 'month',
    compareCategories: []
  });
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<'date' | 'value-asc' | 'value-desc'>('date');
  const [donutColorMode, setDonutColorMode] = useState<'unique' | 'flow'>('unique');
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [donutType, setDonutType] = useState<'saída' | 'entrada'>('saída');
  const [donutViewMode, setDonutViewMode] = useState<'tudo' | 'receitas' | 'despesas'>('despesas');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);
  const [isDashboardRevealed, setIsDashboardRevealed] = useState(false);

  const [uiScale, setUiScale] = useState<number>(() => {
    const saved = localStorage.getItem('verdegrana_ui_scale');
    return saved ? parseInt(saved) : 100;
  });

  const applyUIScale = useCallback((scaleValue: number) => {
    document.documentElement.style.fontSize = `${scaleValue}%`;
  }, []);

  useEffect(() => {
    applyUIScale(uiScale);
    localStorage.setItem('verdegrana_ui_scale', uiScale.toString());
  }, [uiScale, applyUIScale]);

  const handlePointClick = useCallback((date: string) => {
    setSelectedPeriod(date);
  }, []);
  const [wipeStep, setWipeStep] = useState(0);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  // Undo/Redo Logic
  const pushToHistory = useCallback((newTransactions: Transaction[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyPointer + 1);
      newHistory.push(newTransactions);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryPointer(prev => Math.min(prev + 1, 49));
  }, [historyPointer]);

  const undo = async () => {
    if (historyPointer > 0) {
      const prevState = history[historyPointer - 1];
      const currentState = transactions;
      
      // Omni-Sync: Detect difference and sync to cloud
      if (isCloudMode && user && supabase) {
        const removed = currentState.filter(t => !prevState.some(pt => pt.id === t.id));
        const added = prevState.filter(pt => !currentState.some(t => t.id === pt.id));
        
        if (removed.length > 0) {
          await supabase.from('transactions').delete().in('id', removed.map(t => t.id));
        }
        if (added.length > 0) {
          await supabase.from('transactions').insert(added.map(t => ({
            id: t.id,
            user_id: user.id,
            date: t.date,
            description: t.desc,
            category: t.category,
            type: t.type,
            amount: t.value,
            profile_name: t.profile_name
          })));
        }
      }
      
      setTransactions(prevState);
      setHistoryPointer(historyPointer - 1);
      toast.info('Ação desfeita');
    }
  };

  const redo = async () => {
    if (historyPointer < history.length - 1) {
      const nextState = history[historyPointer + 1];
      const currentState = transactions;

      // Omni-Sync: Detect difference and sync to cloud
      if (isCloudMode && user && supabase) {
        const removed = currentState.filter(t => !nextState.some(nt => nt.id === t.id));
        const added = nextState.filter(nt => !currentState.some(t => t.id === nt.id));

        if (removed.length > 0) {
          await supabase.from('transactions').delete().in('id', removed.map(t => t.id));
        }
        if (added.length > 0) {
          await supabase.from('transactions').insert(added.map(t => ({
            id: t.id,
            user_id: user.id,
            date: t.date,
            description: t.desc,
            category: t.category,
            type: t.type,
            amount: t.value,
            profile_name: t.profile_name
          })));
        }
      }

      setTransactions(nextState);
      setHistoryPointer(historyPointer + 1);
      toast.info('Ação refeita');
    }
  };

  useEffect(() => {
    if (transactions.length > 0 && history.length === 0) {
      setHistory([transactions]);
      setHistoryPointer(0);
    }
  }, [transactions, history.length]);

  // Sync state to LocalStorage (Instant Persistence)
  useEffect(() => {
    localStorage.setItem('verdegrana_data', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('verdegrana_categories', JSON.stringify(categories));
  }, [categories]);

  // Sync state to IDB (Instant)
  useEffect(() => {
    if (activeTab === 'reports') {
      setIsChartReady(false);
      const t = setTimeout(() => setIsChartReady(true), 300);
      return () => clearTimeout(t);
    }
  }, [activeTab]);

  // --- Boot Logic ---

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootStage(prev => (prev === 'splash' ? 'presentation' : prev));
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

   const handlePresentationTouch = () => {
    if (user?.id) {
      setBootStage('welcome');
    } else {
      setBootStage('auth');
    }
  };

  const handleAuth = async (mode: 'login' | 'signup') => {
    if (!supabase) return;
    setIsAuthLoading(true);
    try {
      const { data, error } = mode === 'login' 
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
        : await supabase.auth.signUp({ email: authEmail, password: authPass });

      if (error) {
        if (mode === 'login') {
          alert("Erro ao entrar. Verifique seu email e senha. (" + error.message + ")");
        } else {
          alert("Erro ao criar conta: " + error.message);
        }
        throw error;
      }

      if (data.user) {
        setUser(data.user);
        setIsCloudMode(true);
        if (mode === 'signup') {
          alert("Conta criada com sucesso! Agora você já pode clicar em 'Entrar'. (Se o Supabase exigir, verifique a caixa de entrada do seu email).");
        } else {
          toast.success('BEM-VINDO DE VOLTA!');
          
          const cloud = await fetchCloudData(data.user.id);
          setIsTrial(false);
          
          const profiles = Array.from(new Set((cloud.transactions || []).map((t: any) => t.profile_name || 'Principal')));
          if (!profiles.includes('Principal')) profiles.push('Principal');

          if (profiles.length > 1) {
            setBootStage('profile_select');
          } else {
            setActiveProfile(profiles[0]);
            setBootStage('ready');
          }
        }
      }
    } catch (e: any) {
      console.error('Erro de autenticação:', e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('verdegrana_active_profile', activeProfile);
  }, [activeProfile]);

  const allProfiles = useMemo(() => {
    const fromTxs = Array.from(new Set(transactions.map(t => t.profile_name || 'Principal')));
    if (!fromTxs.includes('Principal')) fromTxs.push('Principal');
    if (!fromTxs.includes(activeProfile)) fromTxs.push(activeProfile);
    return fromTxs.filter(Boolean).sort();
  }, [transactions, activeProfile]);

  // --- Handlers ---
  const handleAddTransaction = async (data: Omit<Transaction, 'id'>) => {
    const newId = crypto.randomUUID();
    // Module 2: Force activeProfile on new transactions
    const newTx: Transaction = { ...data, id: newId, profile_name: activeProfile };
    
    setTransactions(prev => {
      const next = [...prev, newTx];
      pushToHistory(next);
      return next;
    });

    if (isCloudMode && user && supabase) {
      // Background Sync
      supabase.from('transactions').insert([{
        id: newId,
        user_id: user.id,
        date: data.date,
        description: data.desc,
        category: data.category,
        type: data.type,
        amount: data.value,
        profile_name: activeProfile
      }]).then(({ error }: { error: any }) => {
        if (error) console.error("Erro na sincronização em nuvem (insert):", error);
      });
    }
    toast.success('Lançamento adicionado!');
  };

  const handleUpdateTransaction = async (id: string, data: Partial<Transaction>) => {
    setTransactions(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...data } : t);
      pushToHistory(next);
      return next;
    });

    if (isCloudMode && user && supabase) {
      // Background Sync
      supabase.from('transactions').update({
        date: data.date,
        description: data.desc,
        category: data.category,
        type: data.type,
        amount: data.value,
        profile_name: data.profile_name
      }).eq('id', id).then(({ error }) => {
        if (error) console.error("Erro na sincronização em nuvem (update):", error);
      });
    }
  };

  const handleDeleteTransactions = async (ids: string[]) => {
    setTransactions(prev => {
      const next = prev.filter(t => !ids.includes(t.id));
      pushToHistory(next);
      return next;
    });

    if (isCloudMode && user && supabase) {
      // Background Sync
      supabase.from('transactions').delete().in('id', ids).then(({ error }) => {
        if (error) console.error("Erro na sincronização em nuvem (delete):", error);
      });
    }
  };

  const fetchCloudData = async (userId: string) => {
    if (!supabase) return { transactions: [] };
    try {
      setSyncStatus('saving');
      // Load Categories and Metadata from userdata
      const { data: userMeta } = await supabase
        .from('userdata')
        .select('data')
        .eq('user_id', userId)
        .single();
      
      if (userMeta?.data?.categories) {
        const cloudCats = userMeta.data.categories;
        setCategories(cloudCats);
        localStorage.setItem('verdegrana_categories', JSON.stringify(cloudCats));
      }

      // Load Transactions from transactions table
      const { data: cloudTxs, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);
      
      if (txError) throw txError;
      
      const mappedTxs: Transaction[] = cloudTxs ? cloudTxs.map((t: any) => ({
        id: t.id,
        date: t.date,
        desc: t.description,
        value: t.amount,
        category: t.category,
        type: t.type,
        profile_name: t.profile_name || 'Principal'
      })) : [];

      // Reconciliation: Overwrite localStorage with fresh cloud data
      localStorage.setItem('verdegrana_data', JSON.stringify(mappedTxs));
      setTransactions(mappedTxs);
      setSyncStatus('synced');
      return { transactions: mappedTxs };
    } catch (e: any) {
      console.error("Erro ao buscar dados na nuvem:", e);
      setSyncStatus('error');
      return { transactions: [] };
    }
  };

  const saveCloudMetadata = async (userId: string, cats: Category[]) => {
    if (!supabase || !isCloudMode) return;
    try {
      setSyncStatus('saving');
      const { error } = await supabase
        .from('userdata')
        .upsert({ 
          user_id: userId, 
          data: { categories: cats },
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      setSyncStatus('synced');
    } catch (e: any) {
      setSyncStatus('error');
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setIsCloudMode(false);
    setTransactions([]);
    setCategories(DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c })));
    localStorage.clear();
    setBootStage('auth');
    toast.info('Sessão encerrada.');
  };

  const handleLocalFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        let txs = [];
        if (data.transactions && Array.isArray(data.transactions)) {
          txs = data.transactions;
        } else if (Array.isArray(data)) {
          txs = data;
        }
        
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
        
        setTransactions(txs);
        setIsCloudMode(false);
        setIsTrial(false);
        setIsDemoMode(false);
        
        // Determine profile
        const profiles = Array.from(new Set(txs.map((t: any) => t.profile_name || 'Principal')));
        if (profiles.length > 1) {
          setBootStage('profile_select');
        } else {
          setActiveProfile(profiles[0] || 'Principal');
          setBootStage('ready');
        }
        
        toast.success('Arquivo local carregado!');
      } catch (err) {
        toast.error('Erro ao ler arquivo. Formato inválido.');
      }
    };
    reader.readAsText(file);
  };

  const handleLocalExport = () => {
    const data = JSON.stringify({ transactions, categories }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `verdegrana_backup.json`;
    link.click();
    toast.success('Backup local exportado!');
  };

  // --- Initial Boot & Persistence ---
  useEffect(() => {
    const boot = async () => {
      // Module 1: Silent Boot
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            setIsCloudMode(true);
            setSyncStatus('saving');
            const data = await fetchCloudData(session.user.id);
            setSyncStatus('synced');

            // Module 1: Profile Gateway
            const txs = data.transactions || [];
            const profiles = Array.from(new Set(txs.map((t: any) => t.profile_name || 'Principal')));
            if (!profiles.includes('Principal')) profiles.push('Principal');
            
            // Use localStorage if available to skip selection
            const savedProfile = localStorage.getItem('verdegrana_active_profile');
            
            if (profiles.length > 1 && (!savedProfile || !profiles.includes(savedProfile))) {
              setBootStage('profile_select');
            } else {
              setActiveProfile(savedProfile || profiles[0]);
              setBootStage('ready');
            }
          } else {
            setBootStage('splash');
          }
          
          supabase.auth.onAuthStateChange((_event: any, session: any) => {
            if (session?.user) {
              setUser(session.user);
              setIsCloudMode(true);
            } else {
              setUser(null);
              setIsCloudMode(false);
              setSyncStatus('idle');
            }
          });
        } catch (e) {
          console.error("Erro no boot de autenticação:", e);
          setBootStage('splash');
        }
      } else {
        setBootStage('splash');
      }
    };
    boot();
  }, []);

  // Module 3: Real-time Sync - Channels
  useEffect(() => {
    if (!supabase || !isCloudMode || !user) return;

    const channel = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload: any) => {
        console.log('Real-time change detected:', payload);
        toast.info('⚡ Alteração na nuvem detectada. Atualizando...', {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          duration: 3000
        });
        fetchCloudData(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isCloudMode, user]);

  // Debounced Cloud Sync for Metadata
  useEffect(() => {
    if (!user?.id || !isCloudMode || bootStage !== 'ready' || isDemoMode) return;

    const timeout = setTimeout(async () => {
      await saveCloudMetadata(user.id, categories);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [categories, user?.id, bootStage, isDemoMode]);

  // --- Handlers ---
  const processImport = useCallback((data: any[]) => {
    if (!Array.isArray(data)) {
      toast.error('Formato de dados inválido.');
      return;
    }

    const newCategories: Category[] = [...categories];

    data.forEach(item => {
      // Auto-Category Registration
      const catName = item.category || 'Outros';
      const catExists = newCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      
      if (!catExists) {
        const newCat = { 
          id: catName.toLowerCase(), 
          name: catName,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}` 
        };
        newCategories.push(newCat);
        toast.info(`Nova categoria criada: ${catName}`);
      }

      // Deduplication check
      const hash = `${item.date}-${item.desc}-${item.value}`;
      const isDuplicate = transactions.some(t => `${t.date}-${t.desc}-${t.value}` === hash);

      if (!isDuplicate) {
        handleAddTransaction({
          ...item,
          value: item.value,
          profile_name: activeProfile
        } as Omit<Transaction, 'id'>);
      }
    });

    setCategories(newCategories);
  }, [categories, transactions, activeProfile]);

  useEffect(() => {
    localStorage.setItem('verdegrana_active_profile', activeProfile);
  }, [activeProfile]);

  // Calculations & Filters
  const currentTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Profile filter
      if (t.profile_name !== activeProfile) return false;

      const date = new Date(t.date);
      // High-level filters
      if (viewMode === 'receitas' && t.type !== 'entrada') return false;
      if (viewMode === 'despesas' && t.type !== 'saída') return false;

      if (dateFilter.type === 'all') {
        return true;
      } else if (dateFilter.type === 'month') {
        return (date.getMonth() + 1) === dateFilter.month && date.getFullYear() === dateFilter.year;
      } else if (dateFilter.type === 'custom' && dateFilter.startDate && dateFilter.endDate) {
        const start = new Date(dateFilter.startDate);
        const end = new Date(dateFilter.endDate);
        return date >= start && date <= end;
      }
      return false;
    });
  }, [transactions, dateFilter, viewMode]);


  const filteredTransactions = useMemo(() => {
    return currentTransactions.filter(t => {
      const matchSearch = t.desc.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilters.length === 0 || categoryFilters.includes(t.category);
      return matchSearch && matchCat;
    }).sort((a, b) => {
      if (sortConfig === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortConfig === 'value-asc') return a.value - b.value;
      if (sortConfig === 'value-desc') return b.value - a.value;
      return 0;
    });
  }, [currentTransactions, searchTerm, categoryFilters, sortConfig]);

  const stats = useMemo(() => {
    const income = currentTransactions.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
    const expenses = currentTransactions.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
    const total = income - expenses;
    
    const balanceColor = total > 0 ? 'text-emerald-400' : total < 0 ? 'text-rose-500' : 'text-slate-400';

    return { total, income, expenses, balanceColor };
  }, [currentTransactions]);

  const fluxoData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    const dates = filteredTransactions.map(t => new Date(t.date).getTime());
    const minD = new Date(Math.min(...dates));
    const maxD = new Date(Math.max(...dates));

    const results = [];
    
    if (analyticsConfig.granularity === 'day') {
      const start = new Date(minD);
      start.setDate(start.getDate() - 2);
      const end = new Date(maxD);
      end.setDate(end.getDate() + 2);

      let curr = new Date(start);
      while (curr <= end) {
        const dStr = curr.toISOString().split('T')[0];
        const dayTxs = filteredTransactions.filter(t => t.date === dStr);
        const income = dayTxs.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
        const expense = dayTxs.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
        
        results.push({ 
            name: curr.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), 
            fullDate: curr.toISOString(),
            income, 
            expense 
        });
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      const start = analyticsConfig.granularity === 'month' ? new Date(minD.getFullYear(), minD.getMonth(), 1) : new Date(minD.getFullYear(), 0, 1);
      const end = analyticsConfig.granularity === 'month' ? new Date(maxD.getFullYear(), maxD.getMonth(), 1) : new Date(maxD.getFullYear(), 0, 1);

      let curr = new Date(start);
      while (curr <= end) {
        let income = 0;
        let expense = 0;
        let name = '';
        let fullDate = curr.toISOString();

        if (analyticsConfig.granularity === 'month') {
          const m = curr.getMonth();
          const y = curr.getFullYear();
          const pTxs = filteredTransactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === m && d.getFullYear() === y;
          });
          income = pTxs.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
          expense = pTxs.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
          name = curr.toLocaleString('pt-BR', { month: 'short' });
          curr.setMonth(curr.getMonth() + 1);
        } else {
          const y = curr.getFullYear();
          const pTxs = filteredTransactions.filter(t => new Date(t.date).getFullYear() === y);
          income = pTxs.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
          expense = pTxs.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
          name = y.toString();
          curr.setFullYear(curr.getFullYear() + 1);
        }
        results.push({ name, fullDate, income, expense });
      }
    }
    return results;
  }, [filteredTransactions, analyticsConfig.granularity]);

  const tendenciaData = useMemo(() => {
    return fluxoData; // Use same filtered data for both charts to ensure consistency
  }, [fluxoData]);

  const categoryData = useMemo(() => {
    const expByCat: Record<string, number> = {};
    const incByCat: Record<string, number> = {};
    
    currentTransactions.forEach(t => {
      if (t.type === 'saída') {
        expByCat[t.category] = (expByCat[t.category] || 0) + t.value;
      } else {
        incByCat[t.category] = (incByCat[t.category] || 0) + t.value;
      }
    });

    return Object.keys({ ...expByCat, ...incByCat })
      .filter(name => {
        if (donutViewMode === 'receitas') return (incByCat[name] || 0) > 0;
        if (donutViewMode === 'despesas') return (expByCat[name] || 0) > 0;
        return true;
      })
      .map(name => ({
        name,
        expense: expByCat[name] || 0,
        income: incByCat[name] || 0,
        value: donutViewMode === 'receitas' ? (incByCat[name] || 0) : (donutViewMode === 'despesas' ? (expByCat[name] || 0) : (incByCat[name] || 0) + (expByCat[name] || 0))
      }));
  }, [currentTransactions, donutViewMode]);

  const periodDetailsTransactions = useMemo(() => {
    if (!selectedPeriod) return [];
    const date = new Date(selectedPeriod).toISOString().split('T')[0];
    return currentTransactions.filter(t => t.date === date);
  }, [currentTransactions, selectedPeriod]);

  // --- UI Renders ---

  // Module 1: Silent Boot - Loading Overlay
  if (bootStage === 'syncing') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full shadow-2xl shadow-emerald-500/20"
        />
        <div className="space-y-2 text-center">
          <p className="text-white font-black text-sm uppercase tracking-[0.3em] animate-pulse">Sincronizando com a nuvem...</p>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-none">Aguarde um instante</p>
        </div>
      </div>
    );
  }

  // Splash Screen
  if (bootStage === 'splash') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden p-6">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center space-y-10 relative">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }} 
            className="w-32 h-32 bg-emerald-500/20 rounded-[3rem] mx-auto flex items-center justify-center blur-2xl absolute inset-0 -z-10" 
          />
          <div className="p-8 bg-emerald-500 rounded-[2.5rem] w-fit mx-auto shadow-2xl shadow-emerald-500/40 relative">
            <Leaf className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-4 text-center">
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">VerdeGrana</h1>
            <p className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.3em]">Finanças em sua privacidade</p>
          </div>
        </motion.div>
        
        <div className="w-full max-w-xs text-center pb-12">
           <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.25em] leading-relaxed opacity-50">
             Gerado por Luiz Gustavo Andrade Santos<br/>
             App feito 100% com IA<br/>
             Todos os direitos reservados ao Google Ai Studio
           </p>
        </div>
      </div>
    );
  }

  // Presentation Screen
  if (bootStage === 'presentation') {
    return (
      <div 
        onClick={handlePresentationTouch}
        className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-12 text-center select-none cursor-pointer"
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12 max-w-sm flex flex-col items-center">
          <div className="space-y-4">
             <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Simples e Seguro</h2>
             <p className="text-slate-400 text-lg leading-relaxed">Gerencie seus gastos sem que seus dados saiam do seu aparelho.</p>
          </div>
          
          <div className="flex flex-col gap-8 w-full items-center">
            <button 
              onClick={handlePresentationTouch}
              className="group flex flex-col items-center gap-4 transition-all active:scale-95"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center animate-bounce group-hover:bg-emerald-500/20">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-emerald-500 font-black text-xs uppercase tracking-[0.2em] animate-pulse">Entrar com Cloud Sync</p>
            </button>

            <div className="h-px w-32 bg-white/5" />

            <button 
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById('fileInput')?.click();
              }}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 font-black text-[10px] uppercase tracking-[0.3em] transition-colors"
            >
              <Folder className="w-3 h-3" /> Prosseguir com ficheiros locais
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Source Selector
  if (bootStage === 'auth') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-8">
        {!supabase ? (
          <div className="max-w-md w-full bg-rose-500/10 border border-rose-500/20 p-10 rounded-[3rem] text-center space-y-4">
             <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
             <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Configuração Pendente</h2>
             <p className="text-slate-400 text-sm">Insira as chaves do Supabase no código ou Variáveis de Ambiente para habilitar o Cloud Sync.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full space-y-10">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-[2rem] mx-auto flex items-center justify-center">
                <Cloud className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{isLoginMode ? 'Acessar Conta' : 'Criar Novo Perfil'}</h2>
              <p className="text-slate-400 text-sm">{isLoginMode ? 'Sincronize seus dados financeiros na nuvem' : 'Comece sua jornada com segurança absoluta'}</p>
            </div>

            <div className="space-y-4">
               <div className="space-y-2">
                 <label className="text-[10px] uppercase font-black text-slate-600 ml-4 tracking-widest">E-mail</label>
                 <div className="relative">
                   <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                   <input 
                    type="email" 
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    placeholder="seu@email.com" 
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 text-white outline-none focus:border-emerald-500 transition-all" 
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] uppercase font-black text-slate-600 ml-4 tracking-widest">Senha</label>
                 <div className="relative">
                   <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                   <input 
                    type="password" 
                    value={authPass}
                    onChange={e => setAuthPass(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 text-white outline-none focus:border-emerald-500 transition-all" 
                   />
                 </div>
               </div>

               <button 
                onClick={() => handleAuth(isLoginMode ? 'login' : 'signup')}
                disabled={isAuthLoading}
                className="w-full py-6 bg-emerald-500 rounded-2xl font-black text-white text-sm uppercase shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
               >
                 {isAuthLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (isLoginMode ? 'Entrar' : 'Criar Conta')}
               </button>

               <div className="flex flex-col gap-4 text-center pt-4">
                  <button 
                    onClick={() => setIsLoginMode(!isLoginMode)}
                    className="text-xs text-slate-500 font-bold uppercase tracking-widest hover:text-emerald-400 transition-colors"
                  >
                    {isLoginMode ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre agora'}
                  </button>
                  <div className="h-px bg-white/5 w-full my-2" />
                  <button 
                    onClick={() => { setIsTrial(true); setIsDemoMode(true); setTransactions([]); setBootStage('welcome'); }}
                    className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] hover:text-slate-400"
                  >
                    Continuar como Visitante (Modo Trial)
                  </button>
                  <div className="h-px bg-white/5 w-full my-2" />
                  <button 
                    onClick={() => {
                       const el = document.getElementById('fileInput');
                       if (el) el.click();
                    }}
                    className="flex items-center justify-center gap-2 text-[10px] text-emerald-500 font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
                  >
                    <Folder className="w-3 h-3" /> Carregar Ficheiro Local (.json)
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  if (bootStage === 'profile_select') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full glass p-10 rounded-[4rem] border border-white/10 shadow-2xl text-center space-y-10">
          <div className="space-y-4">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20">
               <UserCheck className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Qual Perfil?</h1>
            <p className="text-slate-400 text-sm">Escolha o ambiente que deseja acessar hoje.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {allProfiles.map(p => (
              <button
                key={p}
                onClick={async () => {
                  setActiveProfile(p);
                  setBootStage('ready');
                  toast.success(`Acessando perfil: ${p}`);
                }}
                className="w-full py-5 bg-white/5 border border-white/10 rounded-3xl font-black text-white text-sm uppercase flex items-center justify-between px-8 hover:bg-emerald-500 hover:border-emerald-500 transition-all active:scale-95 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20">
                    <User className="w-4 h-4" />
                  </div>
                  {p}
                </div>
                <ChevronRight className="w-5 h-5 opacity-50" />
              </button>
            ))}
          </div>

          <button 
            onClick={async () => {
              const name = prompt('Nome do novo perfil:');
              if (name && !allProfiles.includes(name)) {
                setActiveProfile(name);
                setBootStage('ready');
                toast.success(`Novo perfil criado: ${name}`);
              }
            }}
            className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
          >
            + Criar novo ambiente
          </button>
        </motion.div>
      </div>
    );
  }

  if (bootStage === 'welcome') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 sm:p-0 overflow-y-auto">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full glass p-10 rounded-[4rem] border border-white/10 shadow-2xl text-center space-y-8">
          <div className="space-y-4">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20">
               {isTrial ? <Play className="w-12 h-12" /> : (isCloudMode ? <UserCheck className="w-12 h-12" /> : <Folder className="w-12 h-12" />)}
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
              {isTrial ? 'Seja Bem-vindo!' : 'TUDO PRONTO!'}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed px-4">
              {isTrial 
                ? 'Você está em modo de teste. Seus dados não serão salvos permanentemente.' 
                : (isCloudMode ? `Conectado como ${user?.email}. Seus dados estão sendo guardados na nuvem.` : 'Modo Local Ativo. Seus dados estão salvos apenas neste navegador.')}
            </p>
          </div>

          {!isTrial && (
            <div className="bg-emerald-500/5 p-5 rounded-3xl border border-emerald-500/10 text-left flex items-center gap-4">
               <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-500">{isCloudMode ? <Cloud className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}</div>
               <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{isCloudMode ? 'Sincronização em Nuvem' : 'Privacidade Local'}</p>
                  <p className="text-xs text-slate-400 truncate font-mono">Status: {isCloudMode ? 'Ativo & Seguro' : '100% Offline'}</p>
               </div>
            </div>
          )}

          <div className="space-y-4">
             <button 
              onClick={() => setBootStage('ready')}
              className="w-full py-6 bg-emerald-600 rounded-3xl font-black text-white hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
             >
               {isTrial ? 'Começar Agora' : 'ACESSAR MEU PAINEL'} <ArrowRight className="w-5 h-5" />
             </button>
             {!isTrial && (
                <button 
                  onClick={handleLogout}
                  className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-slate-500 text-xs uppercase hover:bg-white/10 transition-all active:scale-95"
                >
                  CONECTAR COM OUTRA CONTA
                </button>
             )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Main App
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 flex flex-col select-none touch-none">
      <Toaster position="top-right" theme="dark" richColors />
      <input 
        type="file" 
        id="fileInput"
        ref={localFileRef} 
        onChange={handleLocalFileLoad} 
        accept=".json" 
        style={{ display: 'none' }}
      />

      {/* CONTENT AREA */}
      <main 
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-56 px-4 touch-pan-y box-border max-w-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <header className="p-6 md:p-10 flex flex-col justify-between items-start gap-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-white tracking-tighter">VerdeGrana <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-mono uppercase">Beta</span></h1>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Intervalo dos registros</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10">
                  <button 
                    onClick={() => setDateFilter(prev => ({ ...prev, type: 'all' }))}
                    className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", dateFilter.type === 'all' ? "bg-emerald-500 text-white" : "text-slate-500")}
                  >
                    VISÃO GERAL
                  </button>
                  <button 
                    onClick={() => setDateFilter(prev => ({ ...prev, type: 'month' }))}
                    className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", dateFilter.type === 'month' ? "bg-emerald-500 text-white" : "text-slate-500")}
                  >
                    MENSAL
                  </button>
                  <button 
                    onClick={() => setDateFilter(prev => ({ ...prev, type: 'custom' }))}
                    className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", dateFilter.type === 'custom' ? "bg-emerald-500 text-white" : "text-slate-500")}
                  >
                    PERSONALIZADO
                  </button>
                </div>

                {dateFilter.type === 'month' ? (
                  <div className="flex items-center gap-1">
                    <select 
                      value={dateFilter.month} 
                      onChange={e => setDateFilter(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                      className="bg-emerald-500/10 text-emerald-400 font-bold text-xs px-3 py-1 rounded-full border border-emerald-500/20 outline-none"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i + 1} className="bg-slate-900">{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>
                      ))}
                    </select>
                    <select 
                      value={dateFilter.year} 
                      onChange={e => setDateFilter(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      className="bg-emerald-500/10 text-emerald-400 font-bold text-xs px-3 py-1 rounded-full border border-emerald-500/20 outline-none"
                    >
                      {[2023, 2024, 2025, 2026].map(y => (
                        <option key={y} value={y} className="bg-slate-900">{y}</option>
                      ))}
                    </select>
                  </div>
                ) : dateFilter.type === 'custom' ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="date" 
                      value={dateFilter.startDate || ''} 
                      onChange={e => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                      className="bg-white/5 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 outline-none"
                    />
                    <span className="text-slate-600 text-xs">até</span>
                    <input 
                      type="date" 
                      value={dateFilter.endDate || ''} 
                      onChange={e => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                      className="bg-white/5 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 outline-none"
                    />
                  </div>
                ) : null}
                
                {/* Status Indicator */}
                <div className="flex items-center gap-1 text-[10px] font-bold ml-2 transition-all">
                  {isCloudMode && user ? (
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                      syncStatus === 'saving' ? "text-amber-500 bg-amber-500/5 animate-pulse" : 
                      syncStatus === 'synced' ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" : "text-slate-500 bg-white/5"
                    )}>
                      {syncStatus === 'saving' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
                      <span>
                        {syncStatus === 'saving' ? 'SINCRONIZANDO...' : syncStatus === 'synced' ? 'NUVEM ATIVA' : 'SINC. DESATIVADA'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-slate-400 border border-white/5">
                      <FolderSync className="w-3 h-3" />
                      <span>MODO LOCAL</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
            <StatSmall label="Saldo Global" value={stats.total} color={stats.balanceColor} />
            <StatSmall label="Receitas" value={stats.income} color="text-emerald-500" prefix="+" />
            <StatSmall label="Despesas" value={stats.expenses} color="text-rose-500" prefix="-" />
          </div>
        </header>

        <section className="px-6 md:px-10 pb-10">
          <AnimatePresence mode="wait">
            {activeTab === 'reports' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="grid grid-cols-12 gap-6">
                <div className="col-span-12 flex flex-col gap-6 glass p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-2 w-full">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Modo de Filtro:</span>
                       <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 w-full box-border">
                         {(['tudo', 'receitas', 'despesas', 'personalizado'] as const).map(m => (
                           <button 
                             key={m} 
                             onClick={() => {
                               setViewMode(m);
                               if (m !== 'personalizado') setCategoryFilters([]);
                             }}
                             className={cn(
                               "px-2 py-3 rounded-xl text-[10px] font-black transition-all uppercase text-center", 
                               viewMode === m ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                             )}
                           >
                             {m === 'tudo' ? 'Tudo' : m === 'receitas' ? 'Só Receitas' : m === 'despesas' ? 'Só Despesas' : 'Personalizado'}
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agrupar por:</span>
                      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
                        {(['day', 'month', 'year'] as const).map(g => (
                          <button 
                            key={g} 
                            onClick={() => { setAnalyticsConfig(p => ({ ...p, granularity: g })); setIsDashboardRevealed(true); }}
                            className={cn("px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase", analyticsConfig.granularity === g ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300")}
                          >
                            {g === 'day' ? 'Dia' : g === 'month' ? 'Mês' : 'Ano'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categorias Selecionadas:</span>
                      <button 
                        onClick={() => setIsComparisonModalOpen(true)}
                        disabled={viewMode !== 'personalizado'}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black transition-all border",
                          viewMode === 'personalizado' ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-slate-700 border-white/5 opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Plus className="w-3 h-3" /> SELECIONAR CATEGORIAS
                      </button>
                      {analyticsConfig.compareCategories.length > 0 && viewMode === 'personalizado' && (
                        <button 
                          onClick={() => setAnalyticsConfig(p => ({ ...p, compareCategories: [] }))}
                          className="text-[9px] font-bold text-rose-500 hover:scale-105 transition-transform"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {transactions.length === 0 ? (
                  <div className="col-span-12 flex flex-col items-center justify-center p-12 text-center w-full min-h-[400px]">
                    <div className="w-32 h-32 bg-slate-900 rounded-[3rem] flex items-center justify-center mb-8 border border-white/5 mx-auto">
                      <Leaf className="w-12 h-12 text-slate-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter w-full">Sua jornada começa agora</h2>
                    <p className="text-slate-400 mb-10 max-w-sm mx-auto">Adicione seu primeiro lançamento para ver a mágica do VerdeGrana acontecer.</p>
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-10 py-5 bg-emerald-500 rounded-[2rem] font-bold text-white uppercase tracking-widest shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-3 mx-auto"
                    >
                      <Plus className="w-5 h-5" /> Começar Agora
                    </button>
                  </div>
                ) : !isDashboardRevealed ? (
                  <div className="col-span-12 flex flex-col items-center justify-center p-8 space-y-12 text-center w-full min-h-[400px]">
                    <div className="text-center space-y-4 w-full">
                       <h2 className="text-3xl font-black text-white tracking-tighter uppercase px-4">Seu Panorama</h2>
                       <p className="text-slate-400 max-w-xs mx-auto">Escolha como deseja agrupar seus dados para começar.</p>
                    </div>
                    <div className="w-full max-w-sm flex bg-slate-900/50 p-1 rounded-2xl border border-white/10 mx-auto">
                       {(['day', 'month', 'year'] as const).map(r => (
                         <button 
                          key={r}
                          onClick={() => { setAnalyticsConfig(p => ({ ...p, granularity: r })); setIsDashboardRevealed(true); }}
                          className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                         >
                           {r === 'day' ? 'Dia' : r === 'month' ? 'Mês' : 'Ano'}
                         </button>
                       ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {analyticsConfig.compareCategories.length > 0 && (
                      <Card className="col-span-12 lg:col-span-4 h-[550px] p-8 relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2" />
                        <ComparisonChart 
                          title="Comparação de Categorias"
                          data={categoryData.filter(c => analyticsConfig.compareCategories.includes(c.name))}
                          colorMode={donutColorMode}
                          setColorMode={setDonutColorMode}
                          viewMode={donutViewMode}
                          setViewMode={setDonutViewMode}
                        />
                      </Card>
                    )}

                    {/* ROW 1: LANÇAMENTOS */}
                    <Card className="col-span-12 h-[500px] p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg uppercase tracking-tighter">Lançamentos</h3>
                      </div>
                     {isChartReady ? (
                        <div className="w-full h-full relative">
                           <TimelineChart 
                              data={fluxoData} 
                              onPointClick={handlePointClick}
                              viewMode={viewMode}
                           />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-emerald-500/20 animate-spin" />
                        </div>
                      )}
                    </Card>

          {/* ROW 2: DETALHES (DYNAMIC) */}
          <AnimatePresence>
            {selectedPeriod && (
              <Card id="detalhes-periodo-container" className="col-span-12 p-8 border-emerald-500/20 bg-emerald-500/5 box-border overflow-hidden max-w-full">
                <div className="flex justify-between items-center mb-6 gap-4">
                  <div className="min-w-0">
                     <h3 className="font-black text-xl text-white uppercase tracking-tighter truncate">Detalhes do Dia</h3>
                     <p className="text-emerald-500 text-xs font-bold font-mono break-words whitespace-normal leading-tight">{new Date(selectedPeriod).toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedPeriod(null)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {periodDetailsTransactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all gap-2 min-w-0">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn("p-3 rounded-xl flex-shrink-0", t.type === 'entrada' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                          {t.type === 'entrada' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate text-sm">{t.desc}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest truncate">{t.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className={cn("font-black text-sm", t.type === 'entrada' ? "text-emerald-400" : "text-rose-400")}>
                            {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.value)}
                          </p>
                        </div>
                        <button 
                          onClick={() => { setEditingTransaction(t); setIsAddModalOpen(true); }}
                          className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                            {periodDetailsTransactions.length === 0 && (
                              <p className="text-center py-6 text-slate-500 font-medium">Nenhum lançamento encontrado para esta data.</p>
                            )}

                            <div className="mt-8 pt-8 border-t border-white/10 flex flex-col items-center gap-4">
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Esqueceu algo neste dia?</p>
                              <button 
                                onClick={() => {
                                  setQuickAddDate(new Date(selectedPeriod!).toISOString().split('T')[0]);
                                  setIsAddModalOpen(true);
                                }}
                                className="px-8 py-4 bg-emerald-500 rounded-2xl font-black text-white hover:bg-emerald-400 transition-all active:scale-95 flex items-center gap-2 shadow-xl shadow-emerald-500/20"
                              >
                                <Plus className="w-5 h-5" /> Adicionar Registro Rápido
                              </button>
                            </div>
                          </div>
                      </Card>
                      )}
                    </AnimatePresence>

                    {/* ROW 3: FLUXO DE CAIXA */}
                    <Card className="col-span-12 p-10 h-[450px] relative overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="font-black text-lg uppercase tracking-tighter">Fluxo de Caixa</h3>
                      </div>
                     {isChartReady ? (
                        <div className="w-full h-full relative">
                          <TimelineChart 
                             data={tendenciaData} 
                             isPerformance={true} 
                             viewMode={viewMode}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-emerald-500/20 animate-spin" />
                        </div>
                      )}
                    </Card>

                    {/* ROW 4: DISTRIBUIÇÃO GERAL */}
                    <Card className="col-span-12 p-10 relative overflow-hidden flex flex-col min-h-[500px]">
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full translate-y-1/2 -translate-x-1/2" />
                      {isChartReady ? (
                        <CategoryDonutSection 
                          title="Distribuição Geral"
                          data={categoryData}
                          colorMode={donutColorMode}
                          setColorMode={setDonutColorMode}
                          viewMode={donutViewMode}
                          setViewMode={setDonutViewMode}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-emerald-500/20 animate-spin" />
                        </div>
                      )}
                    </Card>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'transactions' && (
              <motion.div key="tx" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                <div className="flex flex-col gap-6 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                  <div className="flex flex-col gap-3 w-full">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Modo de Filtro:</span>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 w-full box-border">
                       {(['tudo', 'receitas', 'despesas', 'personalizado'] as const).map(m => (
                         <button 
                           key={m} 
                           onClick={() => {
                             setViewMode(m);
                             if (m !== 'personalizado') setCategoryFilters([]);
                           }}
                           className={cn(
                             "px-2 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest text-center", 
                             viewMode === m ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                           )}
                         >
                           {m === 'tudo' ? 'Tudo' : m === 'receitas' ? 'Só Receitas' : m === 'despesas' ? 'Só Despesas' : 'Personalizado'}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="w-full flex flex-wrap items-center justify-between gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 box-border">
                    <div className="flex flex-wrap gap-2 bg-slate-900 rounded-xl p-1">
                      {(['date', 'value-desc', 'value-asc'] as const).map((mode) => (
                         <button 
                          key={mode}
                          onClick={() => setSortConfig(mode)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            sortConfig === mode ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-white"
                          )}
                         >
                           {mode === 'date' ? 'Recente' : mode === 'value-desc' ? 'Maior' : 'Menor'}
                         </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                       <button onClick={undo} disabled={historyPointer <= 0} className="p-3 bg-white/5 rounded-xl text-slate-400 disabled:opacity-20 transition-all active:scale-95"><Undo2 className="w-5 h-5" /></button>
                       <button onClick={redo} disabled={historyPointer >= history.length - 1} className="p-3 bg-white/5 rounded-xl text-slate-400 disabled:opacity-20 transition-all active:scale-95"><Redo2 className="w-5 h-5" /></button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      type="text" placeholder="Filtrar por descrição..." 
                      className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-emerald-500/50 transition-all outline-none"
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {viewMode === 'personalizado' && (
                    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
                      {categories.slice(0, 12).map(cat => (
                        <button 
                          key={cat.id}
                          onClick={() => {
                            setCategoryFilters(p => p.includes(cat.name) ? p.filter(c => c !== cat.name) : [...p, cat.name]);
                          }}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black border transition-all uppercase tracking-widest",
                            categoryFilters.includes(cat.name) ? "bg-emerald-500 text-white border-emerald-500" : "bg-white/5 border-white/10 text-slate-500"
                          )}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 px-2">
                  {filteredTransactions.map(t => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                        selectedTxIds.includes(t.id) 
                          ? "bg-emerald-500/10 border-emerald-500/50" 
                          : "bg-white/5 border-white/5 hover:border-white/10"
                      )}
                      onClick={() => setSelectedTxIds(p => p.includes(t.id) ? p.filter(id => id !== t.id) : [...p, t.id])}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", t.type === 'entrada' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                          {t.type === 'entrada' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div className="max-w-[150px]">
                          <p className="font-bold text-white text-sm truncate">{t.desc}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest leading-none">{t.category}</p>
                            <span className="w-0.5 h-0.5 bg-white/10 rounded-full" />
                            <p className="text-[9px] text-slate-500 font-mono leading-none">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-black text-sm", t.type === 'entrada' ? "text-emerald-400" : "text-rose-400")}>
                          {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.value)}
                        </p>
                      </div>

                      {/* ACTIONS TOOLBAR */}
                      <AnimatePresence>
                        {selectedTxIds.includes(t.id) && (
                           <motion.div 
                            initial={{ x: 150 }} animate={{ x: 0 }} exit={{ x: 150 }}
                            className="absolute right-0 top-0 bottom-0 bg-slate-900 border-l border-white/10 flex items-center px-4 gap-2 z-10"
                            onClick={e => e.stopPropagation()}
                           >
                              <button onClick={() => { setEditingTransaction(t); setIsAddModalOpen(true); }} className="p-3 bg-white/5 rounded-xl text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95"><Edit3 className="w-5 h-5" /></button>
                              <button onClick={() => {
                                handleDeleteTransactions([t.id]);
                                setSelectedTxIds([]);
                                toast.error('Lançamento removido');
                              }} className="p-3 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500/20 transition-all active:scale-95"><Trash2 className="w-5 h-5" /></button>
                           </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <div className="py-20 text-center text-slate-600 font-bold uppercase tracking-widest text-[10px]">Silêncio por aqui...</div>
                  )}
                </div>

                {selectedTxIds.length > 1 && (
                      <motion.div 
                        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-24 left-6 right-6 p-4 glass rounded-[2rem] border border-red-500/30 flex items-center justify-between z-40 bg-slate-900/90 shadow-2xl shadow-black/50"
                      >
                        <p className="text-xs font-black uppercase text-slate-400 ml-2">{selectedTxIds.length} Selecionados</p>
                        <button
                          onClick={() => {
                            handleDeleteTransactions(selectedTxIds);
                            setSelectedTxIds([]);
                            toast.error(`${selectedTxIds.length} registros excluídos`);
                          }}
                          className="px-6 py-3 bg-red-500 rounded-xl text-white font-bold text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-red-500/20"
                        >
                          Excluir Tudo
                        </button>
                      </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div key="ai" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-10 flex flex-col items-center text-center gap-8 border-emerald-500/20 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-[2.5rem] flex items-center justify-center animate-pulse">
                    <Bot className="w-12 h-12 text-emerald-400" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white">Assistente Mestre</h2>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                      Transforme áudios ou textos em finanças organizadas! 1️⃣ Copie o Prompt Mestre. 2️⃣ Cole no seu ChatGPT, Gemini ou Claude. 3️⃣ Dite seus gastos. 4️⃣ Copie a resposta gerada e cole no nosso Importador Inteligente logo abaixo. (Dica: Se a lista for muito gigante, peça para a IA gerar um arquivo .txt ou .json e use o botão de importar arquivo).
                    </p>
                  </div>
                  <div className="w-full space-y-3">
                    <button 
                      onClick={() => {
                        const prompt = `You are a professional financial data parser. 
First, acknowledge this role by exactly saying: "Ok, o que quer que eu contabilize?". 
Then, wait for me to provide transaction details (text, images or audio transcripts). 
Your ONLY goal is to return a raw JSON array.

Strict Rules:
- Identify if the item is an 'entrada' (income) or 'saída' (expense).
- Map to these categories: [${categories.map(c => c.name).join(', ')}]. Use 'Outros' if unsure.
- Date format: YYYY-MM-DD. Use ${new Date().getFullYear()} if none mentioned.
- Input values are always POSITIVE numbers.
- Return ONLY the JSON code block.

Schema: [{"date": "YYYY-MM-DD", "desc": "string", "value": number, "category": "string", "type": "entrada|saída"}]`;
                        navigator.clipboard.writeText(prompt);
                        toast.success('Prompt mestre copiado!');
                      }}
                      className="w-full py-5 bg-emerald-600 rounded-3xl font-bold hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3"
                    >
                      <Copy className="w-5 h-5" /> Copiar Master Prompt
                    </button>
                  </div>
                </Card>

                <Card className="p-10 flex flex-col gap-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400"><RefreshCw className={isAiProcessing ? "animate-spin" : ""} /></div>
                    <h3 className="text-xl font-bold text-white">Importador Inteligente</h3>
                  </div>
                  <textarea 
                    id="ai-json" placeholder="Cole o JSON da IA aqui..." 
                    className="flex-1 min-h-[300px] bg-black/40 border border-white/5 rounded-[2rem] p-8 text-xs font-mono text-emerald-500 focus:border-emerald-500/50 outline-none resize-none"
                  />
                  <button 
                    onClick={() => {
                      setIsAiProcessing(true);
                      const area = document.getElementById('ai-json') as HTMLTextAreaElement;
                      setTimeout(() => {
                        try {
                          const data = JSON.parse(area.value);
                          processImport(data);
                          setActiveTab('reports');
                          area.value = '';
                        } catch (e) { toast.error('Falha no formato JSON.'); }
                        setIsAiProcessing(false);
                      }, 1000);
                    }}
                    disabled={isAiProcessing}
                    className="w-full py-5 bg-blue-600 rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50"
                  >
                    {isAiProcessing ? 'Processando...' : 'Processar Agora'}
                  </button>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const text = event.target?.result as string;
                          const data = JSON.parse(text);
                          processImport(Array.isArray(data) ? data : data.transactions || []);
                          setActiveTab('reports');
                          toast.success('Dados importados com sucesso!');
                        } catch (err) {
                          toast.error('Erro ao processar arquivo.');
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                    accept=".json,.txt"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 bg-white/5 border border-white/10 rounded-3xl text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                  >
                    <FileJson className="w-5 h-5 text-blue-400" /> Importar via Arquivo
                  </button>
                </Card>

                <Card className="col-span-1 lg:col-span-2 p-10 flex flex-col gap-6 border-blue-500/10">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-bold text-white">Análise Avançada com IA</h3>
                    <p className="text-slate-500 text-sm">Seus dados não têm limites. Exporte seu histórico e peça para a sua IA favorita gerar planilhas do Excel, gráficos personalizados ou análises profundas sobre sua saúde financeira.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <button 
                      onClick={() => {
                        const topCats = categoryData.slice(0, 5).map(c => `${c.name}: ${formatCurrency(c.value)}`).join(', ');
                        const reportPrompt = `Relatório Financeiro VerdeGrana - Saúde Financeira Master
                        
Idealizador: Luiz Gustavo Andrade Santos
Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}

RESUMO DO PERÍODO:
- Saldo Atual: ${formatCurrency(stats.total)}
- Total Receitas: ${formatCurrency(stats.income)}
- Total Despesas: ${formatCurrency(stats.expenses)}
- Fluxo Líquido: ${formatCurrency(stats.total)}

TOP CATEGORIAS DE GASTO:
${topCats || 'Sem dados suficientes'}

MÉTRICAS:
- Total Transactions: ${transactions.length}
- Média por Transação: ${formatCurrency(stats.expenses / (transactions.filter(t => t.type === 'saída').length || 1))}

SOLICITAÇÃO: Forneça uma análise crítica, insights de economia e recomendações de investimentos baseados nestes dados.`;
                        navigator.clipboard.writeText(reportPrompt);
                        toast.success('Relatório para IA copiado!');
                      }}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" /> Área de Transferência
                    </button>
                    
                    <button 
                      onClick={() => {
                        const data = JSON.stringify({ transactions, categories }, null, 2);
                        const blob = new Blob([data], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `verdegrana_export.txt`;
                        link.click();
                        toast.success('Arquivo .TXT baixado!');
                      }}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <Download className="w-4 h-4 text-blue-400" /> Baixar arquivo .TXT
                    </button>

                    <button 
                      onClick={() => {
                        const data = JSON.stringify({ transactions, categories }, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `verdegrana_export.json`;
                        link.click();
                        toast.success('Arquivo .JSON baixado!');
                      }}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <FileJson className="w-4 h-4 text-emerald-400" /> Baixar arquivo .JSON
                    </button>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'categories' && (
              <motion.div key="cat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
                <Card className="p-10 space-y-10">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-emerald-500/10 rounded-3xl text-emerald-400"><Tag className="w-8 h-8" /></div>
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black text-white">Categorias Dinâmicas</h2>
                      <p className="text-slate-500 text-sm">Gerencie seu ecossistema financeiro</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <input 
                      id="new-cat" type="text" placeholder="Nome da categoria..." 
                      className="flex-1 bg-white/5 border border-white/10 rounded-[1.5rem] px-8 py-5 focus:border-emerald-500/50 outline-none text-white" 
                    />
                    <button 
                      onClick={() => {
                        const inp = document.getElementById('new-cat') as HTMLInputElement;
                        if (inp.value) { 
                          setCategories(p => [...p, { id: inp.value.toLowerCase(), name: inp.value }]); 
                          inp.value = '';
                          toast.success('Categoria adicionada!');
                        }
                      }}
                      className="px-8 bg-emerald-600 rounded-[1.5rem] hover:bg-emerald-500 transition-colors active:scale-95"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.map(cat => (
                      <div key={cat.id} className="group p-6 glass rounded-[2rem] border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between">
                        <span className="font-bold text-slate-300">{cat.name}</span>
                        <button 
                          onClick={() => setCategoryToDelete(cat)} 
                          className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                   <div className="pt-10 border-t border-white/5 h-[650px]">
                    <CategoryDonutSection 
                      title="Análise por Distribuição"
                      data={categoryData}
                      colorMode={donutColorMode}
                      setColorMode={setDonutColorMode}
                      viewMode={donutViewMode}
                      setViewMode={setDonutViewMode}
                    />
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="set" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">{isCloudMode ? <Cloud /> : <Folder />}</div>
                    <h3 className="text-xl font-bold text-white tracking-tighter">Gerenciador de Progressos (Perfis)</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">Organize múltiplas frentes financeiras (Ex: Pessoal, Negócios). Selecione o perfil ativo para filtrar todo o painel.</p>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                       <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Perfil Ativo Atualmente</p>
                       <div className="flex items-center justify-between">
                          <p className="text-lg font-black text-white truncate">{activeProfile}</p>
                          <div className="px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/30 text-[8px] font-black text-emerald-500 uppercase">Selecionado</div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                       {allProfiles.map(p => (
                         <button 
                          key={p}
                          onClick={() => {
                            setActiveProfile(p);
                            toast.success(`Perfil alternado para: ${p}`);
                          }}
                          className={cn(
                            "w-full p-4 rounded-xl text-left transition-all border flex items-center justify-between group",
                            activeProfile === p ? "bg-emerald-500 text-white border-emerald-400" : "bg-white/5 border-white/5 hover:border-white/20 text-slate-400"
                          )}
                         >
                            <span className="font-bold text-xs uppercase tracking-widest">{p}</span>
                            {activeProfile === p ? <UserCheck className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                         </button>
                       ))}
                    </div>

                    <button 
                      onClick={() => {
                        const name = prompt('Nome do novo progresso/perfil:');
                        if (name && name.trim()) {
                          setActiveProfile(name.trim());
                          toast.success(`Progresso "${name}" criado e ativado!`);
                        }
                      }}
                      className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-black uppercase text-xs tracking-widest hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Criar Novo Progresso
                    </button>
                  </div>
                </Card>

                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">{isCloudMode ? <Cloud /> : <Folder />}</div>
                    <h3 className="text-xl font-bold text-white">{isCloudMode ? 'Sincronização na Nuvem' : 'Modo Ficheiro Local'}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {isCloudMode 
                      ? 'Seus dados estão protegidos e sincronizados em tempo real com sua conta no Supabase. Isso garante acesso multiplataforma.' 
                      : 'Seus dados estão sendo gerenciados localmente. Lembre-se de baixar backups regulares (.json) para evitar perdas se limpar o navegador.'}
                  </p>
                  <div className="mt-auto bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                     <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Status do Armazenamento</p>
                     <p className={cn(
                       "text-sm font-bold truncate transition-all",
                       isCloudMode ? "text-emerald-500" : "text-slate-300"
                     )}>
                       {isCloudMode ? `Nuvem: ${user?.email}` : 'Ficheiro Local (Offline)'}
                     </p>
                  </div>
                  <button 
                    onClick={() => {
                      setConfirmModal({
                        open: true,
                        title: 'Exportar Backup Local?',
                        description: 'Um arquivo .json será baixado com todos os seus registros atuais.',
                        action: handleLocalExport
                      });
                    }}
                    className="flex items-center justify-center gap-3 py-4 bg-emerald-600/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold hover:bg-emerald-600 hover:text-white transition-all text-sm"
                  >
                    <Download className="w-4 h-4" /> Exportar Backup (.json)
                  </button>
                </Card>

                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl"><Monitor /></div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Aparência</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">Ajuste o tamanho da interface para caber mais informações na tela.</p>
                  <div className="flex flex-row gap-2 mt-2">
                    {[
                      { label: 'Compacto', value: 85 },
                      { label: 'Menor', value: 90 },
                      { label: 'Padrão', value: 100 }
                    ].map((scale) => (
                      <button
                        key={scale.value}
                        onClick={() => setUiScale(scale.value)}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          uiScale === scale.value 
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                            : "bg-white/5 text-slate-500 border-white/10 hover:bg-white/10"
                        )}
                      >
                        {scale.label} ({scale.value}%)
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl"><Trash2 /></div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Gerenciamento de Dados</h3>
                  </div>
                  <div className="space-y-4">
                    <button 
                      onClick={() => {
                        if (isTrial) {
                          toast.error('Função indisponível no modo Trial. Sincronize seus dados para liberar.');
                          return;
                        }
                        setConfirmModal({
                          open: true,
                          title: 'LIMPAR TODOS OS DADOS?',
                          description: 'ATENÇÃO: Isso apagará TODOS os dados localmente e no arquivo sincronizado permanentemente. Esta ação não pode ser desfeita.',
                          action: async () => {
                            const emptySchema = {
                              transactions: [],
                              categories: DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c }))
                            };
                            
                            if (user && supabase && isCloudMode) {
                              try {
                                await supabase
                                  .from('userdata')
                                  .delete()
                                  .eq('user_id', user.id);
                              } catch (e) {
                                console.error('Falha ao limpar nuvem:', e);
                              }
                            }
                            
                            setTransactions([]);
                            setCategories(DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c })));
                            localStorage.clear();
                            sessionStorage.clear();
                            toast.success('Todos os dados foram apagados.');
                            setTimeout(() => window.location.reload(), 1500);
                          }
                        });
                      }}
                      className="w-full flex items-center justify-between p-6 bg-rose-500/10 text-rose-400 rounded-2xl hover:bg-rose-500/20 transition-all border border-rose-500/30"
                    >
                      <span className="font-bold text-sm">Limpar Todos os Dados</span>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </Card>

                <Card className="col-span-1 md:col-span-2 p-10 space-y-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity"><Ghost className="w-40 h-40" /></div>
                  <div className="flex items-center gap-6 relative">
                    <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-[2rem]"><User className="w-8 h-8" /></div>
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Sobre o VerdeGrana</h3>
                      <p className="text-emerald-500 font-bold uppercase text-[10px] tracking-widest">Luiz Gustavo Andrade Santos</p>
                    </div>
                  </div>
                  <div className="space-y-6 relative max-w-4xl">
                    <p className="text-lg text-slate-300 font-medium leading-relaxed">
                      Olá! Sou Luiz Gustavo Andrade Santos, criador do VerdeGrana. Desenvolvi este aplicativo para tentar controlar meus próprios gastos (especialmente com o uso de ferramentas de IA), unindo a precisão da visão contábil à praticidade da tecnologia. Este é um projeto vivo e em constante evolução, e estou à inteira disposição para implementar atualizações e melhorias imediatamente.
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                       <a href="mailto:roogxbox@gmail.com" className="px-8 py-4 bg-emerald-600 rounded-2xl font-black text-white hover:bg-emerald-500 transition-all flex items-center gap-3">
                         <Mail className="w-6 h-6" /> roogxbox@gmail.com
                       </a>
                    </div>
                  </div>
                </Card>

                <Card className="col-span-1 md:col-span-2 p-10 space-y-8 bg-black/20 border-rose-500/20 relative overflow-hidden">
                  <div className="flex items-center gap-6 relative">
                    <div className="p-4 bg-rose-500/10 text-rose-500 rounded-[2rem]"><LogOut className="w-8 h-8" /></div>
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Sair do VerdeGrana</h3>
                      <p className="text-rose-500/60 font-bold uppercase text-[10px] tracking-widest">Encerramento de Sessão</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={async () => {
                         setConfirmModal({
                           open: true,
                           title: 'Encerrar Sessão',
                           description: 'Isso desconectará sua conta e limpará os dados locais do dispositivo.',
                           action: handleLogout
                         });
                      }}
                      className="px-8 py-6 bg-emerald-600 rounded-3xl font-black text-white hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
                    >
                      <LogOut className="w-6 h-6" /> Encerrar Sessão
                    </button>
                    
                    <button 
                      onClick={() => {
                        window.location.reload();
                      }}
                      className="px-8 py-6 bg-white/5 border border-white/10 rounded-3xl font-black text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      <RefreshCw className="w-6 h-6 text-rose-500/60" /> Reiniciar App
                    </button>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'about' && (
              <motion.div key="about" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto py-10">
                <div className="text-center space-y-10">
                   <div className="p-6 bg-emerald-500 rounded-[3rem] w-fit mx-auto shadow-2xl shadow-emerald-500/30">
                      <Leaf className="w-16 h-16 text-white" />
                   </div>
                   <div className="space-y-4">
                     <h1 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">VerdeGrana</h1>
                     <p className="text-emerald-500 font-bold uppercase tracking-[0.3em] text-sm">Finanças & Tecnologia</p>
                   </div>
                   
                   <div className="glass p-12 rounded-[4rem] border border-white/5 space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12"><Ghost className="w-64 h-64" /></div>
                      <div className="space-y-6 relative">
                        <p className="text-2xl text-slate-300 font-medium leading-relaxed">
                          O **VerdeGrana** é uma ferramenta de gestão financeira idealizada para transformar a relação das pessoas com o dinheiro através da tecnologia.
                        </p>
                        <div className="space-y-4">
                           <div className="space-y-2">
                             <p className="text-xl font-bold text-white uppercase tracking-tighter">Luiz Gustavo Andrade Santos</p>
                             <p className="text-slate-400 text-sm">Estudante de Contabilidade (UFCA) & Servidor Público (IBGE)</p>
                             <p className="text-emerald-500 text-xs font-bold font-mono tracking-widest">roogxbox@gmail.com</p>
                           </div>
                           <p className="text-[10px] text-slate-600 font-medium leading-relaxed uppercase tracking-widest text-justify">
                            Este aplicativo foi inteiramente idealizado, projetado e gerado através de processos de Inteligência Artificial sob a curadoria e direção técnica de Luiz Gustavo Andrade Santos. 
                            O VerdeGrana representa o ápice da comoditização da engenharia de software através de LLMs, sendo focado em eficiência financeira e privacidade total de dados.
                            Luiz Gustavo é estudante de Ciências Contábeis na Universidade Federal do Cariri (UFCA) e atua como Servidor Público no IBGE, unindo o rigor analítico contábil com a inovação tecnológica. <br/><br/>
                            Gerado com auxílio do Google Ai Studio.
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10">
                         <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 text-center space-y-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Idealização</p>
                           <p className="text-xl font-bold text-white">Luiz Gustavo Santos</p>
                         </div>
                         <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 text-center space-y-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tecnologia</p>
                           <p className="text-xl font-bold text-white">Gemini 1.5 Pro</p>
                         </div>
                      </div>

                      <div className="pt-8 flex flex-col items-center gap-6">
                         <p className="text-slate-500 text-sm">Precisa de suporte ou tem sugestões?</p>
                         <a href="mailto:roogxbox@gmail.com" className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-lg hover:scale-105 transition-transform flex items-center justify-center gap-3">
                           <Mail className="w-6 h-6" /> roogxbox@gmail.com
                         </a>
                      </div>
                   </div>

                   <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.5em] pt-10 animate-pulse">
                     Versão 1.5.0 Stable
                   </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        {bootStage === 'ready' && (
          <div className="w-full max-w-xs mx-auto text-center py-12 opacity-30">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.25em] leading-relaxed">
              Gerado por Luiz Gustavo Andrade Santos<br/>
              App feito 100% com IA<br/>
              Todos os direitos reservados ao Google Ai Studio
            </p>
          </div>
        )}
      </main>

      {/* Edge-Swipe Visual Handle */}
      <AnimatePresence>
        {confirmModal.open && (
           <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal(p => ({ ...p, open: false }))} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative glass max-w-sm w-full p-10 rounded-[3rem] border border-white/10 shadow-2xl text-center space-y-6">
                 <div className="w-16 h-16 bg-emerald-500/20 rounded-[1.5rem] flex items-center justify-center mx-auto text-emerald-500">
                    <ShieldCheck className="w-8 h-8" />
                 </div>
                 <div className="space-y-3">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">{confirmModal.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{confirmModal.description}</p>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => setConfirmModal(p => ({ ...p, open: false }))} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all">Cancelar</button>
                    <button onClick={() => { confirmModal.action(); setConfirmModal(p => ({ ...p, open: false })); }} className="flex-1 py-4 bg-emerald-600 rounded-2xl font-bold hover:bg-emerald-500 transition-all active:scale-95">Confirmar</button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {edgeSwipe.active && edgeSwipe.distance > 10 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: edgeSwipe.side === 'left' ? -20 : 20 }}
            animate={{ 
              opacity: 1, 
              scale: edgeSwipe.distance > 120 ? 1.2 : 1,
              x: edgeSwipe.side === 'left' ? edgeSwipe.distance - 40 : -(edgeSwipe.distance - 40)
            }}
            exit={{ opacity: 0, scale: 0.5, x: edgeSwipe.side === 'left' ? -40 : 40 }}
            className={cn(
              "fixed top-1/2 -translate-y-1/2 z-[100] w-12 h-24 glass rounded-full flex items-center justify-center border border-white/20 shadow-2xl transition-colors",
              edgeSwipe.distance > 120 ? "bg-emerald-500/40 border-emerald-500/50" : "bg-white/10"
            )}
            style={{ 
              left: edgeSwipe.side === 'left' ? 0 : 'auto',
              right: edgeSwipe.side === 'right' ? 0 : 'auto',
            }}
          >
            {edgeSwipe.side === 'left' ? (
              <ChevronRight className={cn("w-6 h-6 text-white transition-transform", edgeSwipe.distance > 120 ? "scale-125" : "")} />
            ) : (
              <ChevronLeft className={cn("w-6 h-6 text-white transition-transform", edgeSwipe.distance > 120 ? "scale-125" : "")} />
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* MOBILE BOTTOM NAVBAR */}
      {bootStage === 'ready' && (
        <nav className="fixed bottom-0 left-0 w-full glass bg-slate-950/95 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around py-4 pb-safe z-50 flex-shrink-0">
          <MobileNavItem icon={<Home />} label="Início" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <MobileNavItem icon={<ReceiptText />} label="Lançamentos" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <button 
            onClick={() => { setQuickAddDate(null); setIsAddModalOpen(true); }}
            className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 -mt-8 active:scale-90 transition-transform"
          >
            <Plus className="w-8 h-8 text-white" />
          </button>
          <MobileNavItem icon={<Bot />} label="IA" active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
          <MobileNavItem icon={<Settings />} label="Ajustes" active={activeTab === 'settings' || activeTab === 'about'} onClick={() => setActiveTab('settings')} />
        </nav>
      )}

      {/* FOLDER PERMISSION OVERLAY */}
      <AnimatePresence>
        {isComparisonModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsComparisonModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative glass max-w-xl w-full p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-8">
               <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black text-white tracking-tighter">Comparar Categorias</h2>
                 <button onClick={() => setIsComparisonModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X/></button>
               </div>
               
               <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map(cat => {
                    const totalExp = transactions.filter(t => t.category === cat.name && t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
                    const totalInc = transactions.filter(t => t.category === cat.name && t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
                    const isSelected = analyticsConfig.compareCategories.includes(cat.name);
                    
                    return (
                      <button 
                        key={cat.id}
                        onClick={() => {
                          setAnalyticsConfig(p => ({
                            ...p,
                            compareCategories: isSelected
                              ? p.compareCategories.filter(n => n !== cat.name)
                              : [...p.compareCategories, cat.name]
                          }));
                        }}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all group",
                          isSelected ? "bg-emerald-500/20 border-emerald-500" : "bg-white/5 border-white/5 hover:border-white/20"
                        )}
                      >
                         <div className="flex justify-between items-start mb-2">
                           <span className={cn("font-bold text-sm transition-colors", isSelected ? "text-emerald-400" : "text-slate-400")}>{cat.name}</span>
                           {isSelected && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-emerald-500/60 font-medium">Entradas: {formatCurrency(totalInc)}</span>
                            <span className="text-[10px] text-rose-500/60 font-medium">Saídas: {formatCurrency(totalExp)}</span>
                         </div>
                      </button>
                    );
                  })}
               </div>
               
               <button onClick={() => setIsComparisonModalOpen(false)} className="w-full py-4 bg-emerald-600 rounded-2xl font-bold hover:bg-emerald-500 transition-all active:scale-95 shadow-xl shadow-emerald-500/20">
                 Ver Comparação ({analyticsConfig.compareCategories.length})
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryToDelete && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setCategoryToDelete(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative glass max-w-sm w-full p-10 rounded-[2.5rem] border border-rose-500/20 shadow-2xl text-center space-y-6">
               <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
                 <Trash2 className="w-8 h-8" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-bold text-white">Excluir Categoria?</h3>
                 <p className="text-slate-400 text-sm">Tem certeza que deseja excluir <strong>"{categoryToDelete.name}"</strong>? Isso não removerá os lançamentos vinculados, mas eles ficarão sem categoria definida.</p>
               </div>
               <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setCategories(p => p.filter(c => c.id !== categoryToDelete.id));
                      setCategoryToDelete(null);
                      toast.info('Categoria removida com sucesso.');
                    }}
                    className="flex-1 py-4 bg-rose-600 rounded-2xl font-bold hover:bg-rose-500 transition-colors"
                  >
                    Excluir
                  </button>
                  <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-4 bg-white/10 rounded-2xl font-bold border border-white/10">Cancelar</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALS & OVERLAYS */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsAddModalOpen(false)} />
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 600 }}
              className="relative w-full max-w-2xl bg-[#0f172a] md:glass p-8 rounded-t-[3rem] md:rounded-[3rem] border-t md:border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-white">{editingTransaction ? 'Editar' : 'Novo Lançamento'}</h2>
                <button onClick={() => { setIsAddModalOpen(false); setEditingTransaction(null); setQuickAddDate(null); }} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X/></button>
              </div>

              <form onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const val = parseFloat(fd.get('value') as string);
                const rawType = fd.get('type') as TransactionType;
                
                const data = {
                  date: fd.get('date') as string,
                  desc: fd.get('desc') as string,
                  value: val,
                  category: fd.get('category') as string,
                  type: rawType,
                  profile_name: activeProfile
                };

                if (editingTransaction) {
                  handleUpdateTransaction(editingTransaction.id, data);
                  toast.success('Lançamento atualizado!');
                } else {
                  handleAddTransaction(data);
                }
                setIsAddModalOpen(false);
                setEditingTransaction(null);
                setQuickAddDate(null);
              }} className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Data</label>
                    <input name="date" required type="date" defaultValue={editingTransaction?.date || quickAddDate || new Date().toISOString().split('T')[0]} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Fluxo</label>
                    <select name="type" defaultValue={editingTransaction?.type || 'saída'} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all appearance-none">
                      <option value="entrada" className="bg-slate-900">Entrada (+)</option>
                      <option value="saída" className="bg-slate-900">Saída (-)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Descrição / Estabelecimento</label>
                  <input name="desc" required placeholder="Ex: Supermercado, Aluguel..." defaultValue={editingTransaction?.desc} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Valor Total</label>
                    <input name="value" required type="number" step="0.01" placeholder="0,00" defaultValue={editingTransaction?.value} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all text-xl font-black" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Tag / Categoria</label>
                    <div className="grid grid-cols-2 gap-4">
                      <select 
                        name="category" 
                        defaultValue={editingTransaction?.category || 'Outros'} 
                        className="col-span-1 h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all appearance-none"
                      >
                        {categories.map(c => <option key={c.id} value={c.name} className="bg-slate-900">{c.name}</option>)}
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          const name = prompt('Nome da nova categoria:');
                          if (name) {
                            const newCat = { id: Date.now().toString(), name, color: '#10b981', icon: 'Plus' };
                            setCategories(prev => [...prev, newCat]);
                          }
                        }}
                        className="h-16 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500/20 transition-all"
                      >
                        <Plus className="w-4 h-4" /> Nova Categoria
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-emerald-600 rounded-[2rem] font-bold text-xl hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-600/30 active:scale-95">
                  Confirmar Operação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

function MobileNavItem({ icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all flex-1 min-w-0 px-1",
        active ? "text-emerald-400 scale-110" : "text-slate-500 hover:text-slate-300"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all flex-shrink-0",
        active ? "bg-emerald-500/10" : ""
      )}>
        {React.cloneElement(icon, { size: active ? 22 : 20 })}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest leading-none truncate w-full text-center px-1">{label}</span>
    </button>
  );
}

function StatSmall({ label, value, color, prefix = '' }: any) {
  return (
    <div className="bg-slate-900 px-6 py-5 rounded-[2rem] border border-white/5 flex flex-col items-center sm:items-start min-w-0 w-full shadow-sm overflow-hidden box-border">
      <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-1.5 truncate w-full">{label}</span>
      <span className={cn("text-xl font-black tracking-tighter truncate w-full flex min-w-0", color)}>
        <span className="mr-0.5 opacity-60 font-medium flex-shrink-0">{prefix}</span>
        <span className="truncate">{formatCurrency(value)}</span>
      </span>
    </div>
  );
}

function Card({ children, className }: any) {
  return (
    <div className={cn("glass rounded-[2.5rem] border border-white/5 shadow-2xl", className)}>
      {children}
    </div>
  );
}
