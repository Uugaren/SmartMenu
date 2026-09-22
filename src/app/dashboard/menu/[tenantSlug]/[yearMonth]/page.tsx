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
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { generateMonthlyMenu, organizeIntoWeeks } from '@/lib/menuGenerator';
import type { Tenant, Dish, DailyMeal, MonthlyMenu, DishCategory, MealSlot, ExtraMealItem } from '@/lib/types';
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

export type MealType = MealSlot;

export const MEAL_FIELDS_MAP: Record<MealType, (keyof DailyMeal)[]> = {
  breakfast: ['breakfast', 'colacao', 'breakfastDiabetic', 'breakfastPastoso'],
  lunch: [
    'lunchMain',
    'lunchMainDishId',
    'lunchSide',
    'lunchSalad',
    'juice',
    'dessert',
    'lunchDiabetic',
    'lunchPastoso',
  ],
  afternoonSnack: ['afternoonSnack', 'afternoonSnackDiabetic'],
  dinner: ['dinner', 'dinnerDiabetic'],
  supper: ['supper', 'supperDiabetic'],
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Café da Manhã + Colação',
  lunch: 'Almoço Completo',
  afternoonSnack: 'Lanche da Tarde',
  dinner: 'Jantar Completo',
  supper: 'Ceia Completa',
};

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
// Optional extra item(s) per meal (e.g. an extra dessert at lunch).
// Fully optional: shows only a discreet "+" button (never printed) when empty.
// ============================================================================
function MealExtras({
  extras,
  dishOptions,
  onAdd,
  onUpdate,
  onRemove,
}: {
  extras: ExtraMealItem[];
  dishOptions: { id: string; name: string }[];
  onAdd: (text: string, dishId?: string) => void;
  onUpdate: (itemId: string, text: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-1 space-y-1 w-full min-w-0" onClick={(e) => e.stopPropagation()}>
      {extras.map((item) =>
        editingId === item.id ? (
          <CreatableInlineDropdown
            key={item.id}
            options={dishOptions}
            value={item.text}
            onSelect={(val) => {
              onUpdate(item.id, val);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
            placeholder="Editar item extra..."
          />
        ) : (
          <div
            key={item.id}
            className="group/extra flex items-start gap-1 w-full min-w-0 text-[11px] leading-tight"
          >
            <span
              className="flex-1 min-w-0 cursor-pointer break-words [overflow-wrap:anywhere]"
              onClick={() => setEditingId(item.id)}
              title="Clique para editar este item extra"
            >
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="no-print shrink-0 text-red-400 hover:text-red-600 opacity-0 group-hover/extra:opacity-100 transition-opacity"
              aria-label="Remover item extra"
              title="Remover item extra"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )
      )}

      {adding ? (
        <CreatableInlineDropdown
          options={dishOptions}
          value={null}
          onSelect={(val, dishId) => {
            onAdd(val, dishId);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
          placeholder="Item extra (texto livre ou item do banco)..."
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="no-print flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 transition-colors"
          aria-label="Adicionar item extra opcional"
          title="Adicionar item extra opcional"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Draggable Cell wrapper for drag and drop item swap
// ============================================================================
interface DraggableCellProps {
  as?: 'span' | 'div' | 'p';
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
  icon?: React.ReactNode;
}

function DraggableCell({
  as: Component = 'span',
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
  icon,
}: DraggableCellProps) {
  if (isEditing) {
    return <div onClick={(e) => e.stopPropagation()}>{editComponent}</div>;
  }

  const dragStyles = isDragging
    ? 'opacity-30 ring-2 ring-dashed ring-emerald-600 bg-emerald-100 scale-95 shadow-inner'
    : isDropTarget
    ? 'bg-amber-200 ring-2 ring-amber-500 scale-[1.02] shadow-md z-20 font-bold border border-amber-600'
    : '';

  return (
    <Component
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
      className={`cursor-grab active:cursor-grabbing transition-all duration-150 ${dragStyles} ${className}`}
      title="Clique para editar ou arraste para trocar de lugar"
    >
      {children}
      {icon !== undefined ? (
        icon
      ) : (
        <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print shrink-0" />
      )}
    </Component>
  );
}

const DEFAULT_TENANTS_MAP: Record<string, Tenant> = {
  lares: {
    id: '67580ed8-76dd-4645-8b3d-2e9212ce27a0',
    name: 'Lares Casa de Repouso',
    slug: 'lares',
    logo_url: '/logos/lares.jpg',
    primary_color: '#059669',
    created_at: '2026-07-25',
  },
  'vida-plena': {
    id: '918f7f15-29df-460a-a8ed-09aede7949a8',
    name: 'Casa de Repouso Vida Plena',
    slug: 'vida-plena',
    logo_url: '/logos/vida-plena.png',
    primary_color: '#0891B2',
    created_at: '2026-07-25',
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

// ============================================================================
// Main page component
// ============================================================================
export default function MenuEditorPage({ params }: { params: Params }) {
  const resolvedParams = use(params);
  const { tenantSlug, yearMonth } = resolvedParams;
  const router = useRouter();

  const [year, month] = yearMonth.split('-').map(Number);
  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  const initialTenant: Tenant = DEFAULT_TENANTS_MAP[tenantSlug] || {
    id: `tenant-${tenantSlug}`,
    name: tenantSlug.replace(/-/g, ' ').toUpperCase(),
    slug: tenantSlug,
    logo_url: '/logos/lares.jpg',
    primary_color: '#059669',
    created_at: '2026-01-01',
  };

  const [tenant, setTenant] = useState<Tenant>(initialTenant);
  const [dishes, setDishes] = useState<Dish[]>([]);
  // Instant optimistic render: generates entire 31-day nutritionist menu in <0.05s
  const [days, setDays] = useState<DailyMeal[]>(() =>
    generateMonthlyMenu(initialTenant, [], year, month)
  );
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Field being edited: { date, field }
  const [editingCell, setEditingCell] = useState<{ date: string; field: keyof DailyMeal } | null>(null);

  // Drag & drop state
  const [dragItem, setDragItem] = useState<
    | { type: 'CELL'; date: string; field: keyof DailyMeal; value: string }
    | { type: 'DAY'; date: string; label: string }
    | { type: 'MEAL'; date: string; mealType: MealType; label: string }
    | null
  >(null);
  const [dropTarget, setDropTarget] = useState<
    | { type: 'CELL'; date: string; field: keyof DailyMeal }
    | { type: 'DAY'; date: string }
    | { type: 'MEAL'; date: string; mealType: MealType }
    | null
  >(null);
  const [swapToast, setSwapToast] = useState<{ title: string; message: string } | null>(null);

  // Parallel background sync with timeout safeguard (never blocks UI)
  useEffect(() => {
    let isCancelled = false;

    async function syncData() {
      try {
        const startDate = `${yearMonth}-01`;
        const endDate = `${yearMonth}-31`;

        const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
          setTimeout(() => resolve({ timeout: true }), 4000)
        );

        const fetchPromise = (async () => {
          // Resolve tenant first to get real database UUID
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('slug', tenantSlug)
            .maybeSingle();

          const resolvedTenant = tenantData || initialTenant;
          const tenantId = resolvedTenant.id;

          const [{ data: dishesData }, { data: existingMenus }] = await Promise.all([
            supabase
              .from('dishes')
              .select('*')
              .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
              .order('name'),
            supabase
              .from('monthly_menus')
              .select('*, lunch_dish:dishes(*)')
              .eq('tenant_id', tenantId)
              .gte('date', startDate)
              .lte('date', endDate)
              .order('date'),
          ]);

          return { tenantData: resolvedTenant, dishesData, existingMenus };
        })();

        const raceResult = await Promise.race([fetchPromise, timeoutPromise]);

        if ('timeout' in raceResult) {
          if (!isCancelled) setIsSyncing(false);
          return;
        }

        const { tenantData, dishesData, existingMenus } = raceResult;

        if (isCancelled) return;

        if (tenantData) {
          setTenant(tenantData);
        }

        const currentDishes = dishesData && dishesData.length > 0 ? dishesData : dishes;
        if (dishesData && dishesData.length > 0) {
          setDishes(dishesData);
        }

        // Generate menu using dishes loaded from Supabase
        const generated = generateMonthlyMenu(tenantData || initialTenant, currentDishes, year, month);

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
                extras: mealData.extras ?? day.extras,
              };
            }
            return day;
          });
          setDays(merged);
        } else if (currentDishes.length > 0) {
          setDays(generated);
        }
      } catch (err) {
        console.warn('Sincronização em segundo plano:', err);
      } finally {
        if (!isCancelled) {
          setIsSyncing(false);
          setLoading(false);
        }
      }
    }

    syncData();

    return () => {
      isCancelled = true;
    };
  }, [tenantSlug, yearMonth, initialTenant.id]);

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
        extras: 'prato_principal',
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

  // Add / update / remove an optional extra item for a given meal (e.g. extra dessert at lunch)
  const addExtraItem = useCallback(
    (date: string, mealType: MealType, text: string, dishId?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const newItem: ExtraMealItem = {
        id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        dishId: dishId ?? null,
      };
      setDays((prev) =>
        prev.map((day) => {
          if (day.date !== date) return day;
          const currentExtras = day.extras?.[mealType] ?? [];
          return { ...day, extras: { ...day.extras, [mealType]: [...currentExtras, newItem] } };
        })
      );
    },
    []
  );

  const updateExtraItem = useCallback(
    (date: string, mealType: MealType, itemId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setDays((prev) =>
        prev.map((day) => {
          if (day.date !== date) return day;
          const currentExtras = day.extras?.[mealType] ?? [];
          return {
            ...day,
            extras: {
              ...day.extras,
              [mealType]: currentExtras.map((item) => (item.id === itemId ? { ...item, text: trimmed } : item)),
            },
          };
        })
      );
    },
    []
  );

  const removeExtraItem = useCallback(
    (date: string, mealType: MealType, itemId: string) => {
      setDays((prev) =>
        prev.map((day) => {
          if (day.date !== date) return day;
          const currentExtras = day.extras?.[mealType] ?? [];
          return {
            ...day,
            extras: { ...day.extras, [mealType]: currentExtras.filter((item) => item.id !== itemId) },
          };
        })
      );
    },
    []
  );

  // Helper check for cell drag highlight
  const isCellDragging = useCallback(
    (date: string, field: keyof DailyMeal) => {
      if (!dragItem) return false;
      if (dragItem.type === 'DAY') return dragItem.date === date;
      if (dragItem.type === 'CELL') return dragItem.date === date && dragItem.field === field;
      return false;
    },
    [dragItem]
  );

  const isCellDropTarget = useCallback(
    (date: string, field: keyof DailyMeal) => {
      if (!dropTarget) return false;
      if (dropTarget.type === 'DAY') return dropTarget.date === date;
      if (dropTarget.type === 'CELL') return dropTarget.date === date && dropTarget.field === field;
      return false;
    },
    [dropTarget]
  );

  // Helper check for whole-meal drag highlight
  const isMealDragging = useCallback(
    (date: string, mealType: MealType) => {
      if (!dragItem) return false;
      if (dragItem.type === 'DAY') return dragItem.date === date;
      if (dragItem.type === 'MEAL') return dragItem.date === date && dragItem.mealType === mealType;
      return false;
    },
    [dragItem]
  );

  const isMealDropTarget = useCallback(
    (date: string, mealType: MealType) => {
      if (!dropTarget) return false;
      if (dropTarget.type === 'DAY') return dropTarget.date === date;
      if (dropTarget.type === 'MEAL') return dropTarget.date === date && dropTarget.mealType === mealType;
      return false;
    },
    [dropTarget]
  );

  // Swap all meal preparations of two full days
  const swapFullDays = useCallback(
    (sourceDate: string, targetDate: string) => {
      if (sourceDate === targetDate) return;

      const sourceDay = days.find((d) => d.date === sourceDate);
      const targetDay = days.find((d) => d.date === targetDate);

      if (!sourceDay || !targetDay) return;

      const MEAL_FIELDS: (keyof DailyMeal)[] = [
        'breakfast',
        'breakfastDiabetic',
        'breakfastPastoso',
        'colacao',
        'lunchMain',
        'lunchMainDishId',
        'lunchSalad',
        'lunchSide',
        'juice',
        'dessert',
        'lunchDiabetic',
        'lunchPastoso',
        'afternoonSnack',
        'afternoonSnackDiabetic',
        'dinner',
        'dinnerDiabetic',
        'supper',
        'supperDiabetic',
      ];

      setDays((prevDays) =>
        prevDays.map((day) => {
          if (day.date === sourceDate) {
            const updated = { ...day };
            for (const field of MEAL_FIELDS) {
              (updated as any)[field] = targetDay[field];
            }
            updated.extras = targetDay.extras;
            return updated;
          }
          if (day.date === targetDate) {
            const updated = { ...day };
            for (const field of MEAL_FIELDS) {
              (updated as any)[field] = sourceDay[field];
            }
            updated.extras = sourceDay.extras;
            return updated;
          }
          return day;
        })
      );

      const sourceDayLabel = getFormattedDayName(sourceDate);
      const targetDayLabel = getFormattedDayName(targetDate);

      setSwapToast({
        title: 'Dia completo trocado! 🔄',
        message: `Todas as preparações de [${sourceDayLabel}] ↔ [${targetDayLabel}] foram trocadas.`,
      });
      setTimeout(() => setSwapToast(null), 4000);
    },
    [days]
  );

  // Swap a specific meal type (e.g. Almoço, Jantar, Café, Lanche, Ceia) between two days
  const swapMeal = useCallback(
    (sourceDate: string, targetDate: string, mealType: MealType) => {
      if (sourceDate === targetDate) return;

      const sourceDay = days.find((d) => d.date === sourceDate);
      const targetDay = days.find((d) => d.date === targetDate);

      if (!sourceDay || !targetDay) return;

      const fieldsToSwap = MEAL_FIELDS_MAP[mealType];

      setDays((prevDays) =>
        prevDays.map((day) => {
          if (day.date === sourceDate) {
            const updated = { ...day };
            for (const field of fieldsToSwap) {
              (updated as any)[field] = targetDay[field];
            }
            updated.extras = { ...day.extras, [mealType]: targetDay.extras?.[mealType] };
            return updated;
          }
          if (day.date === targetDate) {
            const updated = { ...day };
            for (const field of fieldsToSwap) {
              (updated as any)[field] = sourceDay[field];
            }
            updated.extras = { ...day.extras, [mealType]: sourceDay.extras?.[mealType] };
            return updated;
          }
          return day;
        })
      );

      const sourceDayLabel = getFormattedDayName(sourceDate);
      const targetDayLabel = getFormattedDayName(targetDate);
      const mealLabel = MEAL_TYPE_LABELS[mealType] || 'Refeição';

      setSwapToast({
        title: `${mealLabel} trocado! 🔄`,
        message: `${mealLabel} de [${sourceDayLabel}] ↔ [${targetDayLabel}] foram trocados com sucesso.`,
      });
      setTimeout(() => setSwapToast(null), 4000);
    },
    [days]
  );

  // Drag and Drop event handlers (Cell)
  const handleDragStart = useCallback(
    (date: string, field: keyof DailyMeal, value: string, e: React.DragEvent) => {
      const payload = { type: 'CELL' as const, date, field, value };
      setDragItem(payload);
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
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
        if (prev?.type === 'CELL' && prev.date === date && prev.field === field) return prev;
        return { type: 'CELL', date, field };
      });
    },
    []
  );

  const handleDragLeave = useCallback(
    (date: string, field: keyof DailyMeal, e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget((prev) => {
        if (prev?.type === 'CELL' && prev.date === date && prev.field === field) return null;
        return prev;
      });
    },
    []
  );

  // Drag and Drop event handlers (Meal Type)
  const handleDragMealStart = useCallback(
    (date: string, mealType: MealType, e: React.DragEvent) => {
      e.stopPropagation();
      const payload = {
        type: 'MEAL' as const,
        date,
        mealType,
        label: MEAL_TYPE_LABELS[mealType],
      };
      setDragItem(payload);
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
      } catch {
        // ignore
      }
    },
    []
  );

  const handleDragMealOver = useCallback(
    (date: string, mealType: MealType, e: React.DragEvent) => {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'move';
      } catch {
        // ignore
      }
      setDropTarget((prev) => {
        if (prev?.type === 'MEAL' && prev.date === date && prev.mealType === mealType) return prev;
        return { type: 'MEAL', date, mealType };
      });
    },
    []
  );

  const handleDragMealLeave = useCallback(
    (date: string, mealType: MealType, e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget((prev) => {
        if (prev?.type === 'MEAL' && prev.date === date && prev.mealType === mealType) return null;
        return prev;
      });
    },
    []
  );

  const handleDropMeal = useCallback(
    (targetDate: string, targetMealType: MealType, e: React.DragEvent) => {
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

      if (source) {
        const sourceType = (source as any).type;
        if (sourceType === 'MEAL') {
          const mealSource = source as { date: string; mealType: MealType };
          if (mealSource.date !== targetDate) {
            swapMeal(mealSource.date, targetDate, mealSource.mealType);
          }
        } else if (sourceType === 'DAY') {
          swapFullDays(source.date, targetDate);
        }
      }

      setDragItem(null);
      setDropTarget(null);
    },
    [dragItem, swapMeal, swapFullDays]
  );

  // Drag and Drop event handlers (Day Header)
  const handleDragDayStart = useCallback(
    (date: string, label: string, e: React.DragEvent) => {
      const payload = { type: 'DAY' as const, date, label };
      setDragItem(payload);
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
      } catch {
        // ignore
      }
    },
    []
  );

  const handleDragDayOver = useCallback(
    (date: string, e: React.DragEvent) => {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'move';
      } catch {
        // ignore
      }
      setDropTarget((prev) => {
        if (prev?.type === 'DAY' && prev.date === date) return prev;
        return { type: 'DAY', date };
      });
    },
    []
  );

  const handleDragDayLeave = useCallback(
    (date: string, e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget((prev) => {
        if (prev?.type === 'DAY' && prev.date === date) return null;
        return prev;
      });
    },
    []
  );

  const handleDropDay = useCallback(
    (targetDate: string, e: React.DragEvent) => {
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

      if (source) {
        const sourceType = (source as any).type;
        if (sourceType === 'MEAL') {
          const mealSource = source as { date: string; mealType: MealType };
          if (mealSource.date !== targetDate) {
            swapMeal(mealSource.date, targetDate, mealSource.mealType);
          }
        } else {
          swapFullDays(source.date, targetDate);
        }
      }

      setDragItem(null);
      setDropTarget(null);
    },
    [dragItem, swapFullDays, swapMeal]
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

      if (source) {
        const sourceType = (source as any).type;
        if (sourceType === 'DAY') {
          // Entire day was dragged onto a cell of targetDate -> swap full days
          swapFullDays(source.date, targetDate);
        } else if (sourceType === 'MEAL') {
          // Entire meal was dragged onto a cell -> swap that meal
          const mealSource = source as { date: string; mealType: MealType };
          if (mealSource.date !== targetDate) {
            swapMeal(mealSource.date, targetDate, mealSource.mealType);
          }
        } else {
          const cellSource = source as { date: string; field: keyof DailyMeal; value: string };
          if (cellSource.date !== targetDate || cellSource.field !== targetField) {
            const sourceDate = cellSource.date;
            const sourceField = cellSource.field;

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
        }
      }

      setDragItem(null);
      setDropTarget(null);
    },
    [dragItem, days, swapFullDays, swapMeal]
  );

  // Save to Supabase
  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    setSaveError(null);

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
        extras: day.extras,
      },
      notes: null,
    }));

    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;

    const { error: deleteError } = await supabase
      .from('monthly_menus')
      .delete()
      .eq('tenant_id', tenant.id)
      .gte('date', startDate)
      .lte('date', endDate);

    if (deleteError) {
      console.error('Erro ao limpar cardápio anterior:', deleteError);
      setSaving(false);
      setSaveError(`Falha ao salvar: ${deleteError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from('monthly_menus').insert(upserts);

    if (insertError) {
      console.error('Erro ao salvar cardápio:', insertError);
      setSaving(false);
      setSaveError(`Falha ao salvar: ${insertError.message}`);
      return;
    }

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

  // All dishes from the DB, for the "add extra item" dropdown (any category)
  const allDishOptions = Array.from(
    new Map(dishes.map((d) => [d.name, { id: d.id, name: d.name }])).values()
  );

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
      {saveError && (
        <div className="no-print fixed bottom-6 right-6 z-50 bg-red-950 text-white px-4 py-3 rounded-xl shadow-2xl border border-red-700 animate-slide-up flex items-start gap-3 max-w-md">
          <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-xs text-red-300">Não foi possível salvar</h4>
            <p className="text-xs text-red-100 mt-0.5 break-words">{saveError}</p>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="shrink-0 text-red-300 hover:text-white transition-colors"
            aria-label="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
        <div className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-full shadow-2xl border border-amber-300 animate-pulse flex items-center gap-2.5 pointer-events-none">
          <GripVertical className="w-4 h-4 shrink-0" />
          <span>
            {dragItem.type === 'DAY'
              ? `Solte sobre outro dia para trocar TODAS as preparações de [${getFormattedDayName(dragItem.date)}]`
              : dragItem.type === 'MEAL'
              ? `Solte sobre outro dia para trocar [${dragItem.label}] de [${getFormattedDayName(dragItem.date)}]`
              : `Solte sobre outro prato/dia para trocar de lugar com "${dragItem.value}"`}
          </span>
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
                <h1 className="font-display text-sm font-bold text-on-surface leading-tight flex items-center gap-2">
                  <span>{tenant.name}</span>
                  {isSyncing && (
                    <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-600" />
                      Sincronizando...
                    </span>
                  )}
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
              <strong>Drag & Drop Avançado:</strong> Arraste o <u>cabeçalho do dia</u> para trocar todas as refeições do dia. Arraste as alças de <u>refeição completa</u> (ex: <em>Mover Almoço Completo</em>, <em>Mover Café + Colação</em>, etc.) para trocar a refeição inteira entre dias. Arraste qualquer texto para trocar itens individuais.
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
            <div className="bg-white rounded-xl border border-slate-300 shadow-md p-4 overflow-hidden print-page-block print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0">
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
              <div className="overflow-x-auto print:overflow-visible">
                <table className="menu-grid-table border-collapse w-full text-[11px] text-black">
                  <thead>
                    <tr className="bg-slate-200 text-black">
                      <th className="border border-slate-400 p-2 text-center font-bold text-xs uppercase w-32 print:static print:border-[1.5px] print:border-black print:bg-slate-200">
                        REFEIÇÕES
                      </th>
                      {week.map((day, dayIdx) => {
                        if (!day) {
                          return (
                            <th key={dayIdx} className="border border-slate-400 p-2 text-center font-bold text-xs uppercase bg-slate-100 print:static print:border-[1.5px] print:border-black print:bg-slate-100">
                              {DAY_NAMES_SHORT[dayIdx]}
                            </th>
                          );
                        }

                        const dayLabel = getFormattedDayName(day.date);
                        const isDayDragging = dragItem?.type === 'DAY' && dragItem.date === day.date;
                        const isDayDropTarget = dropTarget?.date === day.date;

                        return (
                          <th
                            key={dayIdx}
                            draggable
                            onDragStart={(e) => handleDragDayStart(day.date, dayLabel, e)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragDayOver(day.date, e)}
                            onDragLeave={(e) => handleDragDayLeave(day.date, e)}
                            onDrop={(e) => handleDropDay(day.date, e)}
                            className={`border border-slate-400 p-1.5 text-center font-bold text-xs uppercase cursor-grab active:cursor-grabbing transition-all select-none group relative print:static print:border-[1.5px] print:border-black print:bg-slate-200 ${
                              isDayDragging
                                ? 'bg-amber-200 opacity-40 ring-2 ring-dashed ring-amber-600 scale-95'
                                : isDayDropTarget
                                ? 'bg-emerald-200 ring-2 ring-emerald-500 scale-[1.02] shadow-md border-emerald-600'
                                : 'hover:bg-amber-50 bg-slate-200'
                            }`}
                            title="Arraste este dia para trocar TODAS as refeições com outro dia"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] text-amber-900 font-semibold mb-0.5 no-print opacity-70 group-hover:opacity-100 transition-opacity">
                              <GripVertical className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span className="text-[9px] tracking-tight">MOVER DIA</span>
                            </div>
                            <div>{DAY_NAMES_FULL[dayIdx]}</div>
                            <div className="text-[11px] font-extrabold text-emerald-800">
                              {format(parse(day.date, 'yyyy-MM-dd', new Date()), 'dd/MM')}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: CAFÉ DA MANHÃ + COLAÇÃO */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#fef3c7] text-slate-900 w-32 print:static print:border-[1.5px] print:border-black">
                        CAFÉ DA MANHÃ
                        <br />+<br />
                        COLAÇÃO
                      </td>
                      {week.map((day, dayIdx) => (
                        <td
                          key={dayIdx}
                          onDragOver={(e) => day && handleDragMealOver(day.date, 'breakfast', e)}
                          onDragLeave={(e) => day && handleDragMealLeave(day.date, 'breakfast', e)}
                          onDrop={(e) => day && handleDropMeal(day.date, 'breakfast', e)}
                          className={`border border-slate-400 p-2 align-top bg-white transition-all relative print:static print:border-[1.5px] print:border-black ${
                            day && isMealDragging(day.date, 'breakfast')
                              ? 'opacity-40 bg-amber-50 ring-2 ring-dashed ring-amber-500'
                              : day && isMealDropTarget(day.date, 'breakfast')
                              ? 'bg-amber-100 ring-2 ring-amber-500 scale-[1.01] shadow-lg font-bold'
                              : ''
                          }`}
                        >
                          {day && (
                            <div className="space-y-2">
                              {/* Draggable handle for whole Breakfast */}
                              <div
                                draggable
                                onDragStart={(e) => handleDragMealStart(day.date, 'breakfast', e)}
                                onDragEnd={handleDragEnd}
                                className="flex items-center justify-between px-1.5 py-0.5 mb-1 rounded bg-amber-100/80 hover:bg-amber-200 text-amber-950 font-semibold cursor-grab active:cursor-grabbing text-[9px] transition-all no-print select-none border border-amber-300/70 shadow-xs group"
                                title="Arraste para trocar todo o Café da Manhã + Colação deste dia com outro dia"
                              >
                                <span className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>Mover Café + Colação</span>
                                </span>
                                <ArrowLeftRight className="w-2.5 h-2.5 text-amber-700 opacity-60 group-hover:opacity-100" />
                              </div>

                              {/* Main Breakfast & Fruit Dropdown */}
                              <div className="text-[11px] leading-tight">
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="breakfast"
                                  value={day.breakfast || 'Pão francês/Doce com manteiga Café com leite'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'breakfast'}
                                  isDragging={isCellDragging(day.date, 'breakfast')}
                                  isDropTarget={isCellDropTarget(day.date, 'breakfast')}
                                  onToggleEdit={() => toggleEdit(day.date, 'breakfast')}
                                  onDragStart={(e) => handleDragStart(day.date, 'breakfast', day.breakfast || 'Pão francês/Doce com manteiga Café com leite', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'breakfast', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'breakfast', e)}
                                  onDrop={(e) => handleDrop(day.date, 'breakfast', e)}
                                  className="editable-cell cursor-pointer hover:bg-amber-100 rounded px-0.5 inline-block"
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
                                </DraggableCell>{' '}
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="colacao"
                                  value={day.colacao}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'colacao'}
                                  isDragging={isCellDragging(day.date, 'colacao')}
                                  isDropTarget={isCellDropTarget(day.date, 'colacao')}
                                  onToggleEdit={() => toggleEdit(day.date, 'colacao')}
                                  onDragStart={(e) => handleDragStart(day.date, 'colacao', day.colacao, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'colacao', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'colacao', e)}
                                  onDrop={(e) => handleDrop(day.date, 'colacao', e)}
                                  className="editable-cell text-amber-700 font-bold px-0.5 py-0.2 rounded hover:bg-amber-100 transition-colors inline-block"
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

                              {/* Optional extra item(s) — cardápio normal */}
                              <MealExtras
                                extras={day.extras?.breakfast ?? []}
                                dishOptions={allDishOptions}
                                onAdd={(text, dishId) => addExtraItem(day.date, 'breakfast', text, dishId)}
                                onUpdate={(itemId, text) => updateExtraItem(day.date, 'breakfast', itemId, text)}
                                onRemove={(itemId) => removeExtraItem(day.date, 'breakfast', itemId)}
                              />

                              {/* Diabéticos Note Dropdown */}
                              <div className="text-[10px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="breakfastDiabetic"
                                  value={day.breakfastDiabetic}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'breakfastDiabetic'}
                                  isDragging={isCellDragging(day.date, 'breakfastDiabetic')}
                                  isDropTarget={isCellDropTarget(day.date, 'breakfastDiabetic')}
                                  onToggleEdit={() => toggleEdit(day.date, 'breakfastDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'breakfastDiabetic', day.breakfastDiabetic, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'breakfastDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'breakfastDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'breakfastDiabetic', e)}
                                  className="editable-cell hover:bg-red-100 rounded px-0.5 inline-block cursor-pointer"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
                                <span className="font-bold">PASTOSOS:</span>{' '}
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="breakfastPastoso"
                                  value={day.breakfastPastoso}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'breakfastPastoso'}
                                  isDragging={isCellDragging(day.date, 'breakfastPastoso')}
                                  isDropTarget={isCellDropTarget(day.date, 'breakfastPastoso')}
                                  onToggleEdit={() => toggleEdit(day.date, 'breakfastPastoso')}
                                  onDragStart={(e) => handleDragStart(day.date, 'breakfastPastoso', day.breakfastPastoso, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'breakfastPastoso', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'breakfastPastoso', e)}
                                  onDrop={(e) => handleDrop(day.date, 'breakfastPastoso', e)}
                                  className="editable-cell hover:bg-red-100 rounded px-0.5 inline-block cursor-pointer"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
                                </DraggableCell>{' '}
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
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#d1fae5] text-emerald-950 w-32 print:static print:border-[1.5px] print:border-black">
                        ALMOÇO
                      </td>
                      {week.map((day, dayIdx) => (
                        <td
                          key={dayIdx}
                          onDragOver={(e) => day && handleDragMealOver(day.date, 'lunch', e)}
                          onDragLeave={(e) => day && handleDragMealLeave(day.date, 'lunch', e)}
                          onDrop={(e) => day && handleDropMeal(day.date, 'lunch', e)}
                          className={`border border-slate-400 p-2 align-top bg-white transition-all relative print:static print:border-[1.5px] print:border-black ${
                            day && isMealDragging(day.date, 'lunch')
                              ? 'opacity-40 bg-emerald-50 ring-2 ring-dashed ring-emerald-500'
                              : day && isMealDropTarget(day.date, 'lunch')
                              ? 'bg-amber-100 ring-2 ring-amber-500 scale-[1.01] shadow-lg font-bold'
                              : ''
                          }`}
                        >
                          {day && (
                            <div className="space-y-2">
                              {/* Draggable handle for whole Lunch */}
                              <div
                                draggable
                                onDragStart={(e) => handleDragMealStart(day.date, 'lunch', e)}
                                onDragEnd={handleDragEnd}
                                className="flex items-center justify-between px-1.5 py-0.5 mb-1 rounded bg-emerald-100/80 hover:bg-emerald-200 text-emerald-950 font-semibold cursor-grab active:cursor-grabbing text-[9px] transition-all no-print select-none border border-emerald-300/70 shadow-xs group"
                                title="Arraste para trocar todo o Almoço deste dia com outro dia"
                              >
                                <span className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-emerald-700 shrink-0" />
                                  <span>Mover Almoço Completo</span>
                                </span>
                                <ArrowLeftRight className="w-2.5 h-2.5 text-emerald-700 opacity-60 group-hover:opacity-100" />
                              </div>

                              <div className="text-[11px] leading-tight space-y-1">
                                {/* Editable Lunch Side */}
                                <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                  <DraggableCell
                                    as="span"
                                    date={day.date}
                                    field="lunchSide"
                                    value={day.lunchSide}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchSide'}
                                    isDragging={isCellDragging(day.date, 'lunchSide')}
                                    isDropTarget={isCellDropTarget(day.date, 'lunchSide')}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchSide')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchSide', day.lunchSide, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchSide', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchSide', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchSide', e)}
                                    className="cursor-pointer hover:bg-emerald-100 rounded px-0.5 transition-colors inline-block"
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
                                <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                  <DraggableCell
                                    as="span"
                                    date={day.date}
                                    field="lunchMain"
                                    value={day.lunchMain}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchMain'}
                                    isDragging={isCellDragging(day.date, 'lunchMain')}
                                    isDropTarget={isCellDropTarget(day.date, 'lunchMain')}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchMain')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchMain', day.lunchMain, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchMain', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchMain', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchMain', e)}
                                    className="font-bold uppercase text-black cursor-pointer hover:bg-amber-100 rounded px-0.5 transition-colors inline-block"
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
                                <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                  <DraggableCell
                                    as="span"
                                    date={day.date}
                                    field="lunchSalad"
                                    value={day.lunchSalad}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchSalad'}
                                    isDragging={isCellDragging(day.date, 'lunchSalad')}
                                    isDropTarget={isCellDropTarget(day.date, 'lunchSalad')}
                                    onToggleEdit={() => toggleEdit(day.date, 'lunchSalad')}
                                    onDragStart={(e) => handleDragStart(day.date, 'lunchSalad', day.lunchSalad, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'lunchSalad', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'lunchSalad', e)}
                                    onDrop={(e) => handleDrop(day.date, 'lunchSalad', e)}
                                    className="cursor-pointer hover:bg-green-100 rounded px-0.5 transition-colors inline-block"
                                    icon={<Salad className="w-2.5 h-2.5 inline ml-1 opacity-40 no-print shrink-0" />}
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
                                  </DraggableCell>
                                </div>

                                {/* Editable Juice */}
                                <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                  <DraggableCell
                                    as="span"
                                    date={day.date}
                                    field="juice"
                                    value={day.juice}
                                    isEditing={editingCell?.date === day.date && editingCell?.field === 'juice'}
                                    isDragging={isCellDragging(day.date, 'juice')}
                                    isDropTarget={isCellDropTarget(day.date, 'juice')}
                                    onToggleEdit={() => toggleEdit(day.date, 'juice')}
                                    onDragStart={(e) => handleDragStart(day.date, 'juice', day.juice, e)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(day.date, 'juice', e)}
                                    onDragLeave={(e) => handleDragLeave(day.date, 'juice', e)}
                                    onDrop={(e) => handleDrop(day.date, 'juice', e)}
                                    className="text-slate-800 cursor-pointer hover:bg-yellow-100 rounded px-0.5 transition-colors inline-block"
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

                              {/* Optional extra item(s) — cardápio normal */}
                              <MealExtras
                                extras={day.extras?.lunch ?? []}
                                dishOptions={allDishOptions}
                                onAdd={(text, dishId) => addExtraItem(day.date, 'lunch', text, dishId)}
                                onUpdate={(itemId, text) => updateExtraItem(day.date, 'lunch', itemId, text)}
                                onRemove={(itemId) => removeExtraItem(day.date, 'lunch', itemId)}
                              />

                              {/* Diabéticos & Pastosos notes */}
                              <div className="pt-1 border-t border-slate-200 text-[9.5px] leading-tight text-slate-700 space-y-1">
                                <DraggableCell
                                  as="div"
                                  date={day.date}
                                  field="lunchDiabetic"
                                  value={day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchDiabetic'}
                                  isDragging={isCellDragging(day.date, 'lunchDiabetic')}
                                  isDropTarget={isCellDropTarget(day.date, 'lunchDiabetic')}
                                  onToggleEdit={() => toggleEdit(day.date, 'lunchDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'lunchDiabetic', day.lunchDiabetic ?? 'Colocar mais folhas cruas...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'lunchDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'lunchDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'lunchDiabetic', e)}
                                  className="editable-cell cursor-pointer hover:bg-red-50 rounded px-0.5"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
                                  <span className="font-bold text-red-800">Diabéticos:</span>{' '}
                                  {day.lunchDiabetic ?? 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.'}
                                </DraggableCell>

                                <DraggableCell
                                  as="div"
                                  date={day.date}
                                  field="lunchPastoso"
                                  value={day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'lunchPastoso'}
                                  isDragging={isCellDragging(day.date, 'lunchPastoso')}
                                  isDropTarget={isCellDropTarget(day.date, 'lunchPastoso')}
                                  onToggleEdit={() => toggleEdit(day.date, 'lunchPastoso')}
                                  onDragStart={(e) => handleDragStart(day.date, 'lunchPastoso', day.lunchPastoso ?? 'colocar módulo...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'lunchPastoso', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'lunchPastoso', e)}
                                  onDrop={(e) => handleDrop(day.date, 'lunchPastoso', e)}
                                  className="editable-cell cursor-pointer hover:bg-red-50 rounded px-0.5"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
                                  <span className="font-bold text-red-900">Pastoso:</span>{' '}
                                  {day.lunchPastoso ?? 'colocar módulo de fibras (1 colher de chá)'}
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

            {/* ========================================================================= */}
            {/* PAGE 2 OF WEEK: LANCHE, JANTAR E CEIA                                     */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-xl border border-slate-300 shadow-md p-4 overflow-hidden print-page-block print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0">
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
              <div className="overflow-x-auto print:overflow-visible">
                <table className="menu-grid-table border-collapse w-full text-[11px] text-black">
                  <thead>
                    <tr className="bg-slate-200 text-black">
                      <th className="border border-slate-400 p-2 text-center font-bold text-xs uppercase w-32 print:static print:border-[1.5px] print:border-black print:bg-slate-200">
                        REFEIÇÕES
                      </th>
                      {week.map((day, dayIdx) => {
                        if (!day) {
                          return (
                            <th key={dayIdx} className="border border-slate-400 p-2 text-center font-bold text-xs uppercase bg-slate-100 print:static print:border-[1.5px] print:border-black print:bg-slate-100">
                              CONTINUAÇÃO
                            </th>
                          );
                        }

                        const dayLabel = getFormattedDayName(day.date);
                        const isDayDragging = dragItem?.type === 'DAY' && dragItem.date === day.date;
                        const isDayDropTarget = dropTarget?.date === day.date;

                        return (
                          <th
                            key={dayIdx}
                            draggable
                            onDragStart={(e) => handleDragDayStart(day.date, dayLabel, e)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragDayOver(day.date, e)}
                            onDragLeave={(e) => handleDragDayLeave(day.date, e)}
                            onDrop={(e) => handleDropDay(day.date, e)}
                            className={`border border-slate-400 p-1.5 text-center font-bold text-xs uppercase cursor-grab active:cursor-grabbing transition-all select-none group relative print:static print:border-[1.5px] print:border-black print:bg-slate-200 ${
                              isDayDragging
                                ? 'bg-amber-200 opacity-40 ring-2 ring-dashed ring-amber-600 scale-95'
                                : isDayDropTarget
                                ? 'bg-emerald-200 ring-2 ring-emerald-500 scale-[1.02] shadow-md border-emerald-600'
                                : 'hover:bg-amber-50 bg-slate-200'
                            }`}
                            title="Arraste este dia para trocar TODAS as refeições com outro dia"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] text-amber-900 font-semibold mb-0.5 no-print opacity-70 group-hover:opacity-100 transition-opacity">
                              <GripVertical className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span className="text-[9px] tracking-tight">MOVER DIA</span>
                            </div>
                            <div>{DAY_NAMES_FULL[dayIdx]}</div>
                            <div className="text-[11px] font-extrabold text-emerald-800">
                              {format(parse(day.date, 'yyyy-MM-dd', new Date()), 'dd/MM')}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: LANCHE DA TARDE */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#dbeafe] text-sky-950 w-32 print:static print:border-[1.5px] print:border-black">
                        LANCHE DA TARDE
                      </td>
                      {week.map((day, dayIdx) => (
                        <td
                          key={dayIdx}
                          onDragOver={(e) => day && handleDragMealOver(day.date, 'afternoonSnack', e)}
                          onDragLeave={(e) => day && handleDragMealLeave(day.date, 'afternoonSnack', e)}
                          onDrop={(e) => day && handleDropMeal(day.date, 'afternoonSnack', e)}
                          className={`border border-slate-400 p-2 align-top bg-white transition-all relative print:static print:border-[1.5px] print:border-black ${
                            day && isMealDragging(day.date, 'afternoonSnack')
                              ? 'opacity-40 bg-sky-50 ring-2 ring-dashed ring-sky-500'
                              : day && isMealDropTarget(day.date, 'afternoonSnack')
                              ? 'bg-amber-100 ring-2 ring-amber-500 scale-[1.01] shadow-lg font-bold'
                              : ''
                          }`}
                        >
                          {day && (
                            <div className="space-y-1.5">
                              {/* Draggable handle for whole Afternoon Snack */}
                              <div
                                draggable
                                onDragStart={(e) => handleDragMealStart(day.date, 'afternoonSnack', e)}
                                onDragEnd={handleDragEnd}
                                className="flex items-center justify-between px-1.5 py-0.5 mb-1 rounded bg-sky-100/80 hover:bg-sky-200 text-sky-950 font-semibold cursor-grab active:cursor-grabbing text-[9px] transition-all no-print select-none border border-sky-300/70 shadow-xs group"
                                title="Arraste para trocar todo o Lanche da Tarde deste dia com outro dia"
                              >
                                <span className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-sky-700 shrink-0" />
                                  <span>Mover Lanche da Tarde</span>
                                </span>
                                <ArrowLeftRight className="w-2.5 h-2.5 text-sky-700 opacity-60 group-hover:opacity-100" />
                              </div>

                              {/* Editable Afternoon Snack */}
                              <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                <DraggableCell
                                  as="p"
                                  date={day.date}
                                  field="afternoonSnack"
                                  value={day.afternoonSnack}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'afternoonSnack'}
                                  isDragging={isCellDragging(day.date, 'afternoonSnack')}
                                  isDropTarget={isCellDropTarget(day.date, 'afternoonSnack')}
                                  onToggleEdit={() => toggleEdit(day.date, 'afternoonSnack')}
                                  onDragStart={(e) => handleDragStart(day.date, 'afternoonSnack', day.afternoonSnack, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'afternoonSnack', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'afternoonSnack', e)}
                                  onDrop={(e) => handleDrop(day.date, 'afternoonSnack', e)}
                                  className="text-[11px] leading-tight cursor-pointer hover:bg-amber-100 rounded px-0.5 transition-colors font-medium"
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

                              {/* Optional extra item(s) — cardápio normal */}
                              <MealExtras
                                extras={day.extras?.afternoonSnack ?? []}
                                dishOptions={allDishOptions}
                                onAdd={(text, dishId) => addExtraItem(day.date, 'afternoonSnack', text, dishId)}
                                onUpdate={(itemId, text) => updateExtraItem(day.date, 'afternoonSnack', itemId, text)}
                                onRemove={(itemId) => removeExtraItem(day.date, 'afternoonSnack', itemId)}
                              />

                              <div className="text-[9.5px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="afternoonSnackDiabetic"
                                  value={day.afternoonSnackDiabetic ?? 'Escolher 3 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'afternoonSnackDiabetic'}
                                  isDragging={isCellDragging(day.date, 'afternoonSnackDiabetic')}
                                  isDropTarget={isCellDropTarget(day.date, 'afternoonSnackDiabetic')}
                                  onToggleEdit={() => toggleEdit(day.date, 'afternoonSnackDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'afternoonSnackDiabetic', day.afternoonSnackDiabetic ?? 'Escolher 3 opções...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'afternoonSnackDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'afternoonSnackDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'afternoonSnackDiabetic', e)}
                                  className="editable-cell hover:bg-amber-100 rounded px-0.5 inline-block cursor-pointer"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
                                  {day.afternoonSnackDiabetic ?? 'Escolher 3 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.'}
                                </DraggableCell>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Row 2: JANTAR */}
                    <tr>
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#fef3c7] text-amber-950 w-32 print:static print:border-[1.5px] print:border-black">
                        JANTAR
                      </td>
                      {week.map((day, dayIdx) => (
                        <td
                          key={dayIdx}
                          onDragOver={(e) => day && handleDragMealOver(day.date, 'dinner', e)}
                          onDragLeave={(e) => day && handleDragMealLeave(day.date, 'dinner', e)}
                          onDrop={(e) => day && handleDropMeal(day.date, 'dinner', e)}
                          className={`border border-slate-400 p-2 align-top bg-white transition-all relative print:static print:border-[1.5px] print:border-black ${
                            day && isMealDragging(day.date, 'dinner')
                              ? 'opacity-40 bg-amber-50 ring-2 ring-dashed ring-amber-500'
                              : day && isMealDropTarget(day.date, 'dinner')
                              ? 'bg-amber-100 ring-2 ring-amber-500 scale-[1.01] shadow-lg font-bold'
                              : ''
                          }`}
                        >
                          {day && (
                            <div className="space-y-1.5">
                              {/* Draggable handle for whole Dinner */}
                              <div
                                draggable
                                onDragStart={(e) => handleDragMealStart(day.date, 'dinner', e)}
                                onDragEnd={handleDragEnd}
                                className="flex items-center justify-between px-1.5 py-0.5 mb-1 rounded bg-amber-100/80 hover:bg-amber-200 text-amber-950 font-semibold cursor-grab active:cursor-grabbing text-[9px] transition-all no-print select-none border border-amber-300/70 shadow-xs group"
                                title="Arraste para trocar todo o Jantar deste dia com outro dia"
                              >
                                <span className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>Mover Jantar Completo</span>
                                </span>
                                <ArrowLeftRight className="w-2.5 h-2.5 text-amber-700 opacity-60 group-hover:opacity-100" />
                              </div>

                              {/* Editable Dinner */}
                              <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                <DraggableCell
                                  as="p"
                                  date={day.date}
                                  field="dinner"
                                  value={day.dinner}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'dinner'}
                                  isDragging={isCellDragging(day.date, 'dinner')}
                                  isDropTarget={isCellDropTarget(day.date, 'dinner')}
                                  onToggleEdit={() => toggleEdit(day.date, 'dinner')}
                                  onDragStart={(e) => handleDragStart(day.date, 'dinner', day.dinner, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'dinner', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'dinner', e)}
                                  onDrop={(e) => handleDrop(day.date, 'dinner', e)}
                                  className="text-[11px] leading-tight font-semibold uppercase text-slate-900 cursor-pointer hover:bg-orange-100 rounded px-0.5 transition-colors"
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

                              {/* Optional extra item(s) — cardápio normal */}
                              <MealExtras
                                extras={day.extras?.dinner ?? []}
                                dishOptions={allDishOptions}
                                onAdd={(text, dishId) => addExtraItem(day.date, 'dinner', text, dishId)}
                                onUpdate={(itemId, text) => updateExtraItem(day.date, 'dinner', itemId, text)}
                                onRemove={(itemId) => removeExtraItem(day.date, 'dinner', itemId)}
                              />

                              <div className="text-[9.5px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="dinnerDiabetic"
                                  value={day.dinnerDiabetic || 'Repetir o almoço...'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'dinnerDiabetic'}
                                  isDragging={isCellDragging(day.date, 'dinnerDiabetic')}
                                  isDropTarget={isCellDropTarget(day.date, 'dinnerDiabetic')}
                                  onToggleEdit={() => toggleEdit(day.date, 'dinnerDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'dinnerDiabetic', day.dinnerDiabetic || 'Repetir o almoço...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'dinnerDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'dinnerDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'dinnerDiabetic', e)}
                                  className="editable-cell hover:bg-orange-100 rounded px-0.5 inline-block cursor-pointer"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
                      <td className="border border-slate-400 p-2 font-bold text-center align-middle bg-[#fae8ff] text-purple-950 w-32 print:static print:border-[1.5px] print:border-black">
                        CEIA
                      </td>
                      {week.map((day, dayIdx) => (
                        <td
                          key={dayIdx}
                          onDragOver={(e) => day && handleDragMealOver(day.date, 'supper', e)}
                          onDragLeave={(e) => day && handleDragMealLeave(day.date, 'supper', e)}
                          onDrop={(e) => day && handleDropMeal(day.date, 'supper', e)}
                          className={`border border-slate-400 p-2 align-top bg-white transition-all relative print:static print:border-[1.5px] print:border-black ${
                            day && isMealDragging(day.date, 'supper')
                              ? 'opacity-40 bg-purple-50 ring-2 ring-dashed ring-purple-500'
                              : day && isMealDropTarget(day.date, 'supper')
                              ? 'bg-amber-100 ring-2 ring-amber-500 scale-[1.01] shadow-lg font-bold'
                              : ''
                          }`}
                        >
                          {day && (
                            <div className="space-y-2">
                              {/* Draggable handle for whole Supper */}
                              <div
                                draggable
                                onDragStart={(e) => handleDragMealStart(day.date, 'supper', e)}
                                onDragEnd={handleDragEnd}
                                className="flex items-center justify-between px-1.5 py-0.5 mb-1 rounded bg-purple-100/80 hover:bg-purple-200 text-purple-950 font-semibold cursor-grab active:cursor-grabbing text-[9px] transition-all no-print select-none border border-purple-300/70 shadow-xs group"
                                title="Arraste para trocar toda a Ceia deste dia com outro dia"
                              >
                                <span className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-purple-700 shrink-0" />
                                  <span>Mover Ceia Completa</span>
                                </span>
                                <ArrowLeftRight className="w-2.5 h-2.5 text-purple-700 opacity-60 group-hover:opacity-100" />
                              </div>

                              {/* Editable Supper */}
                              <div className="editable-cell p-0.5 rounded -mx-0.5 print:m-0">
                                <DraggableCell
                                  as="p"
                                  date={day.date}
                                  field="supper"
                                  value={day.supper}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'supper'}
                                  isDragging={isCellDragging(day.date, 'supper')}
                                  isDropTarget={isCellDropTarget(day.date, 'supper')}
                                  onToggleEdit={() => toggleEdit(day.date, 'supper')}
                                  onDragStart={(e) => handleDragStart(day.date, 'supper', day.supper, e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'supper', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'supper', e)}
                                  onDrop={(e) => handleDrop(day.date, 'supper', e)}
                                  className="text-[11px] leading-tight cursor-pointer hover:bg-purple-100 rounded px-0.5 transition-colors"
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

                              {/* Optional extra item(s) — cardápio normal */}
                              <MealExtras
                                extras={day.extras?.supper ?? []}
                                dishOptions={allDishOptions}
                                onAdd={(text, dishId) => addExtraItem(day.date, 'supper', text, dishId)}
                                onUpdate={(itemId, text) => updateExtraItem(day.date, 'supper', itemId, text)}
                                onRemove={(itemId) => removeExtraItem(day.date, 'supper', itemId)}
                              />

                              <div className="text-[9.5px] leading-tight text-red-800">
                                <span className="font-bold">Diabéticos:</span>{' '}
                                <DraggableCell
                                  as="span"
                                  date={day.date}
                                  field="supperDiabetic"
                                  value={day.supperDiabetic ?? 'Mingau de aveia...'}
                                  isEditing={editingCell?.date === day.date && editingCell?.field === 'supperDiabetic'}
                                  isDragging={isCellDragging(day.date, 'supperDiabetic')}
                                  isDropTarget={isCellDropTarget(day.date, 'supperDiabetic')}
                                  onToggleEdit={() => toggleEdit(day.date, 'supperDiabetic')}
                                  onDragStart={(e) => handleDragStart(day.date, 'supperDiabetic', day.supperDiabetic ?? 'Mingau...', e)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(day.date, 'supperDiabetic', e)}
                                  onDragLeave={(e) => handleDragLeave(day.date, 'supperDiabetic', e)}
                                  onDrop={(e) => handleDrop(day.date, 'supperDiabetic', e)}
                                  className="editable-cell hover:bg-purple-100 rounded px-0.5 inline-block cursor-pointer"
                                  icon={<Pencil className="w-2 h-2 inline ml-1 opacity-40 no-print shrink-0" />}
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
