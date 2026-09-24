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
  NUTRITIONIST_LUNCH_DIABETIC,
  NUTRITIONIST_LUNCH_PASTOSO,
  NUTRITIONIST_SUPPER_DIABETIC,
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

interface NutritionistDailyPlan {
  lunchMain: string;
  lunchSide: string;
  lunchSalad: string;
  juice: string;
}

// Cardápio fiel de Agosto de Vida Plena / Vovó Alda (do PDF original da Nutricionista)
export const NUTRITIONIST_VIDA_PLENA_DAYS: Record<number, NutritionistDailyPlan> = {
  1: {
    lunchMain: 'ESCONDIDINHO DE FRANGO',
    lunchSide: 'Arroz /Feijão',
    lunchSalad: 'Abóbora cozida, Salada de repolho roxo, tomate',
    juice: 'Suco de Abacaxi',
  },
  2: {
    lunchMain: 'COXA E SOBRECOXA ASSADA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'LEGUMES (CHUCHU E BATATA), Cenoura ralada',
    juice: 'suco de abacaxi',
  },
  3: {
    lunchMain: 'MÚSCULO ENSOPADO COM CHUCHU E CENOURA COZIDO',
    lunchSide: 'Arroz com açafrão, Feijão caldo',
    lunchSalad: 'Salada de alface',
    juice: 'Suco acerola',
  },
  4: {
    lunchMain: 'PEIXE EMPANADO (CAÇÃO) E PIRÃO',
    lunchSide: 'Arroz/Feijão (opcional)',
    lunchSalad: 'salada de repolho verde, banana frita',
    juice: 'suco de abacaxi',
  },
  5: {
    lunchMain: 'DOBRADINHA COM FEIJÃO BRANCO',
    lunchSide: 'Arroz colorido (pimentão colorido), feijão',
    lunchSalad: 'FAROFA DE BANANA, ALFACE E PEPINO',
    juice: 'Suco de acerola',
  },
  6: {
    lunchMain: 'ACÉM CUBOS COM BATATA',
    lunchSide: 'Arroz com cenoura picadinha e cozida/Feijão',
    lunchSalad: 'Salada de alface',
    juice: 'Suco de manga',
  },
  7: {
    lunchMain: 'CARNE DE PORCO PICADINHA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Purê de batatas cremoso, Alface e BETERRABA cozida',
    juice: 'Suco de Manga',
  },
  8: {
    lunchMain: 'ESCONDIDINHO DE CARNE SECA',
    lunchSide: 'Arroz/ feijão (opcional)',
    lunchSalad: 'abobrinha e chuchu cozidos',
    juice: 'suco de manga',
  },
  9: {
    lunchMain: 'PEIXE EMPANADO E PIRÃO',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'TABULE',
    juice: 'Suco de abacaxi',
  },
  10: {
    lunchMain: 'FRICASSÉ DE FRANGO',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Vagem refogada, Repolho roxo picadinho',
    juice: 'suco de goiaba',
  },
  11: {
    lunchMain: 'ALMÔNDEGAS AO MOLHO COM TEMPERO VERDE E ORÉGANO',
    lunchSide: 'Arroz/ feijão, macarrão ao alho e óleo',
    lunchSalad: 'jiló e cenoura cozida',
    juice: 'Suco abacaxi',
  },
  12: {
    lunchMain: 'LINGUIÇA DE CHURRASCO E PURÊ DE BATATA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Chuchu e beterraba cozidos',
    juice: 'Suco de goiaba',
  },
  13: {
    lunchMain: 'LASANHA DE FRANGO COM MUSSARELA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'abóbora cozida e salada de agrião com alface',
    juice: 'Suco de goiaba',
  },
  14: {
    lunchMain: 'SOBRECOXA ASSADA E PURÊ DE BATATA',
    lunchSide: 'Arroz, Feijão tropeiro',
    lunchSalad: 'salada de agrião e pepino',
    juice: 'suco de acerola',
  },
  15: {
    lunchMain: 'CARNE DE PORCO EM CUBOS ENSOPADA COM TOMATE, PIMENTÃO COLORIDO',
    lunchSide: 'Arroz, tutu',
    lunchSalad: 'pepino e alface',
    juice: 'suco de acerola',
  },
  16: {
    lunchMain: 'MÚSCULO ENSOPADO E PURÊ DE INHAME',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Salada de Agrião e couve, melão',
    juice: 'Suco abacaxi',
  },
  17: {
    lunchMain: 'FRANGO COM QUIABO E POLENTA',
    lunchSide: 'Arroz / Feijão',
    lunchSalad: 'Couve refogada',
    juice: 'Suco de Abacaxi',
  },
  18: {
    lunchMain: 'BIFE À PIZZAIOLO E CREME DE MILHO',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'abobrinha cozida',
    juice: 'Suco de abacaxi',
  },
  19: {
    lunchMain: 'MOQUECA DE PEIXE',
    lunchSide: 'arroz/ feijão',
    lunchSalad: 'Vinagrete de lentilha, moqueca de banana',
    juice: 'suco de abacaxi',
  },
  20: {
    lunchMain: 'STROGONOFF DE FRANGO',
    lunchSide: 'arroz/ feijão',
    lunchSalad: 'vagem cozida, Salada de agrião e tomate, Melão',
    juice: 'Suco de manga',
  },
  21: {
    lunchMain: 'PALETA EM TIRAS PEQUENAS NA PRESSÃO E SUFLÊ DE CHUCHU',
    lunchSide: 'Arroz, feijão',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de goiaba',
  },
  22: {
    lunchMain: 'FRANGO XADREZ (PIMENTÃO AMARELO, CENOURA, BRÓCOLIS)',
    lunchSide: 'Arroz com ervilha, Feijão',
    lunchSalad: 'salada de agrião e pepino',
    juice: 'suco de acerola',
  },
  23: {
    lunchMain: 'CASSOULET E BANANA DA TERRA FRITA',
    lunchSide: 'Arroz',
    lunchSalad: 'Maxixe ensopado, Melão',
    juice: 'Suco de manga',
  },
  24: {
    lunchMain: 'PANQUECA DE CARNE MOÍDA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Abobrinha refogada, Pepino e alface',
    juice: 'Suco de abacaxi',
  },
  25: {
    lunchMain: 'CARNE SECA COM ABÓBORA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'chuchu e beterraba, Mamão',
    juice: 'Suco abacaxi',
  },
  26: {
    lunchMain: 'MACARRONADA À BOLONHESA',
    lunchSide: 'Massa',
    lunchSalad: 'SALADA DE ALFACE/ RÚCULA E MANGA',
    juice: 'Suco abacaxi',
  },
  27: {
    lunchMain: 'CARNE DE PORCO PICADINHA COM TOMATE E TUTU À MINEIRA',
    lunchSide: 'Arroz / tutu à mineira',
    lunchSalad: 'Beterraba cozida',
    juice: 'suco de acerola',
  },
  28: {
    lunchMain: 'PEIXE EMPANADO (CAÇÃO) E RATATOUILLE',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'RATATOUILLE',
    juice: 'Suco de goiaba',
  },
  29: {
    lunchMain: 'SOBRECOXA ASSADA E PURÊ DE BATATAS',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'jiló ensopadinho, Cenoura cozida picada',
    juice: 'Suco de manga',
  },
  30: {
    lunchMain: 'BOBÓ DE CAMARÃO E BANANA FRITA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'abobrinha cozida, SALADA DE FOLHAS',
    juice: 'Suco de abacaxi',
  },
  31: {
    lunchMain: 'CARNE MOÍDA COM LEGUMES (CHUCHU E CENOURA)',
    lunchSide: 'Arroz/ feijão, macarrão ao alho e óleo',
    lunchSalad: 'Salada de folhas',
    juice: 'suco de abacaxi',
  },
};

// Cardápio fiel de Agosto para Casa de Repouso Vovó Alda (idêntico ao de Vida Plena no documento da nutróloga)
export const NUTRITIONIST_VOVO_ALDA_DAYS: Record<number, NutritionistDailyPlan> = NUTRITIONIST_VIDA_PLENA_DAYS;

// Cardápio fiel de Agosto para LARES Casa de Repouso (Semanas 1, 2, 3A, 4A e 5A do documento original)
export const NUTRITIONIST_LARES_DAYS: Record<number, NutritionistDailyPlan> = {
  1: {
    lunchMain: 'PEIXE EMPANADO',
    lunchSide: 'Arroz/Feijão (opcional), Pirão',
    lunchSalad: 'banana frita, Alface e tomate',
    juice: 'Suco de manga',
  },
  2: {
    lunchMain: 'ESCONDIDINHO DE CARNE MOÍDA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Legumes grelhados na manteiga(brócolis, couve flor e abobrinha), Alface e tomate',
    juice: 'Suco de abacaxi',
  },
  3: {
    lunchMain: 'CARNE DE PORCO',
    lunchSide: 'Arroz/ tutu a mineira',
    lunchSalad: 'Jiló refogado, alface e tomate',
    juice: 'Suco de goiaba',
  },
  4: {
    lunchMain: 'SOBRECOXA ASSADA COM BATATA',
    lunchSide: 'Arroz / Feijão, macarrão ao molho branco e ervas finas',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de Abacaxi',
  },
  5: {
    lunchMain: 'ESTROGONOFE DE FRANGO',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'cenoura sauté, Alface e tomate',
    juice: 'Suco de abacaxi',
  },
  6: {
    lunchMain: 'MÚSCULO EM CUBOS',
    lunchSide: 'Arroz com cenoura picadinha e cozida/Feijão, Purê de batata',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de manga',
  },
  7: {
    lunchMain: 'OMELETE DE QUEIJO',
    lunchSide: 'Arroz/ feijão, maionese',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de acerola',
  },
  8: {
    lunchMain: 'SOBRECOXA ASSADA',
    lunchSide: 'Arroz/ feijão, PURÊ DE INHAME',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de abacaxi',
  },
  9: {
    lunchMain: 'LASANHA DE CARNE MOÍDA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'brócolis refogado na manteiga, Alface e tomate',
    juice: 'Suco de goiaba',
  },
  10: {
    lunchMain: 'ESTROGONOFF DE BOI (PALETA NA PRESSÃO)',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'vagem refogada, alface e tomate',
    juice: 'Suco de goiaba',
  },
  11: {
    lunchMain: 'MÚSCULO ENSOPADO COM BATATA',
    lunchSide: 'Arroz/ feijão, farofa de banana',
    lunchSalad: 'alface e tomate',
    juice: 'Suco de abacaxi',
  },
  12: {
    lunchMain: 'OMELETE DE FORNO (QUEIJO PRA GRATINAR)',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'seleta de legumes (3 no máximo), alface e tomate',
    juice: 'Suco de goiaba',
  },
  13: {
    lunchMain: 'PEIXE EMPANADO',
    lunchSide: 'Arroz/ feijão, pirão',
    lunchSalad: 'Moqueca de Banana, Alface e tomate',
    juice: 'Suco de abacaxi',
  },
  14: {
    lunchMain: 'FEIJOADA (CARNE DE PORCO, LINGUIÇA)',
    lunchSide: 'Arroz',
    lunchSalad: 'couve refogada, alface e tomate',
    juice: 'Suco de manga',
  },
  15: {
    lunchMain: 'MÚSCULO ENSOPADO',
    lunchSide: 'Arroz/ feijão (opcional), purê de inhame',
    lunchSalad: 'couve flor na manteiga, Alface e tomate',
    juice: 'Suco de manga',
  },
  16: {
    lunchMain: 'ESCONDIDINHO DE CARNE MOÍDA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'repolho roxo refogado com manjericão, alface e tomate',
    juice: 'Suco de abacaxi',
  },
  17: {
    lunchMain: 'OMELETE COM QUEIJO',
    lunchSide: 'Arroz /Feijão',
    lunchSalad: 'Seleta de legumes (3 no máximo), Alface e tomate',
    juice: 'Suco de goiaba',
  },
  18: {
    lunchMain: 'COXA E SOBRECOXA ASSADA COM BATATA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'jiló ensopado, Alface e tomate',
    juice: 'Suco de goiaba',
  },
  19: {
    lunchMain: 'CARNE DE PORCO EM CUBOS',
    lunchSide: 'Arroz, feijão, tutu à mineira',
    lunchSalad: 'beterraba cozida, Alface e tomate',
    juice: 'Suco de acerola',
  },
  20: {
    lunchMain: 'STROGONOFF DE FRANGO',
    lunchSide: 'Arroz/ feijão, batata palha',
    lunchSalad: 'abobrinha cozida, Alface e tomate',
    juice: 'Suco de abacaxi',
  },
  21: {
    lunchMain: 'MOQUECA DE PEIXE',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'banana frita, alface e tomate',
    juice: 'Suco de abacaxi',
  },
  22: {
    lunchMain: 'CARNE DE PORCO EM CUBOS',
    lunchSide: 'Arroz, Tutu à mineira',
    lunchSalad: 'couve refogada, Alface e tomate',
    juice: 'Suco de acerola',
  },
  23: {
    lunchMain: 'ESCONDIDINHO DE CARNE MOÍDA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Brócolis na manteiga, Alface e tomate',
    juice: 'Suco de manga',
  },
  24: {
    lunchMain: 'OMELETE DE QUEIJO',
    lunchSide: 'Arroz / feijão',
    lunchSalad: 'Seleta de legumes (3 no máximo), alface e tomate',
    juice: 'Suco de acerola',
  },
  25: {
    lunchMain: 'PALETA EM TIRAS PEQUENAS NA PRESSÃO',
    lunchSide: 'Arroz, feijão, purê de aipim',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de goiaba',
  },
  26: {
    lunchMain: 'MACARRONADA BOLONHESA (AZEITONA, MILHO E MANJERICÃO)',
    lunchSide: 'Arroz /Feijão',
    lunchSalad: 'Cenoura na manteiga, Alface e tomate',
    juice: 'Suco de goiaba',
  },
  27: {
    lunchMain: 'FRANGO COM QUIABO',
    lunchSide: 'Arroz/ feijão, Polenta',
    lunchSalad: 'Jiló ensopada, Salada de alface e tomate',
    juice: 'Suco de manga',
  },
  28: {
    lunchMain: 'MÚSCULO ENSOPADO',
    lunchSide: 'Arroz/feijão, Farofa de banana',
    lunchSalad: 'beterraba cozida, Alface e tomate',
    juice: 'Suco de Manga',
  },
  29: {
    lunchMain: 'SOBRECOXA ASSADA ENSOPADA',
    lunchSide: 'Arroz/ feijão',
    lunchSalad: 'Jiló picadinho, alface e tomate',
    juice: 'Suco de acerola',
  },
  30: {
    lunchMain: 'STROGONOFF DE FRANGO',
    lunchSide: 'Arroz/ feijão, batata palha',
    lunchSalad: 'beterraba cozida, Alface e tomate',
    juice: 'Suco de abacaxi',
  },
  31: {
    lunchMain: 'CARNE MOÍDA COM CENOURA',
    lunchSide: 'Arroz/ feijão, purê de batata',
    lunchSalad: 'Alface e tomate',
    juice: 'Suco de abacaxi',
  },
};

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

    const planIndex = ((day - 1) % 31) + 1;
    let nutritionistPlan: NutritionistDailyPlan | null = null;

    if (tenant.slug === 'lares') {
      nutritionistPlan = NUTRITIONIST_LARES_DAYS[planIndex];
    } else if (tenant.slug === 'vida-plena') {
      nutritionistPlan = NUTRITIONIST_VIDA_PLENA_DAYS[planIndex];
    } else if (tenant.slug === 'vovo-alda') {
      nutritionistPlan = NUTRITIONIST_VOVO_ALDA_DAYS[planIndex];
    } else {
      nutritionistPlan = NUTRITIONIST_LARES_DAYS[planIndex] || NUTRITIONIST_VIDA_PLENA_DAYS[planIndex];
    }

    // Almoço: prato principal — SEMPRE prioriza o cardápio fixo e validado da nutróloga
    // para o dia/tenant. Os pratos cadastrados no Supabase (`dishes`) só servem de
    // fallback quando não há plano fixo para aquele dia (e como sugestão nos dropdowns
    // de edição manual, ver getOptionsForField na tela do editor).
    const mainDish = nutritionistPlan
      ? { name: nutritionistPlan.lunchMain, id: null as string | null }
      : (mainDishes.length > 0 ? mainDishes[dayIndex % mainDishes.length] : null);

    // Salada — mesma prioridade: plano fixo da nutróloga primeiro, Supabase como fallback
    const salad = nutritionistPlan
      ? nutritionistPlan.lunchSalad
      : (salads.length > 0 ? salads[dayIndex % salads.length]?.name : 'Salada do dia');

    // Acompanhamento
    const lunchSide = nutritionistPlan ? nutritionistPlan.lunchSide : LUNCH_SIDE;

    // Suco
    const juice = nutritionistPlan ? nutritionistPlan.juice : getJuice(dayIndex);

    const meal: DailyMeal = {
      date: format(date, 'yyyy-MM-dd'),
      dayOfWeek,
      weekOfMonth,

      // Café da manhã
      breakfast: getBreakfast(day),
      breakfastDiabetic: getBreakfastDiabetic(day),
      breakfastPastoso: getBreakfastPastoso(day),

      // Colação
      colacao: getColacao(day),

      // Almoço
      lunchMain: mainDish?.name ?? 'A definir',
      lunchMainDishId: mainDish?.id ?? null,
      lunchSalad: salad ?? 'Salada do dia',
      lunchSide: lunchSide,
      juice: juice,
      dessert: getDessert(dayOfWeek, sundayCounter - 1),
      lunchDiabetic: NUTRITIONIST_LUNCH_DIABETIC,
      lunchPastoso: NUTRITIONIST_LUNCH_PASTOSO,

      // Lanche da tarde
      afternoonSnack: getAfternoonSnack(day, dayOfWeek, weekOfMonth),
      afternoonSnackDiabetic: getAfternoonSnackDiabetic(),

      // Jantar
      dinner: getDinner(day),
      dinnerDiabetic: getDinnerDiabetic(),

      // Ceia
      supper: getSupper(day),
      supperDiabetic: NUTRITIONIST_SUPPER_DIABETIC,
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
