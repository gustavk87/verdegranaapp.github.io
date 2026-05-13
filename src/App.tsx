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
  FileJson
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Line
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

type Tab = 'reports' | 'transactions' | 'ai' | 'categories' | 'settings';

// --- Database Instance ---
let dbInstance: any = null;

export default function App() {
  const [bootStage, setBootStage] = useState<'splash' | 'selector' | 'source' | 'ready'>('splash');
  const [mode, setMode] = useState<AppMode>('desktop');
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
  const [dateFilter, setDateFilter] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // --- Persistence Logic (File System) ---
  const FILE_NAME = 'verdegrana_db.json';

  const readFromFile = async (handle: FileSystemDirectoryHandle) => {
    try {
      // Use queryPermission to check if we can read
      // @ts-ignore
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        setIsFolderPermissionMissing(true);
        return false;
      }

      const fileHandle = await handle.getFileHandle(FILE_NAME, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      if (text) {
        const data = JSON.parse(text);
        if (data.transactions) setTransactions(data.transactions);
        if (data.categories) setCategories(data.categories);
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
      // Small toast for auto-sync feedback if not too noisy
      // toast.success('Backup sincronizado!', { duration: 1000 });
    } catch (e) {
      console.error('Falha ao gravar no arquivo:', e);
      setSyncStatus('error');
      setIsDirty(true); // Keep dirty to retry
    }
  };

  // --- Initial Boot & Persistence ---
  useEffect(() => {
    const boot = async () => {
      // Stage 1: Splash (2s)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      dbInstance = await initDB();
      const savedState = await getState(dbInstance);
      
      if (savedState) {
        if (savedState.transactions) setTransactions(savedState.transactions);
        if (savedState.categories) setCategories(savedState.categories);
        
        if (savedState.workspaceHandle) {
          setDirHandle(savedState.workspaceHandle);
          // Try to wake up handle
          // @ts-ignore
          const perm = await savedState.workspaceHandle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            await readFromFile(savedState.workspaceHandle);
          } else {
            setIsFolderPermissionMissing(true);
          }
        }

        if (savedState.mode) {
          setMode(savedState.mode);
          setBootStage('ready');
        } else {
          setBootStage('selector');
        }
      } else {
        setBootStage('selector');
      }
    };
    boot();
  }, []);

  // Sync state to IDB (Instant)
  useEffect(() => {
    if (dbInstance && bootStage === 'ready') {
      const stateToSave = { transactions, categories, mode, workspaceHandle: dirHandle || undefined };
      saveState(dbInstance, stateToSave);
      setIsDirty(true);
    }
  }, [transactions, categories, mode, dirHandle, bootStage]);

  // Debounced File System Sync
  useEffect(() => {
    if (!dirHandle || !isDirty || bootStage !== 'ready' || isFolderPermissionMissing) return;

    const timeout = setTimeout(async () => {
      // @ts-ignore
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        await writeToFile(dirHandle, { transactions, categories });
      } else {
        setIsFolderPermissionMissing(true);
      }
    }, 1000); // 1s debounce to avoid thrashing

    return () => clearTimeout(timeout);
  }, [transactions, categories, dirHandle, isDirty, bootStage, isFolderPermissionMissing]);

  // --- Handlers ---
  const handleRequestFolderPermission = async () => {
    if (!dirHandle) return;
    try {
      // @ts-ignore
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        setIsFolderPermissionMissing(false);
        await readFromFile(dirHandle);
        toast.success('Sincronização restaurada!');
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
      const success = await readFromFile(handle);
      if (success) {
        setBootStage('ready');
        toast.success('Pasta de dados sincronizada!');
      }
    } catch (e) {
      toast.error('Erro ao selecionar pasta.');
    }
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
      return (date.getMonth() + 1) === dateFilter.month && date.getFullYear() === dateFilter.year;
    });
  }, [transactions, dateFilter]);

  const stats = useMemo(() => {
    const income = currentTransactions.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
    const expenses = currentTransactions.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.value, 0);
    return { total: income - expenses, income, expenses };
  }, [currentTransactions]);

  const chartData = useMemo(() => {
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
  }, [transactions]);

  const categoryData = useMemo(() => {
    const expByCat: Record<string, number> = {};
    currentTransactions.filter(t => t.type === 'saída').forEach(t => {
      expByCat[t.category] = (expByCat[t.category] || 0) + t.value;
    });
    return Object.entries(expByCat).map(([name, value]) => ({ name, value }));
  }, [currentTransactions]);

  const filteredTransactions = useMemo(() => {
    return currentTransactions.filter(t => {
      return t.desc.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentTransactions, searchTerm]);

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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950">
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
      </div>
    );
  }
  // Mode Selector
  if (bootStage === 'selector') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6">
        <div className="max-w-2xl w-full space-y-12 text-center">
          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-white">Bem-vindo ao VerdeGrana</h2>
            <p className="text-slate-400">Escolha como deseja visualizar suas finanças</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => { setMode('desktop'); setBootStage('source'); }}
              className="glass p-10 rounded-[3rem] group hover:bg-emerald-500/10 transition-all border border-white/5 active:scale-95"
            >
              <Monitor className="w-16 h-16 mx-auto mb-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <h3 className="text-2xl font-bold text-white mb-2">💻 Modo Desktop</h3>
              <p className="text-sm text-slate-500">Otimizado para mouse e telas grandes</p>
            </button>
            
            <button 
              onClick={() => { setMode('mobile'); setBootStage('source'); }}
              className="glass p-10 rounded-[3rem] group hover:bg-emerald-500/10 transition-all border border-white/5 active:scale-95"
            >
              <Smartphone className="w-16 h-16 mx-auto mb-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <h3 className="text-2xl font-bold text-white mb-2">📱 Modo Mobile</h3>
              <p className="text-sm text-slate-500">Experiência touch-first fluida</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Source Selector
  if (bootStage === 'source') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full space-y-8 text-center glass p-12 rounded-[3.5rem]">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl mx-auto flex items-center justify-center">
            <FolderSync className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">Onde estão seus dados?</h2>
            <p className="text-slate-400 text-sm">Sincronize com uma pasta local para persistência real e backup automático.</p>
          </div>
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={handleSelectDirectory}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-3"
            >
              <FolderSync className="w-6 h-6" /> Selecionar Pasta de Dados
            </button>
            <button 
              onClick={skipFolderSync}
              className="w-full py-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-medium transition-all active:scale-95"
            >
              Usar apenas Navegador (Offline)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className={cn(
      "h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 flex",
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
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tighter">VerdeGrana <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-mono uppercase">Pro</span></h1>
            <div className="flex items-center gap-3">
              <p className="text-slate-500 text-sm font-medium">Balanço de</p>
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
            <StatSmall label="Saldo" value={stats.total} color="text-emerald-400" />
            <StatSmall label="Receitas" value={stats.income} color="text-emerald-500" prefix="+" />
            <StatSmall label="Despesas" value={stats.expenses} color="text-rose-500" prefix="-" />
          </div>
        </header>

        <section className="px-6 md:px-10 pb-10">
          <AnimatePresence mode="wait">
            {activeTab === 'reports' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="grid grid-cols-12 gap-6">
                {transactions.length === 0 ? (
                  <div className="col-span-12 py-32 text-center glass rounded-[3rem] border-dashed border-white/10">
                    <Leaf className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-slate-400">Nenhum dado encontrado</h3>
                    <p className="text-slate-600 mb-8">Use o Assistente IA ou adicione manualmente.</p>
                    <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-4 bg-emerald-600 rounded-2xl font-bold hover:scale-105 transition-all">Começar Agora</button>
                  </div>
                ) : (
                  <>
                    <Card className="col-span-12 lg:col-span-8 h-96 p-8">
                      <h3 className="font-bold text-lg mb-6">Fluxo de Caixa</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                          <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    <Card className="col-span-12 lg:col-span-4 h-96 p-8 relative overflow-hidden">
                      <h3 className="font-bold text-lg mb-6">Categorias</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%" cy="50%"
                            innerRadius={70} outerRadius={100}
                            paddingAngle={8} dataKey="value"
                          >
                            {categoryData.map((_, i) => <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-x-0 bottom-8 text-center pointer-events-none">
                        <p className="text-[10px] uppercase font-bold text-slate-500">Principais Gastos</p>
                      </div>
                    </Card>

                    {mode === 'desktop' && (
                      <Card className="col-span-12 p-8 h-80">
                        <h3 className="font-bold text-lg mb-6">Tendência de Gastos</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="name" stroke="#475569" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                            <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} dot={{ fill: '#f43f5e', r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Card>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'transactions' && (
              <motion.div key="tx" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center bg-white/5 p-4 rounded-[2rem] border border-white/5">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                    <input 
                      type="text" placeholder="Filtrar lançamentos..." 
                      className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-emerald-500/50 transition-all outline-none"
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button onClick={() => setIsAddModalOpen(true)} className="w-full md:w-auto h-14 px-8 bg-emerald-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors shadow-xl shadow-emerald-600/20">
                    <Plus className="w-6 h-6" /> Novo
                  </button>
                </div>

                <div className="glass rounded-[2.5rem] overflow-hidden border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                        <tr>
                          <th className="px-8 py-5">Data</th>
                          <th className="px-8 py-5">Descrição</th>
                          <th className="px-8 py-5">Categoria</th>
                          <th className="px-8 py-5">Valor</th>
                          <th className="px-8 py-5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredTransactions.map(t => (
                          <tr key={t.id} className="hover:bg-white/5 transition-all group">
                            <td className="px-8 py-6 text-sm text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-8 py-6 font-semibold text-white">{t.desc}</td>
                            <td className="px-8 py-6 text-xs">
                              <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/10 uppercase font-bold tracking-wider">{t.category}</span>
                            </td>
                            <td className={cn("px-8 py-6 font-black", t.type === 'entrada' ? "text-emerald-400" : "text-rose-500")}>
                              {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.value)}
                            </td>
                            <td className="px-8 py-6 text-right">
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
                    <div className="py-20 text-center text-slate-600">Nenhum lançamento para exibir.</div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div key="ai" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-10 flex flex-col items-center text-center gap-8 border-emerald-500/20">
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-[2.5rem] flex items-center justify-center animate-pulse">
                    <Bot className="w-12 h-12 text-emerald-400" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white">Assistente Mestre</h2>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">Capture extratos bagunçados, notas de áudio ou textos e transforme-os instantaneamente em dados blindados.</p>
                  </div>
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
                    className="w-full py-5 bg-emerald-600 rounded-3xl font-bold hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/30"
                  >
                    Gerar Master Prompt
                  </button>
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
                          setActiveTab('dashboard');
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
                        <button onClick={() => { setCategories(p => p.filter(c => c.id !== cat.id)); toast.info('Categoria removida'); }} className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
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
                  <p className="text-slate-400 text-sm leading-relaxed">Conecte o VerdeGrana a uma pasta no seu computador para sincronização de arquivos em tempo real (Experimental).</p>
                  <button onClick={handleSelectDirectory} className="mt-auto flex items-center justify-center gap-3 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] group hover:bg-white/10 transition-all text-white font-bold">
                    <FileJson className="group-hover:text-emerald-400 transition-colors" /> Configurar Folder Sync
                  </button>
                </Card>

                <Card className="p-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl"><LogOut /></div>
                    <h3 className="text-xl font-bold text-white">Sessão & Preferências</h3>
                  </div>
                  <div className="space-y-4">
                    <button 
                      onClick={() => setBootStage('selector')} 
                      className="w-full flex items-center justify-between p-6 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5"
                    >
                      <span className="font-bold">Alterar Modo de Visualização</span>
                      <ChevronRight className="text-slate-500" />
                    </button>
                    <button 
                      onClick={() => { if(confirm('Wipe total?')) { localStorage.clear(); location.reload(); } }}
                      className="w-full text-left p-6 text-rose-500 font-bold hover:underline"
                    >
                      Limpar Memória do App
                    </button>
                  </div>
                  <button onClick={exportData} className="mt-auto flex items-center justify-center gap-3 py-5 bg-emerald-600/10 border border-emerald-500/30 rounded-[1.5rem] text-emerald-400 font-bold hover:bg-emerald-600 hover:text-white transition-all">
                    <Download /> Baixar Backup Local
                  </button>
                </Card>
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
          {/* Main Action Button */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 -mt-10 active:scale-90 transition-transform"
          >
            <Plus className="w-8 h-8 text-white" />
          </button>
          <MobileNavItem icon={<Bot />} active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
          <MobileNavItem icon={<Settings />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      )}

      {/* FOLDER PERMISSION OVERLAY */}
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
