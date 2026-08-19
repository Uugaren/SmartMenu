// ============================================================================
// Smart Menu — Regras de Negócio do Cardápio
// Todas as regras clínicas e rotativas codificadas
// ============================================================================

// ============================================================================
// CAFÉ DA MANHÃ
// ============================================================================

/** Frutas rotativas para café da manhã (ciclo de 4 dias) */
export const BREAKFAST_FRUITS = ['Mamão', 'Banana', 'Melão', 'Manga'];

/** Café da manhã padrão */
export function getBreakfast(dayIndex: number): string {
  const fruit = BREAKFAST_FRUITS[dayIndex % BREAKFAST_FRUITS.length];
  return `Pão francês/doce c/ manteiga + Café c/ leite + ${fruit}`;
}

/** Café da manhã diabéticos (alterna entre 2 opções) */
export function getBreakfastDiabetic(dayIndex: number): string {
  const options = [
    'Pão integral c/ ovo + Café c/ leite e adoçante',
    'Pão integral c/ queijo minas e manteiga + Café c/ leite e adoçante',
  ];
  return options[dayIndex % options.length];
}

/** Café da manhã pastosos (mingau rotativo) */
export const PASTOSO_MINGAUS = ['Mingau de aveia', 'Mingau de tapioca', 'Mingau de arroz', 'Mingau de fubá c/ aveia'];

export function getBreakfastPastoso(dayIndex: number): string {
  const mingau = PASTOSO_MINGAUS[dayIndex % PASTOSO_MINGAUS.length];
  return `${mingau} ou Vitamina`;
}

// ============================================================================
// COLAÇÃO
// ============================================================================

export function getColacao(dayIndex: number): string {
  const fruit = BREAKFAST_FRUITS[dayIndex % BREAKFAST_FRUITS.length];
  return `${fruit}`;
}

// ============================================================================
// SUCOS (rotativo)
// ============================================================================

export const JUICES = ['Caju', 'Goiaba', 'Manga', 'Acerola', 'Maracujá'];

export function getJuice(dayIndex: number): string {
  return `Suco de ${JUICES[dayIndex % JUICES.length]}`;
}

// ============================================================================
// SOBREMESAS (regra por dia da semana)
// ============================================================================

const MOUSSES = ['Mousse de Chocolate', 'Mousse de Morango', 'Mousse de Limão', 'Mousse de Maracujá'];

/**
 * Regra de sobremesa por dia da semana:
 * - Domingo (0): Mousse rotativo
 * - Segunda (1), Quarta (3), Sexta (5), Sábado (6): Gelatina
 * - Terça (2) e Quinta (4): Fruta fresca
 */
export function getDessert(dayOfWeek: number, sundayIndex: number): string {
  switch (dayOfWeek) {
    case 0: // Domingo
      return MOUSSES[sundayIndex % MOUSSES.length];
    case 2: // Terça
    case 4: // Quinta
      return 'Fruta fresca';
    default: // Seg, Qua, Sex, Sáb
      return 'Gelatina';
  }
}

// ============================================================================
// LANCHE DA TARDE
// ============================================================================

/**
 * Regras do lanche da tarde:
 * - 1º e 3º Domingo: Empadão
 * - 2º e 4º Domingo: Tortinha de frango
 * - Quarta-feira: Pão com patê
 * - Quinta-feira: Batata-doce, aipim ou banana-da-terra cozida c/ canela
 * - Sexta-feira: Bolo
 * - Outros: Pão com manteiga e café com leite
 */
export function getAfternoonSnack(dayOfWeek: number, weekOfMonth: number): string {
  switch (dayOfWeek) {
    case 0: // Domingo
      if (weekOfMonth === 1 || weekOfMonth === 3) {
        return 'Empadão + Café c/ leite';
      }
      return 'Tortinha de frango + Café c/ leite';
    case 3: // Quarta
      return 'Pão com patê + Café c/ leite';
    case 4: // Quinta
      return 'Batata-doce, aipim ou banana-da-terra cozida c/ canela + Café c/ leite';
    case 5: // Sexta
      return 'Bolo + Café c/ leite';
    default:
      return 'Pão c/ manteiga + Café c/ leite';
  }
}

/** Lanche da tarde para diabéticos */
export function getAfternoonSnackDiabetic(dayOfWeek: number): string {
  const options = [
    'Pão integral c/ queijo',
    'Pão integral c/ ovo',
    'Banana cozida c/ canela (s/ açúcar)',
  ];
  // Rotaciona entre as 3 opções baseado no dia da semana
  return options[dayOfWeek % options.length];
}

// ============================================================================
// JANTAR (sopas rotativas)
// ============================================================================

export const SOUPS = [
  'Caldo de abóbora com carne moída',
  'Caldo de aipim com frango desfiado',
  'Caldo de inhame com carne moída',
  'Caldo de feijão com temperos verdes',
  'Caldo verde',
  'Sopa de macarrão com legumes e frango desfiado',
  'Caldo de legumes',
  'Canjiquinha com frango desfiado',
];

export function getDinner(dayIndex: number): string {
  return SOUPS[dayIndex % SOUPS.length];
}

export function getDinnerDiabetic(): string {
  return 'Repetir almoço c/ ½ porção de carboidrato ou Caldo de legumes suplementado c/ módulo de fibras';
}

// ============================================================================
// CEIA (mingau rotativo)
// ============================================================================

export const SUPPER_OPTIONS = [
  'Mingau de Maisena',
  'Mingau de Arroz c/ Canela',
  'Mingau de Tapioca',
  'Mingau de Fubá',
  'Mingau de Aveia',
];

export function getSupper(dayIndex: number): string {
  return SUPPER_OPTIONS[dayIndex % SUPPER_OPTIONS.length];
}

// ============================================================================
// ACOMPANHAMENTOS FIXOS DO ALMOÇO
// ============================================================================

export const LUNCH_SIDE = 'Arroz + Feijão';
