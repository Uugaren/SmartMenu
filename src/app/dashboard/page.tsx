'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UtensilsCrossed,
  CalendarDays,
  Sparkles,
  Building2,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  BookOpen,
  FileText,
  CheckCircle2,
  Globe,
  Layers,
  Activity,
  Home,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tenant, Dish, DishCategory, MenuRule, RuleCategory } from '@/lib/types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DISH_CATEGORIES: { key: DishCategory; label: string }[] = [
  { key: 'prato_principal', label: 'Almoço — Prato Principal (Proteína)' },
  { key: 'salada', label: 'Almoço — Salada' },
  { key: 'acompanhamento', label: 'Almoço — Acompanhamento' },
  { key: 'cafe', label: 'Café da Manhã' },
  { key: 'lanche', label: 'Lanche da Tarde' },
  { key: 'jantar', label: 'Jantar (Sopas/Caldos)' },
  { key: 'ceia', label: 'Ceia (Mingaus)' },
  { key: 'sobremesa', label: 'Sobremesa' },
  { key: 'suco', label: 'Suco' },
];

const RULE_CATEGORIES: { key: RuleCategory; label: string }[] = [
  { key: 'cafe', label: 'Café da Manhã' },
  { key: 'lanche', label: 'Lanche da Tarde' },
  { key: 'jantar', label: 'Jantar' },
  { key: 'ceia', label: 'Ceia' },
  { key: 'sobremesa', label: 'Sobremesas' },
  { key: 'diabeticos', label: 'Dieta para Diabéticos' },
  { key: 'pastosos', label: 'Dieta Pastosa' },
  { key: 'geral', label: 'Temperos & Orientações Gerais' },
];

const DEFAULT_COLORS = ['#059669', '#0891B2', '#7c3aed', '#d97706', '#e11d48', '#2563eb'];

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'lares-id',
    name: 'Lares Casa de Repouso',
    slug: 'lares',
    logo_url: '/logos/lares.jpg',
    primary_color: '#059669',
    created_at: '2026-01-01',
  },
  {
    id: 'vida-plena-id',
    name: 'Casa de Repouso Vida Plena',
    slug: 'vida-plena',
    logo_url: '/logos/vida-plena.png',
    primary_color: '#0891B2',
    created_at: '2026-01-01',
  },
  {
    id: 'vovo-alda-id',
    name: 'Casa de Repouso Vovó Alda',
    slug: 'vovo-alda',
    logo_url: '/logos/vovo-alda.png',
    primary_color: '#0284c7',
    created_at: '2026-01-01',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'generate' | 'tenants' | 'dishes' | 'rules'>('generate');

  // Generator state - instant initialization
  const [tenants, setTenants] = useState<Tenant[]>(DEFAULT_TENANTS);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(DEFAULT_TENANTS[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Tenant management state
  const [tenantName, setTenantName] = useState('');
  const [tenantColor, setTenantColor] = useState('#059669');
  const [tenantLogoUrl, setTenantLogoUrl] = useState('');
  const [addingTenant, setAddingTenant] = useState(false);
  const [tenantSuccess, setTenantSuccess] = useState(false);

  // Dishes state
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishTenantId, setDishTenantId] = useState<string>('global'); // 'global' or tenant.id
  const [dishCategory, setDishCategory] = useState<DishCategory>('prato_principal');
  const [dishName, setDishName] = useState('');
  const [dishIngredients, setDishIngredients] = useState('');
  const [addingDish, setAddingDish] = useState(false);
  const [dishSuccess, setDishSuccess] = useState(false);

  // Rules state
  const [rules, setRules] = useState<MenuRule[]>([]);
  const [ruleTenantId, setRuleTenantId] = useState<string>('global'); // 'global' or tenant.id
  const [ruleCategory, setRuleCategory] = useState<RuleCategory>('geral');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [addingRule, setAddingRule] = useState(false);
  const [ruleSuccess, setRuleSuccess] = useState(false);

  // Keep-alive status
  const [pingStatus, setPingStatus] = useState<'idle' | 'pinging' | 'success' | 'error'>('idle');
  const [pingMessage, setPingMessage] = useState<string>('');

  // Initial load - parallel non-blocking background fetch
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
          setTimeout(() => resolve({ timeout: true }), 4000)
        );

        const fetchPromise = Promise.all([
          supabase.from('tenants').select('*').order('name'),
          supabase.from('dishes').select('*').order('created_at', { ascending: false }),
          supabase.from('menu_rules').select('*').order('created_at', { ascending: false }),
        ]);

        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if ('timeout' in result) {
          return;
        }

        const [{ data: tenantData }, { data: dishesData }, { data: rulesData }] = result;

        if (isCancelled) return;

        let list = tenantData ?? [];
        for (const defTenant of DEFAULT_TENANTS) {
          if (!list.find((t) => t.slug === defTenant.slug)) {
            list.push(defTenant);
          }
        }

        setTenants(list);
        if (list.length > 0) {
          setSelectedTenant((prev) => prev ?? list[0]);
        }
        if (dishesData) {
          setDishes(dishesData);
        }
        if (rulesData) {
          setRules(rulesData);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do painel:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }
    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Handle Keep-Alive Ping
  const handlePingKeepAlive = async () => {
    setPingStatus('pinging');
    try {
      const res = await fetch('/api/keep-alive');
      const data = await res.json();
      if (res.ok) {
        setPingStatus('success');
        setPingMessage(`Conexão ativa! ${data.message} (${new Date(data.timestamp).toLocaleTimeString()})`);
      } else {
        setPingStatus('error');
        setPingMessage(`Erro no ping: ${data.error}`);
      }
    } catch (err: unknown) {
      setPingStatus('error');
      setPingMessage(`Erro ao conectar: ${err instanceof Error ? err.message : 'Falha na requisição'}`);
    }
  };

  // Handle menu generation
  const handleGenerate = () => {
    if (!selectedTenant) return;
    setGenerating(true);
    const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    router.push(`/dashboard/menu/${selectedTenant.slug}/${yearMonth}`);
  };

  // Add Tenant
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) return;

    setAddingTenant(true);
    const slug = tenantName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const newTenantData = {
      name: tenantName.trim(),
      slug,
      primary_color: tenantColor,
      logo_url: tenantLogoUrl.trim() || null,
    };

    const { data, error } = await supabase
      .from('tenants')
      .insert(newTenantData)
      .select('*')
      .single();

    if (data && !error) {
      setTenants((prev) => [...prev, data]);
      if (!selectedTenant) setSelectedTenant(data);
      setTenantName('');
      setTenantLogoUrl('');
      setTenantSuccess(true);
      setTimeout(() => setTenantSuccess(false), 3000);
    }
    setAddingTenant(false);
  };

  // Delete Tenant
  const handleDeleteTenant = async (id: string) => {
    await supabase.from('tenants').delete().eq('id', id);
    setTenants((prev) => prev.filter((t) => t.id !== id));
    if (selectedTenant?.id === id) {
      const remaining = tenants.filter((t) => t.id !== id);
      setSelectedTenant(remaining[0] ?? null);
    }
  };

  // Add Dish
  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim()) return;

    setAddingDish(true);
    const newDishData = {
      tenant_id: dishTenantId === 'global' ? null : dishTenantId,
      category: dishCategory,
      name: dishName.trim(),
      ingredients: dishIngredients.trim() || null,
    };

    const { data, error } = await supabase
      .from('dishes')
      .insert(newDishData)
      .select('*')
      .single();

    if (data && !error) {
      setDishes((prev) => [data, ...prev]);
      setDishName('');
      setDishIngredients('');
      setDishSuccess(true);
      setTimeout(() => setDishSuccess(false), 3000);
    }
    setAddingDish(false);
  };

  // Delete Dish
  const handleDeleteDish = async (id: string) => {
    await supabase.from('dishes').delete().eq('id', id);
    setDishes((prev) => prev.filter((d) => d.id !== id));
  };

  // Add Rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleDescription.trim()) return;

    setAddingRule(true);
    const newRuleData = {
      tenant_id: ruleTenantId === 'global' ? null : ruleTenantId,
      category: ruleCategory,
      title: ruleTitle.trim(),
      description: ruleDescription.trim(),
    };

    const { data, error } = await supabase
      .from('menu_rules')
      .insert(newRuleData)
      .select('*')
      .single();

    if (data && !error) {
      setRules((prev) => [data, ...prev]);
      setRuleTitle('');
      setRuleDescription('');
      setRuleSuccess(true);
      setTimeout(() => setRuleSuccess(false), 3000);
    }
    setAddingRule(false);
  };

  // Delete Rule
  const handleDeleteRule = async (id: string) => {
    await supabase.from('menu_rules').delete().eq('id', id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          <p className="text-slate-600 font-body">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header */}
      <header className="no-print border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
                Smart Menu
              </h1>
              <p className="text-xs text-slate-500 font-body">
                Painel da Nutróloga & Gerador de Cardápios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePingKeepAlive}
              disabled={pingStatus === 'pinging'}
              className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-colors"
              title="Ping no Supabase para evitar pausa por inatividade"
            >
              <Activity className={`w-3.5 h-3.5 ${pingStatus === 'pinging' ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
              <span>Manter DB Ativo</span>
            </button>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hidden sm:block">
              Multi-tenant Active
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {pingMessage && (
          <div className={`mb-6 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
            pingStatus === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>{pingMessage}</span>
            </div>
            <button onClick={() => setPingMessage('')} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('generate')}
            className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === 'generate'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Gerar Cardápio Mensal
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === 'tenants'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Home className="w-4 h-4" />
            Casas de Repouso ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('dishes')}
            className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === 'dishes'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Gestão de Pratos
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm transition-all duration-200 ${
              activeTab === 'rules'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Regras de Cardápio
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: GERAR CARDÁPIO MENSAI                                              */}
        {/* ========================================================================= */}
        {activeTab === 'generate' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
                Gerar Cardápio Mensal Automático
              </h2>
              <p className="text-sm text-slate-600">
                Selecione o estabelecimento e o período para gerar o cardápio com base nos pratos e regras cadastradas.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Tenant Selector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900">
                    Casa de Repouso
                  </h3>
                </div>
                <div className="relative">
                  <select
                    id="tenant-selector"
                    value={selectedTenant?.id ?? ''}
                    onChange={(e) => {
                      const t = tenants.find((t) => t.id === e.target.value);
                      setSelectedTenant(t ?? null);
                    }}
                    className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm font-body text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
                {selectedTenant && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedTenant.primary_color }} />
                    Cor temática: {selectedTenant.primary_color}
                  </div>
                )}
              </div>

              {/* Month Selector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-cyan-700" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900">
                    Período
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      id="month-selector"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 pr-8 text-sm font-body text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select
                      id="year-selector"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 pr-8 text-sm font-body text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {MONTHS[selectedMonth - 1]} de {selectedYear}
                </p>
              </div>

              {/* Action Button */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-700" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900">
                    Gerar Cardápio
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  O cardápio mensal será montado combinando os pratos e regras do estabelecimento selecionado.
                </p>
                <button
                  id="generate-button"
                  onClick={handleGenerate}
                  disabled={!selectedTenant || generating}
                  className="w-full cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold py-3 px-4 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Gerar Cardápio Automático
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CASAS DE REPOUSO (TENANTS)                                        */}
        {/* ========================================================================= */}
        {activeTab === 'tenants' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
                Cadastrar Nova Casa de Repouso
              </h2>
              <p className="text-sm text-slate-600">
                Adicione novos estabelecimentos multi-tenant com cor temática e logo personalizada.
              </p>
            </div>

            {/* Form to Add Tenant */}
            <form onSubmit={handleAddTenant} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Cadastrar Casa de Repouso
              </h3>

              {tenantSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Casa de repouso cadastrada com sucesso!
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Tenant Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Casa de Repouso Recanto da Paz"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-body text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Primary Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cor Temática
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tenantColor}
                      onChange={(e) => setTenantColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                    />
                    <div className="flex items-center gap-1">
                      {DEFAULT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTenantColor(c)}
                          className={`w-6 h-6 rounded-full border border-slate-300 cursor-pointer ${tenantColor === c ? 'ring-2 ring-slate-900' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Logo URL */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL da Logo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: /logos/lares.jpg ou URL de imagem da logo"
                    value={tenantLogoUrl}
                    onChange={(e) => setTenantLogoUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-body text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingTenant || !tenantName.trim()}
                  className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold py-2.5 px-6 rounded-xl text-xs transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
                >
                  {addingTenant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cadastrar Casa de Repouso
                </button>
              </div>
            </form>

            {/* List of Tenants */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-600" />
                Casas de Repouso Cadastradas ({tenants.length})
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {tenants.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: t.primary_color }} />
                      <div>
                        <h4 className="font-display font-bold text-sm text-slate-900">{t.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">slug: {t.slug}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTenant(t.id)}
                      className="cursor-pointer text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Excluir Casa de Repouso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CADASTRO & GESTÃO DE PRATOS                                       */}
        {/* ========================================================================= */}
        {activeTab === 'dishes' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
                Cadastro e Gestão de Pratos por Refeição
              </h2>
              <p className="text-sm text-slate-600">
                Cadastre novos pratos vinculados a um estabelecimento específico ou aplicáveis a todas as casas de repouso.
              </p>
            </div>

            {/* Form to Add Dish */}
            <form onSubmit={handleAddDish} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Cadastrar Novo Prato
              </h3>

              {dishSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Prato cadastrado com sucesso no banco de dados!
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Tenant Scope */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estabelecimento / Alcance
                  </label>
                  <div className="relative">
                    <select
                      value={dishTenantId}
                      onChange={(e) => setDishTenantId(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-body text-slate-900 cursor-pointer focus:outline-none focus:border-emerald-600"
                    >
                      <option value="global">🌐 Todas as Casas (Global)</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          🏡 {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Meal / Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Refeição / Categoria
                  </label>
                  <div className="relative">
                    <select
                      value={dishCategory}
                      onChange={(e) => setDishCategory(e.target.value as DishCategory)}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-body text-slate-900 cursor-pointer focus:outline-none focus:border-emerald-600"
                    >
                      {DISH_CATEGORIES.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Dish Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Prato *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Escondidinho de Carne Seca"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-body text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Ingredients / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ingredientes / Detalhes (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carne seca desfiada, purê de mandioca, queijo gratinado"
                  value={dishIngredients}
                  onChange={(e) => setDishIngredients(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-body text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingDish || !dishName.trim()}
                  className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold py-2.5 px-6 rounded-xl text-xs transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
                >
                  {addingDish ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Salvar Prato no Banco
                </button>
              </div>
            </form>

            {/* List of Dishes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Pratos Cadastrados ({dishes.length})
              </h3>

              {dishes.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">Nenhum prato cadastrado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 font-bold">
                        <th className="p-3">Refeição / Categoria</th>
                        <th className="p-3">Nome do Prato</th>
                        <th className="p-3">Ingredientes</th>
                        <th className="p-3">Casa de Repouso</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dishes.map((dish) => {
                        const tenantObj = tenants.find((t) => t.id === dish.tenant_id);
                        const categoryObj = DISH_CATEGORIES.find((c) => c.key === dish.category);
                        return (
                          <tr key={dish.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-semibold text-emerald-800">
                              {categoryObj?.label ?? dish.category}
                            </td>
                            <td className="p-3 font-bold text-slate-900">{dish.name}</td>
                            <td className="p-3 text-slate-600 max-w-xs truncate">
                              {dish.ingredients || '-'}
                            </td>
                            <td className="p-3">
                              {tenantObj ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  🏡 {tenantObj.name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                  🌐 Todas as Casas
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteDish(dish.id)}
                                className="cursor-pointer text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Excluir Prato"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REGRAS DE CARDÁPIO & CLÍNICAS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'rules' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
                Regras de Cardápio e Orientações Clínicas
              </h2>
              <p className="text-sm text-slate-600">
                Adicione regras de nutrição que servem para orientar a geração dos cardápios (diabéticos, pastosos, temperos, sobremesas).
              </p>
            </div>

            {/* Form to Add Rule */}
            <form onSubmit={handleAddRule} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Cadastrar Nova Regra / Orientação
              </h3>

              {ruleSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Regra cadastrada com sucesso!
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Tenant Scope */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estabelecimento / Alcance
                  </label>
                  <div className="relative">
                    <select
                      value={ruleTenantId}
                      onChange={(e) => setRuleTenantId(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-body text-slate-900 cursor-pointer focus:outline-none focus:border-emerald-600"
                    >
                      <option value="global">🌐 Todas as Casas (Global)</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          🏡 {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Rule Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoria da Regra
                  </label>
                  <div className="relative">
                    <select
                      value={ruleCategory}
                      onChange={(e) => setRuleCategory(e.target.value as RuleCategory)}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-body text-slate-900 cursor-pointer focus:outline-none focus:border-emerald-600"
                    >
                      {RULE_CATEGORIES.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Rule Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Título da Regra *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dieta para Diabéticos no Lanche"
                    value={ruleTitle}
                    onChange={(e) => setRuleTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-body text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição / Instruções da Regra *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Alternar entre queijo minas com pão integral ou banana cozida com canela."
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-body text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingRule || !ruleTitle.trim() || !ruleDescription.trim()}
                  className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold py-2.5 px-6 rounded-xl text-xs transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
                >
                  {addingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Salvar Regra no Banco
                </button>
              </div>
            </form>

            {/* List of Rules */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Regras Cadastradas ({rules.length})
              </h3>

              {rules.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">Nenhuma regra personalizada cadastrada ainda.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {rules.map((rule) => {
                    const tenantObj = tenants.find((t) => t.id === rule.tenant_id);
                    const categoryObj = RULE_CATEGORIES.find((c) => c.key === rule.category);
                    return (
                      <div key={rule.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {categoryObj?.label ?? rule.category}
                            </span>
                            {tenantObj ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                🏡 {tenantObj.name}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                                🌐 Todas as Casas
                              </span>
                            )}
                          </div>
                          <h4 className="font-display font-bold text-sm text-slate-900 mb-1">
                            {rule.title}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {rule.description}
                          </p>
                        </div>
                        <div className="flex justify-end mt-4 pt-2 border-t border-slate-200">
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="cursor-pointer text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir Regra
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
