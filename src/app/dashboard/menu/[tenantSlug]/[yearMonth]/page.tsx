'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  UtensilsCrossed,
  Printer,
  Save,
  Loader2,
  Check,
  RefreshCw,
  Pencil,
  Salad,
  Apple,
  Coffee,
  Sun,
  Moon,
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { generateMonthlyMenu, organizeIntoWeeks } from '@/lib/menuGenerator';
import type { Tenant, Dish, DailyMeal, MonthlyMenu, DishCategory } from '@/lib/types';
import {
  BREAKFAST_FRUITS,
  JUICES,
  SOUPS,
  SUPPER_OPTIONS,
} from '@/lib/menuRules';

const DAY_NAMES_FULL = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTHS = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

type Params = Promise<{ tenantSlug: string; yearMonth: string }>;

function getTenantLogo(tenant: Tenant | null): string {
  if (!tenant) return '/logos/lares.jpg';
  if (tenant.logo_url) return tenant.logo_url;
  if (tenant.slug === 'vida-plena') return '/logos/vida-plena.png';
  return '/logos/lares.jpg';
}

// ============================================================================
// Creatable dropdown component for editing ANY menu item with free text input
// ============================================================================
function CreatableInlineDropdown({
  options,
  value,
  onSelect,
  onClose,
  placeholder,
}: {
  options: { id: string; name: string }[];
  value: string | null;
  onSelect: (value: string, id?: string) => void;
  onClose: () => void;
  placeholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(query.toLowerCase())
  );

  const trimmedQuery = query.trim();
  const exactMatch = options.find(
    (opt) => opt.name.toLowerCase() === trimmedQuery.toLowerCase()
  );

  const handleConfirm = (selectedValue: string, selectedId?: string) => {
    if (!selectedValue.trim()) {
      onClose();
      return;
    }
    onSelect(selectedValue.trim(), selectedId);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full z-50 text-[11px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center bg-white border-2 border-emerald-500 rounded p-1 shadow-xl">
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-slate-900 font-medium focus:outline-none text-[11px]"
          placeholder={placeholder ?? 'Digite ou selecione...'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose();
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (exactMatch) {
                handleConfirm(exactMatch.name, exactMatch.id);
              } else if (trimmedQuery) {
                handleConfirm(trimmedQuery);
              } else if (filteredOptions.length > 0) {
                handleConfirm(filteredOptions[0].name, filteredOptions[0].id);
              } else {
                onClose();
              }
            }
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-2xl z-50 py-1 text-[11px]">
          {trimmedQuery && !exactMatch && (
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1.5 border-b border-slate-100 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                handleConfirm(trimmedQuery);
              }}
            >
              <span className="text-xs">➕</span>
              <span>Adicionar "{trimmedQuery}"</span>
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <button
                key={`${opt.id}-${idx}`}
                type="button"
                className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer ${
                  value === opt.id || value === opt.name ? 'bg-emerald-50 text-emerald-800 font-bold' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleConfirm(opt.name, opt.id);
                }}
              >
                {opt.name}
              </button>
            ))
          ) : (
            !trimmedQuery && (
              <div className="px-3 py-2 text-slate-400 italic text-[10px]">
                Digite para buscar ou adicionar nova opção...
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main page component
// ============================================================================
export default function MenuEditorPage({ params }: { params: Params }) {
  const resolvedParams = use(params);
  const { tenantSlug, yearMonth } = resolvedParams;
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [days, setDays] = useState<DailyMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Field being edited: { date, field }
  const [editingCell, setEditingCell] = useState<{ date: string; field: keyof DailyMeal } | null>(null);

  const [year, month] = yearMonth.split('-').map(Number);
  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  // Load tenant + dishes + existing menus
  useEffect(() => {
    async function loadData() {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug)
        .single();

      if (!tenantData) {
        router.push('/dashboard');
        return;
      }
      setTenant(tenantData);

      // Fetch tenant + global dishes
      const { data: dishesData } = await supabase
        .from('dishes')
        .select('*')
        .or(`tenant_id.eq.${tenantData.id},tenant_id.is.null`)
        .order('name');
      setDishes(dishesData ?? []);

      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-31`;
      const { data: existingMenus } = await supabase
        .from('monthly_menus')
        .select('*, lunch_dish:dishes(*)')
        .eq('tenant_id', tenantData.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      const generated = generateMonthlyMenu(tenantData, dishesData ?? [], year, month);

      if (existingMenus && existingMenus.length > 0) {
        const merged = generated.map((day) => {
          const existing = existingMenus.find((m: MonthlyMenu) => m.date === day.date);
          if (existing) {
            return {
              ...day,
              lunchMain: existing.lunch_dish?.name ?? day.lunchMain,
              lunchMainDishId: existing.lunch_dish_id ?? day.lunchMainDishId,
              lunchSalad: existing.lunch_salad ?? day.lunchSalad,
              juice: existing.juice ?? day.juice,
              dessert: existing.dessert_override ?? day.dessert,
            };
          }
          return day;
        });
        setDays(merged);
      } else {
        setDays(generated);
      }
      setLoading(false);
    }
    loadData();
  }, [tenantSlug, yearMonth, year, month, router]);

  // Generic updater for any field of a daily meal, with auto-addition of custom typed options to dropdown & DB
  const updateDailyMealField = useCallback(
    (date: string, field: keyof DailyMeal, value: string, dishId?: string) => {
      const trimmedVal = value.trim();
      if (!trimmedVal) return;

      const FIELD_CATEGORY_MAP: Record<keyof DailyMeal, DishCategory> = {
        colacao: 'cafe',
        breakfast: 'cafe',
        breakfastDiabetic: 'cafe',
        breakfastPastoso: 'cafe',
        lunchMain: 'prato_principal',
        lunchSalad: 'salada',
        lunchSide: 'acompanhamento',
        juice: 'suco',
        dessert: 'sobremesa',
        lunchDiabetic: 'salada',
        lunchPastoso: 'acompanhamento',
        afternoonSnack: 'lanche',
        afternoonSnackDiabetic: 'lanche',
        dinner: 'jantar',
        dinnerDiabetic: 'jantar',
        supper: 'ceia',
        supperDiabetic: 'ceia',
        date: 'cafe',
        dayOfWeek: 'cafe',
        weekOfMonth: 'cafe',
        lunchMainDishId: 'prato_principal',
      };

      const category = FIELD_CATEGORY_MAP[field] || 'prato_principal';
      const existingDish = dishes.find(
        (d) => d.name.toLowerCase() === trimmedVal.toLowerCase()
      );

      let finalDishId = dishId ?? existingDish?.id;

      if (!existingDish && tenant) {
        const tempId = `custom-${Date.now()}`;
        const newDishObj: Dish = {
          id: tempId,
          tenant_id: tenant.id,
          category: category,
          name: trimmedVal,
          ingredients: null,
          created_at: new Date().toISOString(),
        };
        setDishes((prev) => [newDishObj, ...prev]);

        supabase
          .from('dishes')
          .insert({
            tenant_id: tenant.id,
            category: category,
            name: trimmedVal,
          })
          .select('*')
          .single()
          .then(({ data, error }) => {
            if (data && !error) {
              setDishes((prev) => prev.map((d) => (d.id === tempId ? data : d)));
              if (field === 'lunchMain') {
                setDays((prevDays) =>
                  prevDays.map((d) => (d.date === date ? { ...d, lunchMainDishId: data.id } : d))
                );
              }
            }
          });
      }

      setDays((prev) =>
        prev.map((day) => {
          if (day.date !== date) return day;

          const updated = { ...day, [field]: trimmedVal };
          if (field === 'lunchMain' && finalDishId) {
            updated.lunchMainDishId = finalDishId;
          }
          return updated;
        })
      );
      setEditingCell(null);
    },
    [dishes, tenant]
  );

  // Save to Supabase
  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);

    const upserts = days.map((day) => ({
      tenant_id: tenant.id,
      date: day.date,
      lunch_dish_id: day.lunchMainDishId,
      lunch_salad: day.lunchSalad,
      juice: day.juice,
      dessert_override: day.dessert,
      notes: null,
    }));

    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;

    await supabase
      .from('monthly_menus')
      .delete()
      .eq('tenant_id', tenant.id)
      .gte('date', startDate)
      .lte('date', endDate);

    await supabase.from('monthly_menus').insert(upserts);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Regenerate
  const handleRegenerate = () => {
    if (!tenant) return;
    const generated = generateMonthlyMenu(tenant, dishes, year, month);
    setDays(generated);
  };

  const weeks = organizeIntoWeeks(days);

  // Filter dishes by categories + fallbacks
  const getOptionsForField = (field: keyof DailyMeal): { id: string; name: string }[] => {
    switch (field) {
      case 'breakfast':
      case 'colacao':
      case 'breakfastDiabetic':
      case 'breakfastPastoso': {
        const dishFruits = dishes.filter((d) => d.category === 'cafe').map((d) => ({ id: d.name, name: d.name }));
        const defaultFruits = [
          'Mamão', 'Banana', 'Melão', 'Manga', 'Abacaxi', 'Laranja',
          'Pão de forma integral com ovo + Café com leite e adoçante',
          'Pão integral com queijo minas e manteiga + Café com leite e adoçante',
          'Mingau rotativo (aveia, tapioca, arroz, fubá) ou Vitamina',
          'Mingau de aveia ou Vitamina',
          'Mingau de tapioca ou Vitamina',
        ];
        const combined = [...dishFruits, ...defaultFruits.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'lunchSide': {
        const sideDishes = dishes.filter((d) => d.category === 'acompanhamento').map((d) => ({ id: d.name, name: d.name }));
        const defaults = ['Arroz/ feijão', 'Arroz/Feijão (opcional)', 'Arroz com cenoura picadinha e cozida/Feijão', 'Arroz com açafrão. Feijão caldo', 'Arroz/ tutu a mineira', 'Arroz colorido( pimentão colorido) feijão'];
        const combined = [...sideDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'lunchMain': {
        return dishes.filter((d) => d.category === 'prato_principal').map((d) => ({ id: d.id, name: d.name }));
      }
      case 'lunchSalad': {
        const saladDishes = dishes.filter((d) => d.category === 'salada').map((d) => ({ id: d.name, name: d.name }));
        const defaults = ['Salada de alface e tomate', 'Salada de repolho roxo, tomate', 'Alface e PEPINO', 'Agrião com Melão', 'Tabule', 'Pepino com Rúcula'];
        const combined = [...saladDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'juice': {
        const juiceDishes = dishes.filter((d) => d.category === 'suco').map((d) => ({ id: d.name, name: d.name }));
        const defaults = ['suco de manga', 'suco de abacaxi', 'Suco acerola', 'Suco goiaba', 'Suco de Uva', 'suco de maracujá'];
        const combined = [...juiceDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'dessert': {
        const dessertDishes = dishes.filter((d) => d.category === 'sobremesa').map((d) => ({ id: d.name, name: d.name }));
        const defaults = ['Mousse de Chocolate', 'Mousse de Morango', 'Mousse de Limão', 'Mousse de Maracujá', 'Gelatina', 'Fruta fresca', 'Banana Frita'];
        const combined = [...dessertDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'lunchDiabetic': {
        const saladDishes = dishes.filter((d) => d.category === 'salada').map((d) => ({ id: d.name, name: d.name }));
        const defaults = [
          'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.',
          'Salada crua à vontade + 1/2 porção de carboidrato',
        ];
        const combined = [...saladDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'lunchPastoso': {
        const sideDishes = dishes.filter((d) => d.category === 'acompanhamento').map((d) => ({ id: d.name, name: d.name }));
        const defaults = [
          'colocar módulo de fibras (1 colher de chá)',
          'Alimentos batidos no liquidificador + módulo de fibras',
        ];
        const combined = [...sideDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'afternoonSnack':
      case 'afternoonSnackDiabetic': {
        const snackDishes = dishes.filter((d) => d.category === 'lanche').map((d) => ({ id: d.name, name: d.name }));
        const defaults = [
          'Escolher 3 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.',
          'Pão francês/doce Café Com Leite.',
          'Empadão + Café com leite',
          'Tortinha de frango + Café com leite',
          'Pão FRANCÊS/ DOCE PATÊ SARDINHA Café com leite',
          'Batata doce, aipim ou banana da terra cozida com canela Café com Leite',
          'Bolo + Café com leite',
          'Pão e ovos mexidos; Café Com leite',
        ];
        const combined = [...snackDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'dinner':
      case 'dinnerDiabetic': {
        const dinnerDishes = dishes.filter((d) => d.category === 'jantar').map((d) => ({ id: d.name, name: d.name }));
        const defaults = [
          'Repetir o almoço, porém ½ porção de carboidratos ou caldo de legumes com módulo de fibras( 1 colher de chá)',
          'Sopa de macarrão com legumes e frango desfiado.',
          'Caldo de legumes.',
          'Caldo de inhame com carne moída.',
          'Caldo de legumes com frango',
          'Caldo de inhame com carne desfiada',
          'Caldo de feijão com temperos verdes',
          'Caldo verde',
          'Caldo de abóbora com carne moída',
        ];
        const combined = [...dinnerDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      case 'supper':
      case 'supperDiabetic': {
        const supperDishes = dishes.filter((d) => d.category === 'ceia').map((d) => ({ id: d.name, name: d.name }));
        const defaults = [
          'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.',
          'Mingau de aveia e banana',
          'Mingau de fubá',
          'Mingau de tapioca',
          'Mingau de aveia com canela',
          'Mingau doce de fubá',
          'Mingau de maizena',
          'Papa de milho com canela',
        ];
        const combined = [...supperDishes, ...defaults.map((f) => ({ id: f, name: f }))];
        return Array.from(new Map(combined.map((item) => [item.name, item])).values());
      }
      default:
        return [];
    }
  };

  if (loading || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          <p className="text-slate-600 font-body">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  const toggleEdit = (date: string, field: keyof DailyMeal) => {
    if (editingCell?.date === date && editingCell?.field === field) {
      setEditingCell(null);
    } else {
      setEditingCell({ date, field });
    }
  };

  const logoUrl = getTenantLogo(tenant);

  return (
    <div
      className="min-h-screen tenant-themed bg-slate-100 pb-12"
      style={{ '--tenant-color': tenant.primary_color } as React.CSSProperties}
    >
      {/* =================== SCREEN HEADER =================== */}
      <header className="no-print border-b border-border bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="cursor-pointer w-9 h-9 rounded-xl bg-surface-dim border border-border flex items-center justify-center hover:bg-surface-container transition-colors duration-200"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4 text-on-surface" />
            </button>
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt={tenant.name}
                className="h-9 w-auto object-contain rounded border border-slate-200"
              />
              <div>
                <h1 className="font-display text-sm font-bold text-on-surface leading-tight">
                  {tenant.name}
                </h1>
                <p className="text-xs text-on-surface-muted">{monthLabel}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              className="cursor-pointer hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-display font-medium text-on-surface-muted bg-surface-dim border border-border rounded-xl hover:bg-surface-container transition-colors duration-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer flex items-center gap-2 px-4 py-2 text-xs font-display font-semibold text-white rounded-xl shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: tenant.primary_color }}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
            </button>
            <button
              onClick={() => window.print()}
              className="cursor-pointer flex items-center gap-2 px-3.5 py-2 text-xs font-display font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors duration-200 shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir Cardápio</span>
            </button>
          </div>
        </div>
      </header>

      {/* Info Banner on screen */}
      <div className="no-print max-w-[1500px] mx-auto px-4 pt-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2 shadow-sm">
          <Pencil className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Edição interativa total:</strong> Clique em <em>qualquer</em> item do cardápio (frutas, proteína, acompanhamento, salada, suco, sobremesa, lanche, jantar, ceia) para abrir o dropdown de alteração.
          </span>
        </div>
      </div>

      {/* =================== MAIN DOCUMENT CONTENT =================== */}
      <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-10">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="space-y-8">
            {/* ========================================================================= */}
            {/* PAGE 1 OF WEEK: CAFÉ E ALMOÇO                                            */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-xl border border-slate-300 shadow-md p-4 overflow-hidden print-page-block">
              {/* Header Banner with Logos */}
              <div className="flex items-center justify-between border-b-2 border-slate-300 pb-3 mb-3">
                <div className="w-36 flex justify-start">
                  <img src={logoUrl} alt={tenant.name} className="h-16 w-auto object-contain" />
                </div>
                <div className="text-center">
                  <h2 className="font-display font-bold text-base sm:text-lg text-black uppercase tracking-wider">
                    {monthLabel} SEMANA {weekIdx + 1}
                  </h2>
                  <p className="font-body text-xs sm:text-sm text-slate-700 lowercase font-medium">
                    (café e almoço)
                  </p>
                </div>
                <div className="w-36 flex justify-end">
                  <img src={logoUrl} alt={tenant.name} className="h-16 w-auto object-contain" />
                </div>
              </div>

              {/* Table: Café e Almoço */}
              <div className="overflow-x-auto">
                <table className="menu-grid-table border-collapse w-full text-[11px] text-black">
                  <thead>
                    <tr className="bg-slate-200 text-black">
                      <th className="border border-slate-400 p-2 text-center font-bold text-xs uppercase w-32">
                        REFEIÇÕES
                      </th>
                      {week.map((day, dayIdx) => (
                        <th
                          key={dayIdx}
                          className="border border-slate-400 p-2 text-center font-bold text-xs uppercase"
                        >
                          {day ? (
                            <>
                              <div>{DAY_NAMES_FULL[dayIdx]}</div>
                              <div className="text-[11px] font-semibold">{format(parse(day.date, 'yyyy-MM-dd', new Date()), 'dd')}</div>
                            </>
                          ) : (
                            <div>{DAY_NAMES_SHORT[dayIdx]}</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: CAFÉ DA MANHÃ + COLAÇÃO */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#fef3c7] text-slate-900 w-32">
                        CAFÉ DA MANHÃ
                        <br />+<br />
                        COLAÇÃO
                      </td>
                      {week.map((day, dayIdx) => (
                        <td key={dayIdx} className="border border-slate-400 p-2 align-top bg-white">
                          {day && (
                            <div className="space-y-2">
                              {/* Main Breakfast & Fruit Dropdown */}
                              <div className="text-[11px] leading-tight">
                                <span
                                  className="editable-cell cursor-pointer hover:bg-amber-100 rounded px-0.5 inline-block"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'breakfast');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'breakfast' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('breakfast')}
                                        value={day.breakfast}
                                        onSelect={(val) => updateDailyMealField(day.date, 'breakfast', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione o café..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.breakfast || 'Pão francês/Doce com manteiga Café com leite'}
                                      <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>{' '}
                                <span
                                  className="editable-cell text-amber-700 font-bold px-0.5 py-0.2 rounded hover:bg-amber-100 transition-colors inline-block"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'colacao');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'colacao' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('colacao')}
                                        value={day.colacao}
                                        onSelect={(val) => updateDailyMealField(day.date, 'colacao', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione a fruta..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.colacao}.
                                      <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Diabéticos Note Dropdown */}
                              <div className="text-[10px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <span
                                  className="editable-cell hover:bg-red-100 rounded px-0.5 inline-block cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'breakfastDiabetic');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'breakfastDiabetic' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('breakfastDiabetic')}
                                        value={day.breakfastDiabetic}
                                        onSelect={(val) => updateDailyMealField(day.date, 'breakfastDiabetic', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.breakfastDiabetic}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Pastosos Note Dropdown */}
                              <div className="text-[10px] leading-tight text-red-900">
                                <span className="font-bold">PASTOSOS:</span>{' '}
                                <span
                                  className="editable-cell hover:bg-red-100 rounded px-0.5 inline-block cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'breakfastPastoso');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'breakfastPastoso' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('breakfastPastoso')}
                                        value={day.breakfastPastoso}
                                        onSelect={(val) => updateDailyMealField(day.date, 'breakfastPastoso', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.breakfastPastoso}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>{' '}
                                <span className="font-bold uppercase text-[9px] block mt-0.5">
                                  ( FAZER PARA LANCHE DA TARDE TAMBÉM)
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Row 2: ALMOÇO */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#d1fae5] text-emerald-950 w-32">
                        ALMOÇO
                      </td>
                      {week.map((day, dayIdx) => (
                        <td key={dayIdx} className="border border-slate-400 p-2 align-top bg-white">
                          {day && (
                            <div className="space-y-2">
                              <div className="text-[11px] leading-tight space-y-1">
                                {/* Editable Lunch Side */}
                                <div
                                  className="editable-cell p-0.5 rounded -mx-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'lunchSide');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'lunchSide' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchSide')}
                                        value={day.lunchSide}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchSide', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione acompanhamento..."
                                      />
                                    </div>
                                  ) : (
                                    <span className="cursor-pointer hover:bg-emerald-100 rounded px-0.5 transition-colors inline-block">
                                      {day.lunchSide};
                                      <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                    </span>
                                  )}
                                </div>

                                {/* Editable Protein */}
                                <div
                                  className="editable-cell p-0.5 rounded -mx-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'lunchMain');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'lunchMain' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchMain')}
                                        value={day.lunchMainDishId}
                                        onSelect={(val, dishId) => updateDailyMealField(day.date, 'lunchMain', val, dishId)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione a proteína..."
                                      />
                                    </div>
                                  ) : (
                                    <span className="font-bold uppercase text-black cursor-pointer hover:bg-amber-100 rounded px-0.5 transition-colors inline-block">
                                      {day.lunchMain}
                                      <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                    </span>
                                  )}
                                </div>

                                {/* Editable Salad */}
                                <div
                                  className="editable-cell p-0.5 rounded -mx-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'lunchSalad');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'lunchSalad' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchSalad')}
                                        value={day.lunchSalad}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchSalad', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione a salada..."
                                      />
                                    </div>
                                  ) : (
                                    <span className="cursor-pointer hover:bg-green-100 rounded px-0.5 transition-colors inline-block">
                                      {day.lunchSalad}
                                      <Salad className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                    </span>
                                  )}
                                </div>

                                {/* Editable Juice */}
                                <div
                                  className="editable-cell p-0.5 rounded -mx-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'juice');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'juice' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('juice')}
                                        value={day.juice}
                                        onSelect={(val) => updateDailyMealField(day.date, 'juice', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione o suco..."
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-slate-800 cursor-pointer hover:bg-yellow-100 rounded px-0.5 transition-colors inline-block">
                                      {day.juice}
                                      <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Diabéticos & Pastosos notes */}
                              <div className="pt-1 border-t border-slate-200 text-[9.5px] leading-tight text-slate-700 space-y-1">
                                <div
                                  className="editable-cell cursor-pointer hover:bg-red-50 rounded px-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'lunchDiabetic');
                                  }}
                                >
                                  <span className="font-bold text-red-800">Diabéticos:</span>{' '}
                                  {editingCell?.date === day.date && editingCell?.field === 'lunchDiabetic' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchDiabetic')}
                                        value={day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchDiabetic', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </div>
                                <div
                                  className="editable-cell cursor-pointer hover:bg-red-50 rounded px-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'lunchPastoso');
                                  }}
                                >
                                  <span className="font-bold text-red-900">Pastoso:</span>{' '}
                                  {editingCell?.date === day.date && editingCell?.field === 'lunchPastoso' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchPastoso')}
                                        value={day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchPastoso', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* PAGE 2 OF WEEK: LANCHE, JANTAR E CEIA                                     */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-xl border border-slate-300 shadow-md p-4 overflow-hidden print-page-block">
              {/* Header Banner with Logos */}
              <div className="flex items-center justify-between border-b-2 border-slate-300 pb-3 mb-3">
                <div className="w-36 flex justify-start">
                  <img src={logoUrl} alt={tenant.name} className="h-16 w-auto object-contain" />
                </div>
                <div className="text-center">
                  <p className="font-body text-sm sm:text-base text-black font-bold lowercase">
                    (lanche, jantar e ceia)
                  </p>
                </div>
                <div className="w-36 flex justify-end">
                  <img src={logoUrl} alt={tenant.name} className="h-16 w-auto object-contain" />
                </div>
              </div>

              {/* Table: Lanche, Jantar e Ceia */}
              <div className="overflow-x-auto">
                <table className="menu-grid-table border-collapse w-full text-[11px] text-black">
                  <thead>
                    <tr className="bg-slate-200 text-black">
                      <th className="border border-slate-400 p-2 text-center font-bold text-xs uppercase w-32">
                        REFEIÇÕES
                      </th>
                      {week.map((_, dayIdx) => (
                        <th
                          key={dayIdx}
                          className="border border-slate-400 p-2 text-center font-bold text-xs uppercase"
                        >
                          CONTINUAÇÃO
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: LANCHE DA TARDE */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#dbeafe] text-sky-950 w-32">
                        LANCHE DA TARDE
                      </td>
                      {week.map((day, dayIdx) => (
                        <td key={dayIdx} className="border border-slate-400 p-2 align-top bg-white">
                          {day && (
                            <div className="space-y-2">
                              {/* Editable Afternoon Snack */}
                              <div
                                className="editable-cell p-0.5 rounded -mx-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEdit(day.date, 'afternoonSnack');
                                }}
                              >
                                {editingCell?.date === day.date && editingCell?.field === 'afternoonSnack' ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('afternoonSnack')}
                                      value={day.afternoonSnack}
                                      onSelect={(val) => updateDailyMealField(day.date, 'afternoonSnack', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione o lanche..."
                                    />
                                  </div>
                                ) : (
                                  <p className="text-[11px] leading-tight cursor-pointer hover:bg-sky-100 rounded px-0.5 transition-colors">
                                    {day.afternoonSnack}
                                    <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                  </p>
                                )}
                              </div>

                              <div className="text-[9.5px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <span
                                  className="editable-cell hover:bg-sky-100 rounded px-0.5 inline-block cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'afternoonSnackDiabetic');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'afternoonSnackDiabetic' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('afternoonSnackDiabetic')}
                                        value={day.afternoonSnackDiabetic}
                                        onSelect={(val) => updateDailyMealField(day.date, 'afternoonSnackDiabetic', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.afternoonSnackDiabetic}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Row 2: JANTAR */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#fef3c7] text-amber-950 w-32">
                        JANTAR
                      </td>
                      {week.map((day, dayIdx) => (
                        <td key={dayIdx} className="border border-slate-400 p-2 align-top bg-white">
                          {day && (
                            <div className="space-y-2">
                              {/* Editable Dinner */}
                              <div
                                className="editable-cell p-0.5 rounded -mx-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEdit(day.date, 'dinner');
                                }}
                              >
                                {editingCell?.date === day.date && editingCell?.field === 'dinner' ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('dinner')}
                                      value={day.dinner}
                                      onSelect={(val) => updateDailyMealField(day.date, 'dinner', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione o jantar..."
                                    />
                                  </div>
                                ) : (
                                  <p className="text-[11px] leading-tight cursor-pointer hover:bg-amber-100 rounded px-0.5 transition-colors">
                                    {day.dinner}
                                    <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                  </p>
                                )}
                              </div>

                              <div className="text-[9.5px] leading-tight text-red-800">
                                <span
                                  className="editable-cell hover:bg-amber-100 rounded px-0.5 inline-block cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'dinnerDiabetic');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'dinnerDiabetic' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('dinnerDiabetic')}
                                        value={day.dinnerDiabetic}
                                        onSelect={(val) => updateDailyMealField(day.date, 'dinnerDiabetic', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.dinnerDiabetic}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Row 3: CEIA */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#fae8ff] text-purple-950 w-32">
                        CEIA
                      </td>
                      {week.map((day, dayIdx) => (
                        <td key={dayIdx} className="border border-slate-400 p-2 align-top bg-white">
                          {day && (
                            <div className="space-y-2">
                              {/* Editable Supper */}
                              <div
                                className="editable-cell p-0.5 rounded -mx-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEdit(day.date, 'supper');
                                }}
                              >
                                {editingCell?.date === day.date && editingCell?.field === 'supper' ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('supper')}
                                      value={day.supper}
                                      onSelect={(val) => updateDailyMealField(day.date, 'supper', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione a ceia..."
                                    />
                                  </div>
                                ) : (
                                  <p className="text-[11px] leading-tight cursor-pointer hover:bg-purple-100 rounded px-0.5 transition-colors">
                                    {day.supper}
                                    <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                  </p>
                                )}
                              </div>

                              <div className="text-[9.5px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <span
                                  className="editable-cell hover:bg-purple-100 rounded px-0.5 inline-block cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEdit(day.date, 'supperDiabetic');
                                  }}
                                >
                                  {editingCell?.date === day.date && editingCell?.field === 'supperDiabetic' ? (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('supperDiabetic')}
                                        value={day.supperDiabetic ?? 'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.'}
                                        onSelect={(val) => updateDailyMealField(day.date, 'supperDiabetic', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {day.supperDiabetic ?? 'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.'}
                                      <Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print" />
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {/* ========================================================================= */}
        {/* OBSERVAÇÕES E ANOTAÇÕES (AT THE END)                                      */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6 animate-fade-in print-page-block">
          <h3 className="font-display font-bold text-sm sm:text-base text-black uppercase tracking-wider mb-4 border-b-2 border-slate-400 pb-2">
            OBSERVAÇÕES E ANOTAÇÕES:
          </h3>

          <div className="space-y-3 text-xs sm:text-sm text-slate-900 leading-relaxed font-body">
            <p>
              <strong className="text-black">*Temperos:</strong> Zattar para feijão e carnes, coloral, açafrão, orégano, manjericão, chimichurri, alecrim, louro.
            </p>
            <p>
              <strong className="text-black">*Diabéticos</strong> usar adoçante, sempre ter folhas cruas no prato. <strong className="text-black">Pastosos</strong> usar módulo de fibra, junto com as principais refeições. Usar adoçante diet culinário para bolos. Mingau de aveia sem açúcar, com canela.
            </p>
            <p>
              <strong className="text-black">*Dietas pastosas:</strong> bater no liquidificador, frutas raspadas ou amassadas.
            </p>

            <div className="mt-6 pt-4 border-t border-slate-300 grid gap-2 sm:grid-cols-2 text-xs font-semibold text-slate-800">
              <p>1º E 3º DOMINGO DO MÊS, LANCHE DA TARDE: empadão</p>
              <p>2° E 4° DOMINGO DO MÊS: tortinha de frango.</p>
              <p>QUARTA: lanche da tarde: patê com pão</p>
              <p>QUINTA-FEIRA: banana, aipim, ou batata doce cozidos</p>
              <p>SEXTA-FEIRA LANCHE DA TARDE: bolo</p>
              <p>DOMINGO: mousse( CHOCOLATE, MORANGO, LIMÃO E MARACUJÁ)</p>
              <p>SÁBADO, SEGUNDA, QUARTA E SEXTA: gelatina</p>
              <p>TERÇA E QUINTA SOBREMESA: fruta.</p>
            </div>
          </div>

          {/* Footer signature line for print */}
          <div className="mt-12 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-500">
            <span>Smart Menu — Gerador de Cardápios Mensais</span>
            <span>Responsável Técnica: _________________________ CRN: _________</span>
          </div>
        </div>
      </main>
    </div>
  );
}
