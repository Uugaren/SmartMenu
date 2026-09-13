// ============================================================================
// Smart Menu — Tipos TypeScript
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  created_at: string;
}

export type DishCategory =
  | 'cafe'
  | 'prato_principal'
  | 'salada'
  | 'acompanhamento'
  | 'lanche'
  | 'jantar'
  | 'ceia'
  | 'sobremesa'
  | 'suco';

export interface Dish {
  id: string;
  tenant_id: string | null; // NULL = Aplicável a todas as casas
  category: DishCategory;
  name: string;
  ingredients: string | null;
  created_at: string;
}

export type RuleCategory =
  | 'cafe'
  | 'lanche'
  | 'jantar'
  | 'ceia'
  | 'sobremesa'
  | 'diabeticos'
  | 'pastosos'
  | 'geral';

export interface MenuRule {
  id: string;
  tenant_id: string | null; // NULL = Aplicável a todas as casas
  category: RuleCategory;
  title: string;
  description: string;
  created_at: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'afternoonSnack' | 'dinner' | 'supper';

export interface ExtraMealItem {
  id: string;
  text: string;
  dishId?: string | null;
}

export interface MonthlyMenu {
  id: string;
  tenant_id: string;
  date: string; // YYYY-MM-DD
  lunch_dish_id: string | null;
  lunch_salad: string | null;
  juice: string | null;
  dessert_override: string | null;
  meal_data?: Partial<DailyMeal> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  lunch_dish?: Dish | null;
}

// ============================================================================
// Tipos para geração de cardápio
// ============================================================================

export interface DailyMeal {
  date: string;
  dayOfWeek: number; // 0=Domingo, 6=Sábado
  weekOfMonth: number; // 1-5 (qual semana do mês)

  // Café da manhã
  breakfast: string;
  breakfastDiabetic: string;
  breakfastPastoso: string;

  // Colação
  colacao: string;

  // Almoço
  lunchMain: string;
  lunchMainDishId: string | null;
  lunchSalad: string;
  lunchSide: string; // Arroz + Feijão
  juice: string;
  dessert: string;
  lunchDiabetic?: string;
  lunchPastoso?: string;

  // Lanche da tarde
  afternoonSnack: string;
  afternoonSnackDiabetic: string;

  // Jantar
  dinner: string;
  dinnerDiabetic: string;

  // Ceia
  supper: string;
  supperDiabetic?: string;

  // Itens extras opcionais por refeição (ex: sobremesa a mais no almoço)
  extras?: Partial<Record<MealSlot, ExtraMealItem[]>>;
}

export interface GeneratedMenu {
  tenant: Tenant;
  year: number;
  month: number;
  days: DailyMeal[];
}

export interface WeekRow {
  weekNumber: number;
  days: (DailyMeal | null)[];
}
