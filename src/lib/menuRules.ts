// ============================================================================
// Smart Menu — Regras de Negócio do Cardápio
// Todas as regras clínicas e rotativas codificadas 100% fieis à nutróloga
// ============================================================================

// ============================================================================
// CAFÉ DA MANHÃ & COLAÇÃO
// ============================================================================

/** Frutas de café da manhã / colação dia a dia (ciclo de 31 dias extraído dos documentos da nutróloga) */
export const NUTRITIONIST_BREAKFAST_FRUITS_31: Record<number, string> = {
  1: 'Mamão picado',
  2: 'Banana',
  3: 'Melão',
  4: 'Manga',
  5: 'Melão',
  6: 'Banana',
  7: 'Mamão',
  8: 'Melão',
  9: 'Banana',
  10: 'Mamão',
  11: 'Manga',
  12: 'Banana',
  13: 'Mamão',
  14: 'Banana',
  15: 'Melão',
  16: 'Banana',
  17: 'Mamão',
  18: 'Manga',
  19: 'Melão',
  20: 'Banana',
  21: 'Mamão',
  22: 'Melão',
  23: 'Banana',
  24: 'Mamão',
  25: 'Manga',
  26: 'Banana',
  27: 'Mamão',
  28: 'Banana',
  29: 'Melão',
  30: 'Banana',
  31: 'Melão',
};

export const BREAKFAST_FRUITS = ['Mamão', 'Banana', 'Melão', 'Manga'];

/** Café da manhã padrão */
export function getBreakfast(dayOfMonth: number): string {
  return 'Pão francês/Doce com manteiga Café com leite';
}

/** Café da manhã diabéticos (dia a dia da nutróloga) */
export function getBreakfastDiabetic(dayOfMonth: number): string {
  const dayIndex = ((dayOfMonth - 1) % 31) + 1;
  const queijoMinasDays = [2, 5, 8, 12, 16, 18, 20, 23, 25, 27];
  if (queijoMinasDays.includes(dayIndex)) {
    return 'Pão de forma integral com queijo minas e uma ponta de colher de manteiga Café com leite e adoçante.';
  }
  return 'Pão de forma integral com ovo Café com leite e adoçante.';
}

/** Café da manhã e lanche para pastosos */
export const NUTRITIONIST_PASTOSO_BREAKFAST =
  'Mingau de farinha de aveia( diabéticos), farinha de tapioca, farinha de arroz,, vitamina, fubá com aveia.';

export const PASTOSO_MINGAUS = [
  'Mingau de farinha de aveia',
  'Mingau de farinha de tapioca',
  'Mingau de farinha de arroz',
  'Mingau de fubá com aveia',
  'Vitamina',
];

export function getBreakfastPastoso(dayOfMonth: number): string {
  return NUTRITIONIST_PASTOSO_BREAKFAST;
}

// ============================================================================
// COLAÇÃO
// ============================================================================

export function getColacao(dayOfMonth: number): string {
  const dayIndex = ((dayOfMonth - 1) % 31) + 1;
  return NUTRITIONIST_BREAKFAST_FRUITS_31[dayIndex] || BREAKFAST_FRUITS[(dayIndex - 1) % BREAKFAST_FRUITS.length];
}

// ============================================================================
// SUCOS (rotativo)
// ============================================================================

export const JUICES = ['Suco de Abacaxi', 'Suco de Manga', 'Suco de Goiaba', 'Suco de Acerola', 'Suco de Uva'];

export function getJuice(dayIndex: number): string {
  return JUICES[dayIndex % JUICES.length];
}

// ============================================================================
// SOBREMESAS (regra por dia da semana conforme anotações da nutróloga)
// ============================================================================

export const MOUSSES = [
  'Mousse de Chocolate',
  'Mousse de Morango',
  'Mousse de Limão',
  'Mousse de Maracujá',
];

/**
 * Regra de sobremesa por dia da semana da nutróloga:
 * - Domingo (0): Mousse (Chocolate, Morango, Limão e Maracujá)
 * - Sábado (6), Segunda (1), Quarta (3) e Sexta (5): Gelatina
 * - Terça (2) e Quinta (4): Fruta
 */
export function getDessert(dayOfWeek: number, sundayIndex: number): string {
  switch (dayOfWeek) {
    case 0: // Domingo
      return MOUSSES[Math.max(0, sundayIndex) % MOUSSES.length];
    case 2: // Terça
    case 4: // Quinta
      return 'Fruta';
    default: // Seg, Qua, Sex, Sáb
      return 'Gelatina';
  }
}

// ============================================================================
// LANCHE DA TARDE (31 dias conforme tabelas da nutróloga)
// ============================================================================

export const NUTRITIONIST_AFTERNOON_SNACKS_31: Record<number, string> = {
  1: 'Pão francês/doce com manteiga Café com leite',
  2: 'Pão e ovos mexidos; Café com leite',
  3: 'Pão francês/doce; Patê de sardinha; Café com leite',
  4: 'Batata doce, aipim ou banana da terra cozida com canela; Café com leite',
  5: 'Café com leite; pão francês com manteiga',
  6: 'Ovos mexidos e Pão doce; Café com leite',
  7: 'Pão francês com manteiga; Café com leite',
  8: 'Pão francês / Doce com manteiga; Café com leite',
  9: 'Pão francês/ doce com manteiga; Café com leite',
  10: 'Pão francês/ doce com manteiga; Café com leite',
  11: 'Batata doce, aipim cozido ou banana da terra cozida; Café com leite',
  12: 'Pão francês com manteiga; Café com leite',
  13: 'Pão francês / Doce com manteiga; Café com leite',
  14: 'Pão francês / doce com manteiga; Café com leite',
  15: 'Pão francês / doce com manteiga; Café com leite',
  16: 'Pão francês / doce com manteiga; Café com leite',
  17: 'Pão francês/ doce com manteiga; café com leite',
  18: 'Pão francês/ doce com manteiga; café com leite',
  19: 'Pão francês com manteiga; Café com leite',
  20: 'Pão francês/ doce com manteiga; café com leite',
  21: 'Pão francês com manteiga; Café com leite',
  22: 'Pão francês / Doce com manteiga; Café com leite',
  23: 'Pão francês/ doce com manteiga; Café com leite',
  24: 'Pão francês/ doce com manteiga; Café com leite',
  25: 'Pão francês/ doce com manteiga; Café com leite',
  26: 'Pão francês com manteiga; Café com leite',
  27: 'Pão francês / Doce com manteiga; Café com leite',
  28: 'Pão francês / doce com manteiga; Café com leite',
  29: 'Pão francês / Doce com manteiga; Café com leite',
  30: 'Pão francês/ doce com manteiga; Café com leite',
  31: 'Pão francês/ doce com manteiga; Café com leite',
};

export function getAfternoonSnack(dayOfMonth: number, dayOfWeek?: number, weekOfMonth?: number): string {
  const dayIndex = ((dayOfMonth - 1) % 31) + 1;
  return NUTRITIONIST_AFTERNOON_SNACKS_31[dayIndex] || 'Pão francês/doce com manteiga Café com leite';
}

/** Lanche da tarde para diabéticos (texto exato da nutróloga) */
export const NUTRITIONIST_SNACK_DIABETIC =
  'Escolher 3 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.';

export function getAfternoonSnackDiabetic(): string {
  return NUTRITIONIST_SNACK_DIABETIC;
}

// ============================================================================
// JANTAR — CALDOS E SOPAS (31 dias exatos da nutróloga)
// ============================================================================

export const NUTRITIONIST_DINNERS_31: Record<number, string> = {
  1: 'Sopa de macarrão com legumes e frango desfiado',
  2: 'Caldo de legumes',
  3: 'Caldo de inhame com carne moída',
  4: 'Caldo de legumes com frango',
  5: 'Caldo de inhame com carne desfiada',
  6: 'Caldo de feijão com temperos verdes',
  7: 'Caldo verde',
  8: 'Caldo de abóbora com carne moída',
  9: 'Caldo de legumes',
  10: 'Canjiquinha com frango desfiado',
  11: 'Caldo de feijão com linguicinha e temperos verdes',
  12: 'Caldo canjiquinha',
  13: 'Caldo de inhame com frango e temperos verdes',
  14: 'Caldo verde',
  15: 'Caldo de legumes',
  16: 'Caldo de abóbora com carne moída',
  17: 'Caldo de inhame com frango',
  18: 'Caldo de aipim com frango',
  19: 'Caldo de inhame com couve',
  20: 'Caldo de feijão com temperos verdes',
  21: 'Caldo de frango desfiado c/ legumes e tempero verde',
  22: 'Caldo de abóbora com carne moída',
  23: 'Caldo de aipim com frango desfiada',
  24: 'Caldo duas couves (batata, couve manteiga e couve-flor linguiça e tempero verde)',
  25: 'Caldo de feijão com linguicinha e temperos verdes',
  26: 'Caldo canjiquinha',
  27: 'Caldo de inhame com frango e temperos verdes',
  28: 'Caldo verde',
  29: 'Caldo de abóbora com carne moída',
  30: 'Caldo de aipim com frango desfiada',
  31: 'Caldo duas couves (batata, couve manteiga e couve-flor linguiça e tempero verde)',
};

export const SOUPS = Object.values(NUTRITIONIST_DINNERS_31);

export function getDinner(dayOfMonth: number): string {
  const dayIndex = ((dayOfMonth - 1) % 31) + 1;
  return NUTRITIONIST_DINNERS_31[dayIndex] || 'Caldo de legumes';
}

export const NUTRITIONIST_DINNER_DIABETIC =
  'Repetir o almoço, porém ½ porção de carboidratos ou caldo de legumes com módulo de fibras( 1 colher de chá)';

export function getDinnerDiabetic(): string {
  return NUTRITIONIST_DINNER_DIABETIC;
}

// ============================================================================
// CEIA — MINGAUS (31 dias exatos da nutróloga)
// ============================================================================

export const NUTRITIONIST_SUPPERS_31: Record<number, string> = {
  1: 'Mingau de aveia e banana',
  2: 'Mingau de fubá',
  3: 'Mingau de tapioca',
  4: 'Mingau de aveia com canela',
  5: 'Mingau doce de fubá',
  6: 'Mingau de maizena',
  7: 'Mingau de tapioca',
  8: 'Mingau de maisena',
  9: 'Mingau de arroz e canela',
  10: 'Papa de mingau de fubá',
  11: 'Mingau de maisena com canela e banana',
  12: 'Mingau doce de fubá',
  13: 'Mingau de aveia',
  14: 'Mingau de tapioca',
  15: 'Mingau de maisena',
  16: 'Mingau de banana',
  17: 'Mingau de arroz com aveia',
  18: 'Mingau de aveia com canela',
  19: 'Mingau doce de fubá',
  20: 'Mingau de maizena',
  21: 'Mingau de tapioca',
  22: 'Mingau de maisena',
  23: 'Mingau de arroz e canela',
  24: 'Papa de milho com canela',
  25: 'Mingau de maisena com canela e banana',
  26: 'Mingau doce de fubá',
  27: 'Mingau de aveia',
  28: 'Mingau de tapioca',
  29: 'Mingau de maisena',
  30: 'Mingau de arroz e canela',
  31: 'Papa de milho com canela',
};

export const SUPPER_OPTIONS = Object.values(NUTRITIONIST_SUPPERS_31);

export function getSupper(dayOfMonth: number): string {
  const dayIndex = ((dayOfMonth - 1) % 31) + 1;
  return NUTRITIONIST_SUPPERS_31[dayIndex] || 'Mingau de aveia com canela';
}

export const NUTRITIONIST_SUPPER_DIABETIC =
  'Mingau de aveia com adoçante ou Escolher 2 opções: Queijo, Ovo, pão integral, banana cozida com canela e farelo de aveia, batata doce, aipim com queijo minas, café com leite e adoçante, Iogurte diet.';

// ============================================================================
// PRESCRIÇÕES CLÍNICAS GERAIS (ALMOÇO)
// ============================================================================

export const NUTRITIONIST_LUNCH_DIABETIC =
  'Colocar mais folhas cruas 1/2 porção de cada carboidratos, se houver mais de 1 opção.';

export const NUTRITIONIST_LUNCH_PASTOSO =
  'colocar modulo de fibras( 1 colher de chá)';

export const LUNCH_SIDE = 'Arroz / feijão';

