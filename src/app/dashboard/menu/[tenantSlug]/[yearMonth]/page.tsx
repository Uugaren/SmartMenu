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
  GripVertical,
  ArrowLeftRight,
  Sparkles,
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
  if (tenant.slug === 'vovo-alda') return '/logos/vovo-alda.png';
  return '/logos/lares.jpg';
}

function getFormattedDayName(dateStr: string): string {
  try {
    const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
    const dayOfWeek = parsedDate.getDay();
    const dayName = DAY_NAMES_FULL[dayOfWeek];
    const dayNum = format(parsedDate, 'dd/MM');
    return `${dayName} (${dayNum})`;
  } catch {
    return dateStr;
  }
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
// Draggable Cell wrapper for drag and drop item swap
// ============================================================================
function DraggableCell({
  date,
  field,
  value,
  isEditing,
  isDragging,
  isDropTarget,
  onToggleEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  editComponent,
  children,
  className = '',
}: {
  date: string;
  field: keyof DailyMeal;
  value: string;
  isEditing: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggleEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  editComponent: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (isEditing) {
    return <div onClick={(e) => e.stopPropagation()}>{editComponent}</div>;
  }

  return (
    <div
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => {
        e.stopPropagation();
        onToggleEdit();
      }}
      className={`group relative inline-flex items-center gap-1 rounded px-1 py-0.5 transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
        isDragging
          ? 'opacity-30 border-2 border-dashed border-emerald-600 bg-emerald-100 scale-95 shadow-inner'
          : isDropTarget
          ? 'bg-amber-200 ring-2 ring-amber-500 scale-[1.03] shadow-md z-20 font-bold border border-amber-600'
          : 'hover:bg-amber-100/90 hover:shadow-xs'
      } ${className}`}
      title="Clique para editar ou arraste para trocar de lugar com outro prato/refeição"
    >
      <GripVertical className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 no-print" />
      <span className="truncate">{children}</span>
      <Pencil className="w-2 h-2 text-slate-400 opacity-0 group-hover:opacity-70 transition-opacity shrink-0 no-print" />
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

  // Drag & drop state
  const [dragItem, setDragItem] = useState<{ date: string; field: keyof DailyMeal; value: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; field: keyof DailyMeal } | null>(null);
  const [swapToast, setSwapToast] = useState<{ title: string; message: string } | null>(null);

  const [year, month] = yearMonth.split('-').map(Number);
  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  const DEFAULT_TENANTS_MAP: Record<string, Tenant> = {
    lares: {
      id: 'lares-id',
      name: 'Lares Casa de Repouso',
      slug: 'lares',
      logo_url: '/logos/lares.jpg',
      primary_color: '#059669',
      created_at: '2026-01-01',
    },
    'vida-plena': {
      id: 'vida-plena-id',
      name: 'Casa de Repouso Vida Plena',
      slug: 'vida-plena',
      logo_url: '/logos/vida-plena.png',
      primary_color: '#0891B2',
      created_at: '2026-01-01',
    },
    'vovo-alda': {
      id: 'vovo-alda-id',
      name: 'Casa de Repouso Vovó Alda',
      slug: 'vovo-alda',
      logo_url: '/logos/vovo-alda.png',
      primary_color: '#0284c7',
      created_at: '2026-01-01',
    },
  };

  // Load tenant + dishes + existing menus
  useEffect(() => {
    async function loadData() {
      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', tenantSlug)
          .maybeSingle();

        let resolvedTenant: Tenant | null = tenantData ?? null;

        if (!resolvedTenant && DEFAULT_TENANTS_MAP[tenantSlug]) {
          resolvedTenant = DEFAULT_TENANTS_MAP[tenantSlug];
          supabase
            .from('tenants')
            .insert({
              name: resolvedTenant.name,
              slug: resolvedTenant.slug,
              primary_color: resolvedTenant.primary_color,
              logo_url: resolvedTenant.logo_url,
            })
            .then(() => {});
        }

        if (!resolvedTenant) {
          resolvedTenant = {
            id: `tenant-${tenantSlug}`,
            name: tenantSlug.replace(/-/g, ' ').toUpperCase(),
            slug: tenantSlug,
            logo_url: '/logos/lares.jpg',
            primary_color: '#059669',
            created_at: new Date().toISOString(),
          };
        }

        setTenant(resolvedTenant);

        // Fetch tenant + global dishes
        const { data: dishesData } = await supabase
          .from('dishes')
          .select('*')
          .or(`tenant_id.eq.${resolvedTenant.id},tenant_id.is.null`)
          .order('name');
        setDishes(dishesData ?? []);

        const startDate = `${yearMonth}-01`;
        const endDate = `${yearMonth}-31`;
        const { data: existingMenus } = await supabase
          .from('monthly_menus')
          .select('*, lunch_dish:dishes(*)')
          .eq('tenant_id', resolvedTenant.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date');

        const generated = generateMonthlyMenu(resolvedTenant, dishesData ?? [], year, month);

        if (existingMenus && existingMenus.length > 0) {
          const merged = generated.map((day) => {
            const existing = existingMenus.find((m: MonthlyMenu) => m.date === day.date);
            if (existing) {
              const mealData = (existing.meal_data || {}) as Partial<DailyMeal>;
              return {
                ...day,
                lunchMain: existing.lunch_dish?.name ?? mealData.lunchMain ?? day.lunchMain,
                lunchMainDishId: existing.lunch_dish_id ?? mealData.lunchMainDishId ?? day.lunchMainDishId,
                lunchSalad: existing.lunch_salad ?? mealData.lunchSalad ?? day.lunchSalad,
                juice: existing.juice ?? mealData.juice ?? day.juice,
                dessert: existing.dessert_override ?? mealData.dessert ?? day.dessert,
                breakfast: mealData.breakfast ?? day.breakfast,
                breakfastDiabetic: mealData.breakfastDiabetic ?? day.breakfastDiabetic,
                breakfastPastoso: mealData.breakfastPastoso ?? day.breakfastPastoso,
                colacao: mealData.colacao ?? day.colacao,
                lunchSide: mealData.lunchSide ?? day.lunchSide,
                lunchDiabetic: mealData.lunchDiabetic ?? day.lunchDiabetic,
                lunchPastoso: mealData.lunchPastoso ?? day.lunchPastoso,
                afternoonSnack: mealData.afternoonSnack ?? day.afternoonSnack,
                afternoonSnackDiabetic: mealData.afternoonSnackDiabetic ?? day.afternoonSnackDiabetic,
                dinner: mealData.dinner ?? day.dinner,
                dinnerDiabetic: mealData.dinnerDiabetic ?? day.dinnerDiabetic,
                supper: mealData.supper ?? day.supper,
                supperDiabetic: mealData.supperDiabetic ?? day.supperDiabetic,
              };
            }
            return day;
          });
          setDays(merged);
        } else {
          setDays(generated);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do cardápio:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tenantSlug, yearMonth, year, month, router]);

  // Generic updater for any field of a daily meal
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

  // Drag and Drop event handlers
  const handleDragStart = useCallback(
    (date: string, field: keyof DailyMeal, value: string, e: React.DragEvent) => {
      setDragItem({ date, field, value });
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify({ date, field, value }));
        e.dataTransfer.effectAllowed = 'move';
      } catch {
        // ignore
      }
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (date: string, field: keyof DailyMeal, e: React.DragEvent) => {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'move';
      } catch {
        // ignore
      }
      setDropTarget((prev) => {
        if (prev?.date === date && prev?.field === field) return prev;
        return { date, field };
      });
    },
    []
  );

  const handleDragLeave = useCallback(
    (date: string, field: keyof DailyMeal, e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget((prev) => {
        if (prev?.date === date && prev?.field === field) return null;
        return prev;
      });
    },
    []
  );

  const handleDrop = useCallback(
    (targetDate: string, targetField: keyof DailyMeal, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let source = dragItem;
      if (!source) {
        try {
          const dataStr = e.dataTransfer.getData('text/plain');
          if (dataStr) {
            source = JSON.parse(dataStr);
          }
        } catch {
          // ignore
        }
      }

      if (source && (source.date !== targetDate || source.field !== targetField)) {
        const sourceDate = source.date;
        const sourceField = source.field;

        const sourceDay = days.find((d) => d.date === sourceDate);
        const targetDay = days.find((d) => d.date === targetDate);

        if (sourceDay && targetDay) {
          const sourceValue = (sourceDay[sourceField] as string) || '';
          const targetValue = (targetDay[targetField] as string) || '';

          const sourceDishId = sourceDay.lunchMainDishId;
          const targetDishId = targetDay.lunchMainDishId;

          setDays((prevDays) =>
            prevDays.map((day) => {
              if (day.date === sourceDate && day.date === targetDate) {
                const updated = {
                  ...day,
                  [sourceField]: targetValue,
                  [targetField]: sourceValue,
                };
                if (sourceField === 'lunchMain') updated.lunchMainDishId = targetDishId;
                if (targetField === 'lunchMain') updated.lunchMainDishId = sourceDishId;
                return updated;
              }
              if (day.date === sourceDate) {
                const updated = { ...day, [sourceField]: targetValue };
                if (sourceField === 'lunchMain') {
                  updated.lunchMainDishId = targetField === 'lunchMain' ? targetDishId : null;
                }
                return updated;
              }
              if (day.date === targetDate) {
                const updated = { ...day, [targetField]: sourceValue };
                if (targetField === 'lunchMain') {
                  updated.lunchMainDishId = sourceField === 'lunchMain' ? sourceDishId : null;
                }
                return updated;
              }
              return day;
            })
          );

          const sourceDayLabel = getFormattedDayName(sourceDate);
          const targetDayLabel = getFormattedDayName(targetDate);

          setSwapToast({
            title: 'Pratos trocados de lugar! 🔄',
            message: `"${sourceValue}" [${sourceDayLabel}] ↔ "${targetValue}" [${targetDayLabel}]`,
          });
          setTimeout(() => setSwapToast(null), 4000);
        }
      }

      setDragItem(null);
      setDropTarget(null);
    },
    [dragItem, days]
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
      meal_data: {
        breakfast: day.breakfast,
        breakfastDiabetic: day.breakfastDiabetic,
        breakfastPastoso: day.breakfastPastoso,
        colacao: day.colacao,
        lunchMain: day.lunchMain,
        lunchMainDishId: day.lunchMainDishId,
        lunchSalad: day.lunchSalad,
        lunchSide: day.lunchSide,
        juice: day.juice,
        dessert: day.dessert,
        lunchDiabetic: day.lunchDiabetic,
        lunchPastoso: day.lunchPastoso,
        afternoonSnack: day.afternoonSnack,
        afternoonSnackDiabetic: day.afternoonSnackDiabetic,
        dinner: day.dinner,
        dinnerDiabetic: day.dinnerDiabetic,
        supper: day.supper,
        supperDiabetic: day.supperDiabetic,
      },
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
      className="min-h-screen tenant-themed bg-slate-100 pb-12 relative"
      style={{ '--tenant-color': tenant.primary_color } as React.CSSProperties}
    >
      {/* Floating toast notification for swap feedback */}
      {swapToast && (
        <div className="no-print fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-slide-up flex items-center gap-3 max-w-md">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-emerald-400">{swapToast.title}</h4>
            <p className="text-xs text-slate-200 mt-0.5">{swapToast.message}</p>
          </div>
        </div>
      )}

      {/* Floating active drag indicator */}
      {dragItem && (
        <div className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-amber-300 animate-pulse flex items-center gap-2 pointer-events-none">
          <GripVertical className="w-4 h-4" />
          <span>Solte sobre outro prato/dia para trocar de lugar com "{dragItem.value}"</span>
        </div>
      )}

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
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Drag & Drop Interativo:</strong> Arraste e solte qualquer item do cardápio (ex: <em>Filé Empanado na Segunda ↔ Bife a Cavalo na Quarta</em>) para trocar de lugar. Clique para editar o texto.
            </span>
          </div>
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
                              <div className="text-[11px] leading-tight flex flex-wrap items-center gap-1">
                                <DraggableCell
                                  date={day.date}
                                  field="breakfast"
                                  value={day.breakfast || 'Pão francês/Doce com manteiga Café com leite'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'breakfast'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'breakfast'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'breakfast'}
                                  onToggleEdit={() => toggleEdit(day.date, 'breakfast')}
                                  onDragStart={(e) => handleDragStart(day.date, 'breakfast', day.breakfast || 'Pão francês/Doce com manteiga Café com leite', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'breakfast', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'breakfast', e)}
                                  onDrop={(e) => handleDrop(day.date, 'breakfast', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('breakfast')}
                                      value={day.breakfast}
                                      onSelect={(val) => updateDailyMealField(day.date, 'breakfast', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione o café..."
                                    />
                                  }
                                >
                                  {day.breakfast || 'Pão francês/Doce com manteiga Café com leite'}
                                </DraggableCell>

                                <DraggableCell
                                  date={day.date}
                                  field="colacao"
                                  value={day.colacao}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'colacao'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'colacao'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'colacao'}
                                  onToggleEdit={() => toggleEdit(day.date, 'colacao')}
                                  onDragStart={(e) => handleDragStart(day.date, 'colacao', day.colacao, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'colacao', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'colacao', e)}
                                  onDrop={(e) => handleDrop(day.date, 'colacao', e)}
                                  className="text-amber-700 font-bold"
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('colacao')}
                                      value={day.colacao}
                                      onSelect={(val) => updateDailyMealField(day.date, 'colacao', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione a fruta..."
                                    />
                                  }
                                >
                                  {day.colacao}.
                                </DraggableCell>
                              </div>

                              {/* Diabéticos Note Dropdown */}
                              <div className="text-[10px] leading-tight text-red-800 flex items-center gap-1">
                                <span className="font-bold shrink-0">Diabéticos:</span>
                                <DraggableCell
                                  date={day.date}
                                  field="breakfastDiabetic"
                                  value={day.breakfastDiabetic}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'breakfastDiabetic'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'breakfastDiabetic'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'breakfastDiabetic'}
                                  onToggleEdit={() => toggleEdit(day.date, 'breakfastDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'breakfastDiabetic', day.breakfastDiabetic, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'breakfastDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'breakfastDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'breakfastDiabetic', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('breakfastDiabetic')}
                                      value={day.breakfastDiabetic}
                                      onSelect={(val) => updateDailyMealField(day.date, 'breakfastDiabetic', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione..."
                                    />
                                  }
                                >
                                  {day.breakfastDiabetic}
                                </DraggableCell>
                              </div>

                              {/* Pastosos Note Dropdown */}
                              <div className="text-[10px] leading-tight text-red-900">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold shrink-0">PASTOSOS:</span>
                                  <DraggableCell
                                    date={day.date}
                                    field="breakfastPastoso"
                                    value={day.breakfastPastoso}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'breakfastPastoso'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'breakfastPastoso'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'breakfastPastoso'}
                                    onToggleEdit={() => toggleEdit(day.date, 'breakfastPastoso')}
                                    onDragStart={(e) => handleDragStart(day.date, 'breakfastPastoso', day.breakfastPastoso, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'breakfastPastoso', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'breakfastPastoso', e)}
                                    onDrop={(e) => handleDrop(day.date, 'breakfastPastoso', e)}
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('breakfastPastoso')}
                                        value={day.breakfastPastoso}
                                        onSelect={(val) => updateDailyMealField(day.date, 'breakfastPastoso', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    }
                                  >
                                    {day.breakfastPastoso}
                                  </DraggableCell>
                                </div>
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
                                <div>
                                  <DraggableCell
                                    date={day.date}
                                    field="lunchSide"
                                    value={day.lunchSide}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchSide'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'lunchSide'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'lunchSide'}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchSide')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchSide', day.lunchSide, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchSide', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchSide', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchSide', e)}
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchSide')}
                                        value={day.lunchSide}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchSide', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione acompanhamento..."
                                      />
                                    }
                                  >
                                    {day.lunchSide};
                                  </DraggableCell>
                                </div>

                                {/* Editable Protein (Main Dish e.g. Filé Empanado / Bife a Cavalo) */}
                                <div>
                                  <DraggableCell
                                    date={day.date}
                                    field="lunchMain"
                                    value={day.lunchMain}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchMain'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'lunchMain'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'lunchMain'}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchMain')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchMain', day.lunchMain, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchMain', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchMain', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchMain', e)}
                                    className="font-bold uppercase text-black"
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchMain')}
                                        value={day.lunchMainDishId}
                                        onSelect={(val, dishId) => updateDailyMealField(day.date, 'lunchMain', val, dishId)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione a proteína..."
                                      />
                                    }
                                  >
                                    {day.lunchMain}
                                  </DraggableCell>
                                </div>

                                {/* Editable Salad */}
                                <div>
                                  <DraggableCell
                                    date={day.date}
                                    field="lunchSalad"
                                    value={day.lunchSalad}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchSalad'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'lunchSalad'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'lunchSalad'}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchSalad')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchSalad', day.lunchSalad, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchSalad', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchSalad', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchSalad', e)}
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchSalad')}
                                        value={day.lunchSalad}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchSalad', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione a salada..."
                                      />
                                    }
                                  >
                                    {day.lunchSalad}
                                    <Salad className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print" />
                                  </DraggableCell>
                                </div>

                                {/* Editable Juice */}
                                <div>
                                  <DraggableCell
                                    date={day.date}
                                    field="juice"
                                    value={day.juice}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'juice'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'juice'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'juice'}
                                    onToggleEdit={() => toggleEdit(day.date, 'juice')}
                                    onDragStart={(e) => handleDragStart(day.date, 'juice', day.juice, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'juice', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'juice', e)}
                                    onDrop={(e) => handleDrop(day.date, 'juice', e)}
                                    className="text-slate-800"
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('juice')}
                                        value={day.juice}
                                        onSelect={(val) => updateDailyMealField(day.date, 'juice', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione o suco..."
                                      />
                                    }
                                  >
                                    {day.juice}
                                  </DraggableCell>
                                </div>
                              </div>

                              {/* Diabéticos & Pastosos notes */}
                              <div className="pt-1 border-t border-slate-200 text-[9.5px] leading-tight text-slate-700 space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-red-800 shrink-0">Diabéticos:</span>
                                  <DraggableCell
                                    date={day.date}
                                    field="lunchDiabetic"
                                    value={day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchDiabetic'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'lunchDiabetic'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'lunchDiabetic'}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchDiabetic')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchDiabetic', day.lunchDiabetic ?? 'Colocar mais folhas cruas...', e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchDiabetic', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchDiabetic', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchDiabetic', e)}
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchDiabetic')}
                                        value={day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchDiabetic', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    }
                                  >
                                    {day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                  </DraggableCell>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-red-900 shrink-0">Pastoso:</span>
                                  <DraggableCell
                                    date={day.date}
                                    field="lunchPastoso"
                                    value={day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchPastoso'}
                                    isDragging={dragItem?.date === day.date && dragItem?.field === 'lunchPastoso'}
                                    isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'lunchPastoso'}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchPastoso')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchPastoso', day.lunchPastoso ?? 'colocar módulo...', e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchPastoso', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchPastoso', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchPastoso', e)}
                                    editComponent={
                                      <CreatableInlineDropdown
                                        options={getOptionsForField('lunchPastoso')}
                                        value={day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
                                        onSelect={(val) => updateDailyMealField(day.date, 'lunchPastoso', val)}
                                        onClose={() => setEditingCell(null)}
                                        placeholder="Digite ou selecione..."
                                      />
                                    }
                                  >
                                    {day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
                                  </DraggableCell>
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
                              <div>
                                <DraggableCell
                                  date={day.date}
                                  field="afternoonSnack"
                                  value={day.afternoonSnack}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'afternoonSnack'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'afternoonSnack'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'afternoonSnack'}
                                  onToggleEdit={() => toggleEdit(day.date, 'afternoonSnack')}
                                  onDragStart={(e) => handleDragStart(day.date, 'afternoonSnack', day.afternoonSnack, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'afternoonSnack', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'afternoonSnack', e)}
                                  onDrop={(e) => handleDrop(day.date, 'afternoonSnack', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('afternoonSnack')}
                                      value={day.afternoonSnack}
                                      onSelect={(val) => updateDailyMealField(day.date, 'afternoonSnack', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione o lanche..."
                                    />
                                  }
                                >
                                  {day.afternoonSnack}
                                </DraggableCell>
                              </div>

                              <div className="text-[9.5px] leading-tight text-red-800 flex items-center gap-1">
                                <span className="font-bold shrink-0">Diabéticos:</span>
                                <DraggableCell
                                  date={day.date}
                                  field="afternoonSnackDiabetic"
                                  value={day.afternoonSnackDiabetic}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'afternoonSnackDiabetic'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'afternoonSnackDiabetic'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'afternoonSnackDiabetic'}
                                  onToggleEdit={() => toggleEdit(day.date, 'afternoonSnackDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'afternoonSnackDiabetic', day.afternoonSnackDiabetic, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'afternoonSnackDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'afternoonSnackDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'afternoonSnackDiabetic', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('afternoonSnackDiabetic')}
                                      value={day.afternoonSnackDiabetic}
                                      onSelect={(val) => updateDailyMealField(day.date, 'afternoonSnackDiabetic', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione..."
                                    />
                                  }
                                >
                                  {day.afternoonSnackDiabetic}
                                </DraggableCell>
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
                              <div>
                                <DraggableCell
                                  date={day.date}
                                  field="dinner"
                                  value={day.dinner}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'dinner'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'dinner'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'dinner'}
                                  onToggleEdit={() => toggleEdit(day.date, 'dinner')}
                                  onDragStart={(e) => handleDragStart(day.date, 'dinner', day.dinner, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'dinner', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'dinner', e)}
                                  onDrop={(e) => handleDrop(day.date, 'dinner', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('dinner')}
                                      value={day.dinner}
                                      onSelect={(val) => updateDailyMealField(day.date, 'dinner', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione o jantar..."
                                    />
                                  }
                                >
                                  {day.dinner}
                                </DraggableCell>
                              </div>

                              <div className="text-[9.5px] leading-tight text-red-800 flex items-center gap-1">
                                <span className="font-bold shrink-0">Diabéticos:</span>
                                <DraggableCell
                                  date={day.date}
                                  field="dinnerDiabetic"
                                  value={day.dinnerDiabetic || 'Repetir o almoço...'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'dinnerDiabetic'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'dinnerDiabetic'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'dinnerDiabetic'}
                                  onToggleEdit={() => toggleEdit(day.date, 'dinnerDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'dinnerDiabetic', day.dinnerDiabetic || 'Repetir o almoço...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'dinnerDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'dinnerDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'dinnerDiabetic', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('dinnerDiabetic')}
                                      value={day.dinnerDiabetic}
                                      onSelect={(val) => updateDailyMealField(day.date, 'dinnerDiabetic', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione..."
                                    />
                                  }
                                >
                                  {day.dinnerDiabetic || 'Repetir o almoço, porém ½ porção de carboidratos ou caldo de legumes com módulo de fibras( 1 colher de chá)'}
                                </DraggableCell>
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
                              <div>
                                <DraggableCell
                                  date={day.date}
                                  field="supper"
                                  value={day.supper}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'supper'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'supper'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'supper'}
                                  onToggleEdit={() => toggleEdit(day.date, 'supper')}
                                  onDragStart={(e) => handleDragStart(day.date, 'supper', day.supper, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'supper', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'supper', e)}
                                  onDrop={(e) => handleDrop(day.date, 'supper', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('supper')}
                                      value={day.supper}
                                      onSelect={(val) => updateDailyMealField(day.date, 'supper', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione a ceia..."
                                    />
                                  }
                                >
                                  {day.supper}
                                </DraggableCell>
                              </div>

                              <div className="text-[9.5px] leading-tight text-red-800 flex items-center gap-1">
                                <span className="font-bold shrink-0">Diabéticos:</span>
                                <DraggableCell
                                  date={day.date}
                                  field="supperDiabetic"
                                  value={day.supperDiabetic ?? 'Mingau de aveia...'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'supperDiabetic'}
                                  isDragging={dragItem?.date === day.date && dragItem?.field === 'supperDiabetic'}
                                  isDropTarget={dropTarget?.date === day.date && dropTarget?.field === 'supperDiabetic'}
                                  onToggleEdit={() => toggleEdit(day.date, 'supperDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'supperDiabetic', day.supperDiabetic ?? 'Mingau...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'supperDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'supperDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'supperDiabetic', e)}
                                  editComponent={
                                    <CreatableInlineDropdown
                                      options={getOptionsForField('supperDiabetic')}
                                      value={day.supperDiabetic ?? 'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.'}
                                      onSelect={(val) => updateDailyMealField(day.date, 'supperDiabetic', val)}
                                      onClose={() => setEditingCell(null)}
                                      placeholder="Digite ou selecione..."
                                    />
                                  }
                                >
                                  {day.supperDiabetic ?? 'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.'}
                                </DraggableCell>
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
