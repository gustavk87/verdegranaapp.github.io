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
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Folder,
  User,
  Mail,
  Ghost
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'sonner';
import { initDB, getState, saveState } from './db';

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
type AppMode = 'desktop' | 'mobile';

interface Transaction {
  id: string;
  date: string;
  desc: string;
  value: number;
  category: string;
  type: TransactionType;
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

interface DateFilter {
  month: number;
  year: number;
  type: 'month' | 'custom';
  startDate?: string;
  endDate?: string;
}

interface AnalyticsConfig {
  granularity: 'day' | 'month' | 'year';
  compareCategories: string[];
}
let dbInstance: any = null;

export default function App() {
  const [bootStage, setBootStage] = useState<'splash' | 'selector' | 'source' | 'welcome' | 'ready'>('splash');
  const [mode, setMode] = useState<AppMode>('desktop');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('reports');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(
    DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c }))
  );
  
  // Persistence Handles
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [isFolderPermissionMissing, setIsFolderPermissionMissing] = useState(false);

  // UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>({ 
    month: new Date().getMonth() + 1, 
    year: new Date().getFullYear(),
    type: 'month'
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
  const [isChartReady, setIsChartReady] = useState(false);
  const [wipeStep, setWipeStep] = useState(0);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  // Sync state to IDB (Instant)
  useEffect(() => {
    if (activeTab === 'reports') {
      setIsChartReady(false);
      const t = setTimeout(() => setIsChartReady(true), 300);
      return () => clearTimeout(t);
    }
  }, [activeTab]);

  // --- Persistence Logic (File System) ---
  const FILE_NAME = 'verdegrana_db.json';

  const readFromFile = async (handle: FileSystemDirectoryHandle, firstTime = false) => {
    try {
      // @ts-ignore
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        setIsFolderPermissionMissing(true);
        return false;
      }

      let fileHandle;
      try {
        fileHandle = await handle.getFileHandle(FILE_NAME, { create: false });
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (text) {
          const data = JSON.parse(text);
          
          // Elastic Schema: Discover categories from transactions if they aren't in the registry
          const existingCategories = data.categories || DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c }));
          const discoveredCategories = [...existingCategories];
          
          if (data.transactions) {
            data.transactions.forEach((t: Transaction) => {
              const exists = discoveredCategories.some(c => c.name.toLowerCase() === t.category.toLowerCase());
              if (!exists) {
                discoveredCategories.push({
                  id: t.category.toLowerCase().replace(/\s+/g, '-'),
                  name: t.category,
                  color: `#${Math.floor(Math.random()*16777215).toString(16)}`
                });
              }
            });
            setTransactions(data.transactions);
          }
          
          setCategories(discoveredCategories);
        }
        toast.success(firstTime ? 'Arquivo de dados carregado!' : 'Sincronização restaurada!');
      } catch (e) {
        // File doesn't exist, create it
        await writeToFile(handle, { 
          transactions: [], 
          categories: DEFAULT_CATEGORIES.map(c => ({ id: c.toLowerCase(), name: c })) 
        });
        toast.success(`Bem-vindo ao VerdeGrana! Criamos seu arquivo de dados com sucesso.`);
      }
      
      setIsFolderPermissionMissing(false);
      setSyncStatus('synced');
      return true;
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
      return false;
    }
  };

  const writeToFile = async (handle: FileSystemDirectoryHandle, data: any) => {
    try {
      setSyncStatus('saving');
      const fileHandle = await handle.getFileHandle(FILE_NAME, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      setSyncStatus('synced');
      setIsDirty(false);
    } catch (e) {
      console.error('Falha ao gravar no arquivo:', e);
      setSyncStatus('error');
      setIsDirty(true);
    }
  };

  // --- Initial Boot & Persistence ---
  useEffect(() => {
    const boot = async () => {
      // Stage 1: Splash (4s for readable credits)
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      dbInstance = await initDB();
      const savedState = await getState(dbInstance);
      
      if (savedState) {
        if (savedState.transactions) setTransactions(savedState.transactions);
        if (savedState.categories) setCategories(savedState.categories);
        
        if (savedState.workspaceHandle) {
          setDirHandle(savedState.workspaceHandle);
          // If we have a handle, show the welcome screen to request permission
          setIsFolderPermissionMissing(true);
          setBootStage('welcome');
          return;
        }

        if (savedState.mode) {
          setMode(savedState.mode);
        }
      }
      setBootStage('selector');
    };
    boot();
  }, []);

  // Sync state to IDB (Instant)
  useEffect(() => {
    if (dbInstance && bootStage === 'ready' && !isDemoMode) {
      const stateToSave = { transactions, categories, mode, workspaceHandle: dirHandle || undefined };
      saveState(dbInstance, stateToSave);
      setIsDirty(true);
    }
  }, [transactions, categories, mode, dirHandle, bootStage, isDemoMode]);

  // Debounced File System Sync
  useEffect(() => {
    if (!dirHandle || !isDirty || bootStage !== 'ready' || isFolderPermissionMissing || isDemoMode) return;

    const timeout = setTimeout(async () => {
      // @ts-ignore
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        await writeToFile(handle, { transactions, categories });
      } else {
        setIsFolderPermissionMissing(true);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [transactions, categories, dirHandle, isDirty, bootStage, isFolderPermissionMissing, isDemoMode]);

  // --- Handlers ---
  const handleRequestFolderPermission = async () => {
    if (!dirHandle) return;
    try {
      // @ts-ignore
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        setIsFolderPermissionMissing(false);
        const success = await readFromFile(dirHandle);
        if (success) {
          setBootStage('ready');
        }
      }
    } catch (e) {
      toast.error('Não foi possível obter permissão da pasta.');
    }
  };

  const handleSelectDirectory = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);
      // After selecting, we transition to the welcome screen for final handshake
      setIsFolderPermissionMissing(true);
      setBootStage('welcome');
      toast.success('Diretório selecionado com sucesso!');
    } catch (e) {
      toast.error('Erro ao selecionar pasta.');
    }
  };

  const startDemoMode = () => {
    setIsDemoMode(true);
    setBootStage('ready');
    toast.warning('Modo Demonstrativo: Seus dados serão perdidos ao fechar a página.');
  };

  const skipFolderSync = () => {
    setBootStage('ready');
    toast.info('Usando apenas armazenamento local do navegador.');
  };

  // Keyboard Shortcuts (Desktop Mode)
  useEffect(() => {
    if (mode === 'desktop' && bootStage === 'ready') {
      const handleKeys = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); setIsAddModalOpen(true); }
        if (e.key.toLowerCase() === 'a') { e.preventDefault(); setActiveTab('ai'); }
        if (e.key.toLowerCase() === 's') { e.preventDefault(); exportData(); }
      };
      window.addEventListener('keydown', handleKeys);
      return () => window.removeEventListener('keydown', handleKeys);
    }
  }, [mode, bootStage]);

  // --- Core Business Logic ---

  // Intelligent Import Logic
  const processImport = useCallback((data: any[]) => {
    if (!Array.isArray(data)) {
      toast.error('Formato de dados inválido.');
      return;
    }

    const newTransactions: Transaction[] = [];
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

      // Deduplication check (Hash of date + desc + value)
      const hash = `${item.date}-${item.desc}-${item.value}`;
      const isDuplicate = transactions.some(t => `${t.date}-${t.desc}-${t.value}` === hash);

      if (!isDuplicate) {
        newTransactions.push({
          ...item,
          id: crypto.randomUUID()
        } as Transaction);
      }
    });

    setCategories(newCategories);
    if (newTransactions.length > 0) {
      setTransactions(prev => [...prev, ...newTransactions]);
      toast.success(`${newTransactions.length} transações importadas com sucesso!`);
    } else {
      toast.info('Nenhuma transação nova detectada.');
    }
  }, [categories, transactions]);

  // Calculations & Filters
  const currentTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = new Date(t.date);
      if (dateFilter.type === 'month') {
        return (date.getMonth() + 1) === dateFilter.month && date.getFullYear() === dateFilter.year;
      } else if (dateFilter.startDate && dateFilter.endDate) {
        const start = new Date(dateFilter.startDate);
        const end = new Date(dateFilter.endDate);
        return date >= start && date <= end;
      }
      return true;
    });
  }, [transactions, dateFilter]);

  const stats = useMemo(() => {
    const income = currentTransactions.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
    const expenses = currentTransactions.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
    const total = income - expenses;
    
    const balanceColor = total > 0 ? 'text-emerald-400' : total < 0 ? 'text-rose-500' : 'text-slate-400';

    return { total, income, expenses, balanceColor };
  }, [currentTransactions]);

  const chartData = useMemo(() => {
    if (analyticsConfig.granularity === 'month') {
      const lastMonths = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return { month: d.getMonth() + 1, year: d.getFullYear(), label: d.toLocaleString('pt-BR', { month: 'short' }) };
      }).reverse();

      return lastMonths.map(m => {
        const income = transactions.filter(t => {
          const d = new Date(t.date);
          return t.type === 'entrada' && (d.getMonth() + 1) === m.month && d.getFullYear() === m.year;
        }).reduce((acc, t) => acc + t.value, 0);
        
        const expense = transactions.filter(t => {
          const d = new Date(t.date);
          return t.type === 'saída' && (d.getMonth() + 1) === m.month && d.getFullYear() === m.year;
        }).reduce((acc, t) => acc + t.value, 0);
        
        return { name: m.label, income, expense };
      });
    } else if (analyticsConfig.granularity === 'day') {
      const lastDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return { date: d.toISOString().split('T')[0], label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) };
      }).reverse();

      return lastDays.map(d => {
        const income = transactions.filter(t => t.type === 'entrada' && t.date === d.date).reduce((acc, t) => acc + t.value, 0);
        const expense = transactions.filter(t => t.type === 'saída' && t.date === d.date).reduce((acc, t) => acc + t.value, 0);
        return { name: d.label, income, expense };
      });
    } else {
      const lastYears = [2024, 2025, 2026];
      return lastYears.map(y => {
        const income = transactions.filter(t => t.type === 'entrada' && new Date(t.date).getFullYear() === y).reduce((acc, t) => acc + t.value, 0);
        const expense = transactions.filter(t => t.type === 'saída' && new Date(t.date).getFullYear() === y).reduce((acc, t) => acc + t.value, 0);
        return { name: y.toString(), income, expense };
      });
    }
  }, [transactions, analyticsConfig.granularity]);

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

    return Object.keys({ ...expByCat, ...incByCat }).map(name => ({
      name,
      expense: expByCat[name] || 0,
      income: incByCat[name] || 0,
      value: expByCat[name] || 0 // Keep value for pie compatibility
    }));
  }, [currentTransactions]);

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

   const comparisonData = useMemo(() => {
    if (analyticsConfig.compareCategories.length === 0) return [];
    
    // Last points for the selected categories
    const points = chartData.map(d => d.name);
    return points.map(p => {
       const item: any = { name: p };
       analyticsConfig.compareCategories.forEach(cat => {
          const catTransactions = transactions.filter(t => t.category === cat);
          
          const filtered = catTransactions.filter(t => {
            const d = new Date(t.date);
            if (analyticsConfig.granularity === 'month') return d.toLocaleString('pt-BR', { month: 'short' }) === p;
            if (analyticsConfig.granularity === 'day') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) === p;
            return d.getFullYear().toString() === p;
          });

          item[`${cat}_expense`] = filtered.filter(t => t.type === 'saída').reduce((acc, it) => acc + it.value, 0);
          item[`${cat}_income`] = filtered.filter(t => t.type === 'entrada').reduce((acc, it) => acc + it.value, 0);
       });
       return item;
    });
  }, [transactions, analyticsConfig.compareCategories, chartData, analyticsConfig.granularity]);

  const exportData = () => {
    const data = JSON.stringify({ transactions, categories }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vgrana_backup.json`;
    link.click();
    toast.success('Backup exportado!');
  };

  // --- UI Renders ---

  // Splash Screen
  if (bootStage === 'splash') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 px-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full pulse-glow" />
          <Leaf className="w-24 h-24 text-emerald-500 relative z-10" />
        </motion.div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-black text-white mt-8 tracking-tighter"
        >
          Verde<span className="text-emerald-500">Grana</span>
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 text-center max-w-xs"
        >
           <p className="text-[10px] text-slate-600 font-medium leading-relaxed uppercase tracking-widest">
            Gerado por Luiz Gustavo Andrade Santos, app feito 100% com IA. <br/>
            Todos os direitos reservados ao Google Ai Studio.
          </p>
        </motion.div>
      </div>
    );
  }

  // Mode Selector
  if (bootStage === 'selector') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 sm:p-0 overflow-y-auto">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl w-full text-center space-y-12">
          <div className="space-y-6">
            <div className="p-4 bg-emerald-500 rounded-[2rem] w-fit mx-auto shadow-2xl shadow-emerald-500/30">
              <Leaf className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-6xl font-black text-white tracking-tighter leading-none uppercase">VerdeGrana</h1>
            <p className="text-xl text-slate-400 font-medium max-w-lg mx-auto">Finanças inteligentes, 100% locais.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6">
            <button 
              onClick={() => { setMode('desktop'); setBootStage('source'); }}
              className="glass p-10 rounded-[3rem] group hover:border-emerald-500/50 transition-all border border-white/5 active:scale-95"
            >
              <Monitor className="w-16 h-16 mx-auto mb-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <h3 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">Modo Desktop</h3>
              <p className="text-sm text-slate-500 font-medium italic">Multijanelas e atalhos rápidos</p>
            </button>
            
            <button 
              onClick={() => { setMode('mobile'); setBootStage('source'); }}
              className="glass p-10 rounded-[3rem] group hover:border-emerald-500/50 transition-all border border-white/5 active:scale-95"
            >
              <Smartphone className="w-16 h-16 mx-auto mb-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <h3 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">Modo Mobile</h3>
              <p className="text-sm text-slate-500 font-medium italic">Touch-first e navegação inferior</p>
            </button>
          </div>

          <div className="pt-8 border-t border-white/5">
             <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.25em] leading-relaxed">
               Gerado por Luiz Gustavo Andrade Santos<br/>
               App feito 100% com IA<br/>
               Todos os direitos reservados ao Google AI Studio
             </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Source Selector
  if (bootStage === 'source') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 sm:p-0 overflow-y-auto">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full glass p-10 rounded-[4rem] border border-white/10 shadow-2xl text-center space-y-10">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-[2rem] mx-auto flex items-center justify-center">
              <FolderSync className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-tight">Escolha sua Fonte de Dados</h2>
            <p className="text-slate-400 text-sm leading-relaxed">A sincronização mantém seus dados seguros e privados no seu dispositivo.</p>
          </div>
          
          <div className="space-y-4">
             <button 
              onClick={handleSelectDirectory}
              className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-sm uppercase transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-3"
             >
               <RefreshCw className="w-6 h-6" /> Sincronizar Meus Dados
             </button>
             
             <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-600"><span className="bg-slate-900 px-4">OU</span></div>
             </div>

             <div className="space-y-3">
               <button 
                onClick={startDemoMode}
                className="w-full py-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-black text-xs uppercase transition-all active:scale-95"
               >
                 Testar Site (Trial)
               </button>
               <p className="text-[10px] text-rose-500/60 font-bold uppercase tracking-widest leading-relaxed">Não recomendado - Dados não serão salvos permanentemente</p>
             </div>
          </div>
          
          <button onClick={() => setBootStage('selector')} className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
            <ArrowLeft className="w-3 h-3" /> Voltar ao Início
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
               <UserCheck className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">BEM-VINDO DE VOLTA!</h1>
            <p className="text-slate-400 text-sm leading-relaxed px-4">Detectamos sua pasta de sincronização. Clique para carregar seus dados financeiros.</p>
          </div>

          <div className="bg-emerald-500/5 p-5 rounded-3xl border border-emerald-500/10 text-left flex items-center gap-4">
             <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-500"><Folder className="w-5 h-5" /></div>
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Pasta Sincronizada</p>
                <p className="text-xs text-slate-400 truncate font-mono">{dirHandle?.name || 'Local de Dados'}</p>
             </div>
          </div>

          <div className="space-y-4">
             <button 
              onClick={handleRequestFolderPermission}
              className="w-full py-6 bg-emerald-600 rounded-3xl font-black text-white hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
             >
               ACESSAR MEU PAINEL <ArrowRight className="w-5 h-5" />
             </button>
             <button 
              onClick={() => setBootStage('selector')}
              className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-slate-500 text-xs uppercase hover:bg-white/10 transition-all active:scale-95"
             >
               TROCAR FONTE DE DADOS
             </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main App
  return (
    <div className={cn(
      "h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 flex select-none",
      mode === 'mobile' ? "flex-col" : "flex-row"
    )}>
      <Toaster position="top-right" theme="dark" richColors />

      {/* DESKTOP SIDEBAR */}
      {mode === 'desktop' && (
        <aside className="w-24 bg-slate-900 border-r border-white/5 flex flex-col items-center py-8 gap-10 z-20">
          <div className="p-3 bg-emerald-500 rounded-2xl shadow-xl shadow-emerald-500/20">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          
          <nav className="flex flex-col gap-6">
            <NavItem icon={<LayoutDashboard />} label="Relatórios" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            <NavItem icon={<ReceiptText />} label="Lançamentos" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <NavItem icon={<Bot />} label="IA" active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
            <NavItem icon={<Tag />} label="Categorias" active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
            <NavItem icon={<Settings />} label="Ajustes" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
            <NavItem icon={<Leaf />} label="Créditos" active={activeTab === 'about'} onClick={() => setActiveTab('about')} />
          </nav>

          <button 
            onClick={() => setBootStage('selector')}
            className="mt-auto p-4 text-slate-500 hover:text-white transition-colors"
            title="Trocar Modo"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </aside>
      )}

      {/* CONTENT AREA */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-24 md:pb-0">
        <header className="p-6 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-white tracking-tighter">VerdeGrana <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-mono uppercase">Pro</span></h1>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10">
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
              ) : (
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
              )}
              
              {dirHandle && (
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-bold ml-2 transition-all",
                  syncStatus === 'saving' ? "text-amber-500 animate-pulse" : 
                  syncStatus === 'synced' ? "text-emerald-500" : "text-rose-500"
                )}>
                  {syncStatus === 'saving' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FolderSync className="w-3 h-3" />}
                  {syncStatus === 'saving' ? 'SALVANDO...' : 'SINCRONIZADO'}
                </div>
              )}
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
                <div className="col-span-12 flex flex-wrap items-center justify-between gap-4 glass p-6 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agrupar por:</span>
                    <div className="flex p-1 bg-white/5 rounded-full border border-white/10">
                      {(['day', 'month', 'year'] as const).map(g => (
                        <button 
                          key={g} 
                          onClick={() => setAnalyticsConfig(p => ({ ...p, granularity: g }))}
                          className={cn("px-4 py-1.5 rounded-full text-[10px] font-black transition-all uppercase", analyticsConfig.granularity === g ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300")}
                        >
                          {g === 'day' ? 'Dia' : g === 'month' ? 'Mês' : 'Ano'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Comparar Categorias:</span>
                    <button 
                      onClick={() => setIsComparisonModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black transition-all"
                    >
                      <Plus className="w-3 h-3" /> SELECIONAR CATEGORIAS
                    </button>
                    {analyticsConfig.compareCategories.length > 0 && (
                      <button 
                        onClick={() => setAnalyticsConfig(p => ({ ...p, compareCategories: [] }))}
                        className="text-[9px] font-bold text-rose-500 hover:scale-105 transition-transform"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {transactions.length === 0 ? (
                  <div className="col-span-12 py-32 text-center glass rounded-[3rem] border-dashed border-white/10">
                    <Leaf className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-slate-400">Nenhum dado encontrado</h3>
                    <p className="text-slate-600 mb-8">Use o Assistente IA ou adicione manualmente.</p>
                    <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-4 bg-emerald-600 rounded-2xl font-bold hover:scale-105 transition-all">Começar Agora</button>
                  </div>
                ) : (
                  <>
                    {analyticsConfig.compareCategories.length > 0 && (
                      <Card className="col-span-12 p-8 h-[450px] relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                          <button 
                            onClick={() => setAnalyticsConfig(p => ({ ...p, compareCategories: [] }))}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-bold text-lg mb-6 text-white tracking-tight flex items-center gap-3 uppercase">
                           <BarChart2 className="w-5 h-5 text-emerald-400" /> Detalhado por Categoria
                        </h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                            <Legend verticalAlign="top" height={36}/>
                            {analyticsConfig.compareCategories.map((cat, i) => (
                              <React.Fragment key={cat}>
                                <Bar 
                                  dataKey={`${cat}_expense`} 
                                  name={`${cat} (Despesa)`}
                                  fill="#f43f5e" 
                                  fillOpacity={0.8 - (i * 0.1)}
                                  radius={[4, 4, 0, 0]} 
                                />
                                <Bar 
                                  dataKey={`${cat}_income`} 
                                  name={`${cat} (Receita)`}
                                  fill="#10b981" 
                                  fillOpacity={0.8 - (i * 0.1)}
                                  radius={[4, 4, 0, 0]} 
                                />
                              </React.Fragment>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    <Card className="col-span-12 lg:col-span-8 h-[450px] p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2" />
                      <h3 className="font-bold text-lg mb-6 uppercase tracking-tighter">Fluxo de Caixa Consolidado</h3>
                      {isChartReady ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                            <Legend verticalAlign="top" height={36}/>
                            <Bar dataKey="income" name="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="expense" name="Despesa" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-emerald-500/20 animate-spin" />
                        </div>
                      )}
                    </Card>

                    <Card className="col-span-12 lg:col-span-4 h-[450px] p-8 relative overflow-hidden flex flex-col">
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full translate-y-1/2 -translate-x-1/2" />
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex justify-between items-center">
                          <h3 className="font-black text-lg uppercase tracking-tighter">Mapa Geométrico</h3>
                           <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                              <button 
                                onClick={() => setDonutColorMode('unique')}
                                className={cn("px-2 py-1 text-[8px] font-black rounded transition-all", donutColorMode === 'unique' ? "bg-white/10 text-white" : "text-slate-500")}
                              >
                                ELEGANT
                              </button>
                              <button 
                                onClick={() => setDonutColorMode('flow')}
                                className={cn("px-2 py-1 text-[8px] font-black rounded transition-all", donutColorMode === 'flow' ? "bg-white/10 text-white" : "text-slate-500")}
                              >
                                VIBRANT
                              </button>
                           </div>
                        </div>
                        
                        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                            <button 
                              onClick={() => setDonutType('saída')}
                              className={cn("flex-1 py-2 text-[10px] font-black rounded-xl transition-all", donutType === 'saída' ? "bg-rose-500 text-white" : "text-slate-500")}
                            >
                              DESPESAS
                            </button>
                            <button 
                              onClick={() => setDonutType('entrada')}
                              className={cn("flex-1 py-2 text-[10px] font-black rounded-xl transition-all", donutType === 'entrada' ? "bg-emerald-500 text-white" : "text-slate-500")}
                            >
                              RECEITAS
                            </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0">
                        {isChartReady ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categoryData}
                                cx="50%" cy="50%"
                                innerRadius={70} outerRadius={100}
                                paddingAngle={2} 
                                dataKey={donutType === 'saída' ? 'expense' : 'income'}
                                stroke="none"
                              >
                                {categoryData.map((entry, i) => (
                                  <Cell 
                                    key={i} 
                                    fill={donutColorMode === 'unique' 
                                      ? (donutType === 'saída' ? ['#f43f5e', '#e11d48', '#be123c', '#9f1239'][i % 4] : ['#10b981', '#059669', '#047857', '#065f46'][i % 4])
                                      : (donutType === 'saída' ? '#f43f5e' : '#10b981')
                                    } 
                                    fillOpacity={donutColorMode === 'unique' ? 1 : (1 - (i * 0.1))}
                                  />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 text-emerald-500/20 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-2 overflow-y-auto max-h-32 custom-scrollbar pr-2">
                         {categoryData.filter(c => donutType === 'saída' ? c.expense > 0 : c.income > 0).sort((a, b) => (donutType === 'saída' ? b.expense - a.expense : b.income - a.income)).map((cat, i) => (
                           <div key={cat.name} className="flex items-center justify-between text-[10px] bg-white/5 p-2 rounded-xl border border-white/5">
                             <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: donutType === 'saída' ? '#f43f5e' : '#10b981', opacity: donutColorMode === 'unique' ? 0.3 + (i * 0.1) : 1 - (i * 0.1) }} />
                               <span className="font-bold text-slate-400 truncate max-w-[100px] tracking-tight">{cat.name}</span>
                             </div>
                             <span className="font-black text-white">{formatCurrency(donutType === 'saída' ? cat.expense : cat.income)}</span>
                           </div>
                         ))}
                      </div>
                    </Card>

                    <Card className="col-span-12 p-10 h-[400px] relative overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                      <h3 className="font-black text-lg mb-8 uppercase tracking-tighter">Tendência & Performance</h3>
                      {isChartReady ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                            <Legend verticalAlign="top" height={36}/>
                            <Area type="monotone" dataKey="income" name="Performance (Receita)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInc)" />
                            <Area type="monotone" dataKey="expense" name="Carga (Despesa)" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                          </AreaChart>
                        </ResponsiveContainer>
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
              <motion.div key="tx" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <div className="flex flex-col gap-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                      <input 
                        type="text" placeholder="Filtrar por descrição ou categoria..." 
                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-emerald-500/50 transition-all outline-none"
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/10">
                       <select 
                        value={sortConfig}
                        onChange={e => setSortConfig(e.target.value as any)}
                        className="bg-transparent text-slate-300 text-xs font-bold px-4 py-2 outline-none appearance-none"
                       >
                         <option value="date" className="bg-slate-900">Mais Recentes</option>
                         <option value="value-desc" className="bg-slate-900">Maior Valor</option>
                         <option value="value-asc" className="bg-slate-900">Menor Valor</option>
                       </select>
                    </div>

                    <button onClick={() => setIsAddModalOpen(true)} className="w-full md:w-auto h-14 px-8 bg-emerald-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors shadow-xl shadow-emerald-600/20">
                      <Plus className="w-6 h-6" /> Novo Lançamento
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase font-black text-slate-600 mr-2">Filtrar Categoria:</span>
                    {categories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => {
                          setCategoryFilters(p => p.includes(cat.name) ? p.filter(c => c !== cat.name) : [...p, cat.name]);
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-bold border transition-all",
                          categoryFilters.includes(cat.name) ? "bg-emerald-500 text-white border-emerald-500" : "bg-white/5 border-white/10 text-slate-500"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                    {categoryFilters.length > 0 && <button onClick={() => setCategoryFilters([])} className="text-[9px] font-bold text-rose-500 hover:underline">Limpar Filtros</button>}
                  </div>

                  {selectedTxIds.length > 0 && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-2">
                       <button 
                        onClick={() => {
                          setTransactions(p => p.filter(t => !selectedTxIds.includes(t.id)));
                          setSelectedTxIds([]);
                          toast.success(`${selectedTxIds.length} itens removidos.`);
                        }}
                        className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all shadow-xl shadow-rose-500/5"
                       >
                         <Trash2 className="w-5 h-5" /> Deletar Selecionados ({selectedTxIds.length})
                       </button>
                    </motion.div>
                  )}
                </div>

                <div className="glass rounded-[2.5rem] overflow-hidden border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                        <tr>
                          <th className="px-8 py-5">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-white/10 bg-slate-900 checked:bg-emerald-500 focus:ring-0" 
                              onChange={(e) => {
                                if (e.target.checked) setSelectedTxIds(filteredTransactions.map(t => t.id));
                                else setSelectedTxIds([]);
                              }}
                              checked={selectedTxIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                            />
                          </th>
                          <th className="px-8 py-5">Data</th>
                          <th className="px-8 py-5">Descrição</th>
                          <th className="px-8 py-5">Categoria</th>
                          <th className="px-8 py-5">Valor</th>
                          <th className="px-10 py-5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredTransactions.map(t => (
                          <tr key={t.id} className={cn("hover:bg-white/5 transition-all group", selectedTxIds.includes(t.id) && "bg-emerald-500/5")}>
                            <td className="px-8 py-6">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-white/10 bg-slate-900 checked:bg-emerald-500 focus:ring-0" 
                                checked={selectedTxIds.includes(t.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedTxIds(prev => [...prev, t.id]);
                                  else setSelectedTxIds(prev => prev.filter(id => id !== t.id));
                                }}
                              />
                            </td>
                            <td className="px-8 py-6 text-sm text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-8 py-6 font-semibold text-white">{t.desc}</td>
                            <td className="px-8 py-6 text-xs">
                              <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/10 uppercase font-bold tracking-wider">{t.category}</span>
                            </td>
                            <td className={cn("px-8 py-6 font-black", t.type === 'entrada' ? "text-emerald-400" : "text-rose-500")}>
                              {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.value)}
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingTransaction(t); setIsAddModalOpen(true); }} className="p-2.5 bg-white/5 rounded-xl hover:text-emerald-400 transition-colors"><Edit3 className="w-5 h-5" /></button>
                                <button onClick={() => setTransactions(p => p.filter(it => it.id !== t.id))} className="p-2.5 bg-white/5 rounded-xl hover:text-rose-400 transition-colors"><Trash2 className="w-5 h-5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredTransactions.length === 0 && (
                    <div className="py-20 text-center text-slate-600">Nenhum lançamento encontrado com este filtro.</div>
                  )}
                </div>
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
                      Registre seus gastos em segundos! Copie o prompt mestre abaixo e envie para sua IA de preferência. Após a confirmação dela, basta ditar seus gastos livremente. O resultado formatado deve ser colado no nosso Importador Inteligente ao lado.
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
                    
                    <button 
                      onClick={() => {
                        const topCats = categoryData.slice(0, 3).map(c => `${c.name}: ${formatCurrency(c.value)}`).join(', ');
                        const reportPrompt = `Analise estes dados financeiros do VerdeGrana e forneça um relatório detalhado com insights de economia e saúde financeira:
                        
Saldo Atual: ${formatCurrency(stats.total)}
Total Receitas (Mês): ${formatCurrency(stats.income)}
Total Despesas (Mês): ${formatCurrency(stats.expenses)}
Principais Categorias de Gasto: ${topCats || 'Sem dados'}
Número de transações: ${currentTransactions.length}`;
                        
                        navigator.clipboard.writeText(reportPrompt);
                        toast.success('Relatório gerado e copiado!');
                      }}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <TrendingUp className="w-5 h-5 text-emerald-400" /> Gerar Relatório para IA
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
                </Card>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="set" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl"><FolderSync /></div>
                    <h3 className="text-xl font-bold text-white">Sincronização Local</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">Conecte o VerdeGrana a uma pasta no seu computador para sincronização de arquivos em tempo real. Isso garante persistência absoluta.</p>
                  <button onClick={handleSelectDirectory} className="mt-auto flex items-center justify-center gap-3 py-5 bg-white/5 border border-white/10 rounded-2xl group hover:bg-white/10 transition-all text-white font-bold">
                    <FileJson className="group-hover:text-emerald-400 transition-colors" /> Configurar Folder Sync
                  </button>
                  <button onClick={exportData} className="flex items-center justify-center gap-3 py-4 bg-emerald-600/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold hover:bg-emerald-600 hover:text-white transition-all text-sm">
                    <Download className="w-4 h-4" /> Baixar Backup Local (.json)
                  </button>
                </Card>

                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl"><Trash2 /></div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Gerencial de Dados</h3>
                  </div>
                  <div className="space-y-4">
                    {wipeStep === 0 ? (
                      <button 
                        onClick={() => setWipeStep(1)} 
                        className="w-full flex items-center justify-between p-6 bg-white/5 rounded-2xl hover:bg-rose-500/10 hover:text-rose-400 transition-all border border-white/5"
                      >
                        <span className="font-bold text-sm">Limpar Memória do App</span>
                        <ChevronRight />
                      </button>
                    ) : wipeStep === 1 ? (
                      <div className="p-6 bg-rose-500/10 rounded-2xl space-y-4 border border-rose-500/20">
                         <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">⚠️ Tem certeza? Isso é irreversível.</p>
                         <div className="flex gap-2">
                           <button onClick={() => setWipeStep(2)} className="flex-1 py-3 bg-rose-600 rounded-xl font-bold text-sm">Sim, entendo</button>
                           <button onClick={() => setWipeStep(0)} className="flex-1 py-3 bg-white/10 rounded-xl font-bold text-sm">Cancelar</button>
                         </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-rose-500/20 rounded-2xl space-y-4 border border-rose-500/40">
                         <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">Digite 'DELETAR' para confirmar:</p>
                         <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-black/40 border border-rose-500/30 rounded-xl outline-none text-white font-mono"
                            value={wipeConfirmText}
                            onChange={e => setWipeConfirmText(e.target.value)}
                         />
                         <button 
                            onClick={async () => {
                              if (wipeConfirmText === 'DELETAR') {
                                if (dirHandle) {
                                  try {
                                    const fileHandle = await dirHandle.getFileHandle(FILE_NAME, { create: true });
                                    const writable = await fileHandle.createWritable();
                                    await writable.write("");
                                    await writable.close();
                                  } catch (e) { console.error(e); }
                                }
                                await clearState(dbInstance);
                                localStorage.clear();
                                window.location.reload();
                              }
                            }}
                            disabled={wipeConfirmText !== 'DELETAR'}
                            className="w-full py-4 bg-rose-600 disabled:opacity-50 rounded-xl font-bold uppercase text-xs"
                         >
                            CONFIRMAR DELEÇÃO TOTAL
                         </button>
                         <button onClick={() => setWipeStep(0)} className="w-full text-[10px] font-black text-slate-500 hover:text-white uppercase">Cancelar</button>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setBootStage('selector')} 
                      className="w-full flex items-center justify-between p-6 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5"
                    >
                      <span className="font-bold text-sm">Retornar ao Seletor de Modo</span>
                      <Monitor className="text-slate-500" />
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
                      <strong className="text-white">VerdeGrana: Finanças & Tecnologia.</strong> Este aplicativo é um projeto inovador idealizado por <strong className="text-white">Luiz Gustavo Andrade Santos</strong>, desenvolvido 100% com Inteligência Artificial. Une gestão contábil moderna à praticidade do processamento de linguagem natural.
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                       <a href="mailto:roogxbox@gmail.com" className="px-8 py-4 bg-emerald-600 rounded-2xl font-black text-white hover:bg-emerald-500 transition-all flex items-center gap-3">
                         <Mail className="w-6 h-6" /> roogxbox@gmail.com
                       </a>
                    </div>
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
                          Este aplicativo é um projeto experimental que combina as melhores práticas de **UI/UX** com o poder de processamento da **Inteligência Artificial**.
                        </p>
                        <div className="h-px w-20 bg-emerald-500 mx-auto opacity-30" />
                        <p className="text-lg text-slate-400 italic">
                          "Gerado por Luiz Gustavo Andrade Santos, app feito 100% com IA. Todos os direitos reservados ao Google AI Studio."
                        </p>
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
      </main>

      {/* MOBILE BOTTOM NAVBAR */}
      {mode === 'mobile' && bootStage === 'ready' && (
        <nav className="fixed bottom-0 left-0 right-0 glass backdrop-blur-3xl border-t border-white/5 flex items-center justify-around py-4 pb-safe z-50">
          <MobileNavItem icon={<Home />} active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <MobileNavItem icon={<ReceiptText />} active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 -mt-8 active:scale-90 transition-transform"
          >
            <Plus className="w-8 h-8 text-white" />
          </button>
          <MobileNavItem icon={<Bot />} active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
          <MobileNavItem icon={<Settings />} active={activeTab === 'settings' || activeTab === 'about'} onClick={() => setActiveTab('settings')} />
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

      <AnimatePresence>
        {isFolderPermissionMissing && bootStage === 'ready' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass max-w-sm w-full p-10 rounded-[3.5rem] text-center space-y-8 border border-emerald-500/30 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse" />
              <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl mx-auto flex items-center justify-center">
                <FolderSync className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white tracking-tighter">Bem-vindo de volta!</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Sua pasta de dados local foi detectada. Clique abaixo para reativar a sincronização automática e carregar seus dados.</p>
              </div>
              <div className="space-y-3 pt-4">
                <button 
                  onClick={handleRequestFolderPermission}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                >
                  <RefreshCw className="w-5 h-5" /> Sincronizar Diretório
                </button>
                <button 
                  onClick={() => setIsFolderPermissionMissing(false)}
                  className="w-full py-4 text-slate-500 text-xs font-bold hover:text-slate-300 transition-colors"
                >
                  Continuar sem sincronização
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DASHBOARD MODAL/OVERLAY ON BOOT IF DESIRED */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsAddModalOpen(false)} />
            <motion.div 
              initial={mode === 'mobile' ? { y: 100 } : { scale: 0.9, opacity: 0 }}
              animate={mode === 'mobile' ? { y: 0 } : { scale: 1, opacity: 1 }}
              exit={mode === 'mobile' ? { y: 600 } : { scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0f172a] md:glass p-8 rounded-t-[3rem] md:rounded-[3rem] border-t md:border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-white">{editingTransaction ? 'Editar' : 'Novo Lançamento'}</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X/></button>
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
                  type: rawType
                };

                if (editingTransaction) {
                  setTransactions(p => p.map(it => it.id === editingTransaction.id ? { ...it, ...data } : it));
                  toast.success('Lançamento atualizado!');
                } else {
                  setTransactions(p => [...p, { ...data, id: crypto.randomUUID() }]);
                  toast.success('Lançamento adicionado!');
                }
                setIsAddModalOpen(false);
                setEditingTransaction(null);
              }} className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Data</label>
                    <input name="date" required type="date" defaultValue={editingTransaction?.date || new Date().toISOString().split('T')[0]} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all font-mono" />
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
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-2">Tag / Categoria</label>
                    <select name="category" defaultValue={editingTransaction?.category || 'Outros'} className="w-full h-16 bg-white/5 border border-white/5 rounded-2xl px-6 text-white outline-none focus:border-emerald-500/50 transition-all appearance-none">
                      {categories.map(c => <option key={c.id} value={c.name} className="bg-slate-900">{c.name}</option>)}
                    </select>
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

function NavItem({ icon, active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl transition-all relative group",
        active ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20" : "text-slate-500 hover:text-emerald-400 hover:bg-white/5"
      )}
      title={label}
    >
      {icon}
      {active && <motion.div layoutId="nav-glow" className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-400 rounded-full" />}
    </button>
  );
}

function MobileNavItem({ icon, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl transition-colors",
        active ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500"
      )}
    >
      {icon}
    </button>
  );
}

function StatSmall({ label, value, color, prefix = '' }: any) {
  return (
    <div className="glass px-6 py-4 rounded-[1.5rem] border border-white/5 flex flex-col items-center sm:items-start min-w-[120px]">
      <span className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] mb-1">{label}</span>
      <span className={cn("text-lg font-black tracking-tighter truncate w-full flex", color)}>
        <span className="mr-0.5 opacity-60 font-medium">{prefix}</span>
        {formatCurrency(value)}
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
