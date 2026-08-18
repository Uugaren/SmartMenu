// ============================================================================
// Smart Menu — Motor de Geração de Cardápios
// Gera cardápio mensal completo combinando regras + pratos do tenant
// ============================================================================

import {
  getDaysInMonth,
  startOfMonth,
  addDays,
  getDay,
  format,
} from 'date-fns';

import type { Dish, DailyMeal, Tenant } from './types';
import {
  getBreakfast,
  getBreakfastDiabetic,
  getBreakfastPastoso,
  getColacao,
  getJuice,
  getDessert,
  getAfternoonSnack,
  getAfternoonSnackDiabetic,
  getDinner,
  getDinnerDiabetic,
  getSupper,
  LUNCH_SIDE,
} from './menuRules';

/**
 * Calcula qual semana do mês (1-5) um dia pertence.
 * Baseado em quantos domingos já passaram.
 */
function getWeekOfMonth(date: Date): number {
  const start = startOfMonth(date);
  let sundayCount = 0;
  let current = start;

  while (current <= date) {
    if (getDay(current) === 0) {
      sundayCount++;
    }
    current = addDays(current, 1);
  }

  return Math.max(1, sundayCount);
}

/**
 * Gera o cardápio completo para um mês.
 *
 * @param tenant - Tenant (casa de repouso)
 * @param dishes - Lista de pratos do tenant (vindos do banco)
 * @param year - Ano (ex: 2026)
 * @param month - Mês (1-12)
 * @returns Array de DailyMeal para cada dia do mês
 */
export function generateMonthlyMenu(
  tenant: Tenant,
  dishes: Dish[],
  year: number,
  month: number
): DailyMeal[] {
  const totalDays = getDaysInMonth(new Date(year, month - 1));
  const mainDishes = dishes.filter((d) => d.category === 'prato_principal');
  const salads = dishes.filter((d) => d.category === 'salada');

  const dailyMeals: DailyMeal[] = [];
  let sundayCounter = 0; // Conta domingos para rotação de mousses

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = getDay(date); // 0=Dom, 6=Sáb
    const dayIndex = day - 1;
    const weekOfMonth = getWeekOfMonth(date);

    if (dayOfWeek === 0) {
      sundayCounter++;
    }

    // Almoço: prato principal rotativo
    const mainDish = mainDishes.length > 0
      ? mainDishes[dayIndex % mainDishes.length]
      : null;

    // Salada rotativa
    const salad = salads.length > 0
      ? salads[dayIndex % salads.length]
      : null;

    const meal: DailyMeal = {
      date: format(date, 'yyyy-MM-dd'),
      dayOfWeek,
      weekOfMonth,

      // Café da manhã
      breakfast: getBreakfast(dayIndex),
      breakfastDiabetic: getBreakfastDiabetic(dayIndex),
      breakfastPastoso: getBreakfastPastoso(dayIndex),

      // Colação
      colacao: getColacao(dayIndex),

      // Almoço
      lunchMain: mainDish?.name ?? 'A definir',
      lunchMainDishId: mainDish?.id ?? null,
      lunchSalad: salad?.name ?? 'Salada do dia',
      lunchSide: LUNCH_SIDE,
      juice: getJuice(dayIndex),
      dessert: getDessert(dayOfWeek, sundayCounter - 1),
      lunchDiabetic: 'Colocar mais folhas cruas ½ porção de cada carboidratos, se houver mais de 1 opção.',
      lunchPastoso: 'colocar módulo de fibras (1 colher de chá)',

      // Lanche da tarde
      afternoonSnack: getAfternoonSnack(dayOfWeek, weekOfMonth),
      afternoonSnackDiabetic: getAfternoonSnackDiabetic(dayOfWeek),

      // Jantar
      dinner: getDinner(dayIndex),
      dinnerDiabetic: getDinnerDiabetic(),

      // Ceia
      supper: getSupper(dayIndex),
      supperDiabetic: 'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.',
    };

    dailyMeals.push(meal);
  }

  return dailyMeals;
}

/**
 * Organiza os dias em semanas para exibição no grid.
 * Cada semana tem 7 slots (Dom-Sáb), com null para dias fora do mês.
 */
export function organizeIntoWeeks(days: DailyMeal[]): (DailyMeal | null)[][] {
  if (days.length === 0) return [];

  const firstDayOfWeek = days[0].dayOfWeek;
  const weeks: (DailyMeal | null)[][] = [];
  let currentWeek: (DailyMeal | null)[] = [];

  // Preenche o início da primeira semana com nulls
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Preenche o final da última semana com nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}
