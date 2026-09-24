// ============================================================================
// Smart Menu — Lista de Compras (Carnes)
// Conta quantas vezes cada tipo de carne aparece no cardápio principal do mês
// e calcula o total em quilos, seguindo a regra da nutricionista: cada
// ocorrência de um prato consome uma porção fixa de carne por dia.
// ============================================================================

import type { DailyMeal } from './types';

export interface MeatCategory {
  name: string;
  /** Quilos consumidos por ocorrência (por dia em que o prato aparece). */
  kgPerOccurrence: number;
  /** Tamanho do pacote usado para entrega, em quilos. */
  packageKg: number;
}

// Categorias e regra de consumo/embalagem informadas pela nutricionista.
// Todas as carnes saem em pacotes de 2,5kg (porção diária de 5kg = 2 pacotes),
// exceto a carne moída, que vem em pacotes de 2kg (porção diária de 4kg = 2 pacotes).
export const MEAT_CATEGORIES: MeatCategory[] = [
  { name: 'Filé de peito de frango picadinho', kgPerOccurrence: 5, packageKg: 2.5 },
  { name: 'Coxa e sobrecoxa desossada', kgPerOccurrence: 5, packageKg: 2.5 },
  { name: 'Paleta em tirinhas', kgPerOccurrence: 5, packageKg: 2.5 },
  { name: 'Copa lombo picadinho', kgPerOccurrence: 5, packageKg: 2.5 },
  { name: 'Carne moída (patinho)', kgPerOccurrence: 4, packageKg: 2 },
  { name: 'Linguicinha', kgPerOccurrence: 5, packageKg: 2.5 },
  { name: 'Músculo em cubinhos', kgPerOccurrence: 5, packageKg: 2.5 },
];

/**
 * Classifica o nome de um prato principal nas categorias de carne que ele usa.
 * Um prato pode usar mais de uma carne (ex: feijoada usa carne de porco E linguiça).
 * Alguns mapeamentos são heurísticos (ex: "Frango com quiabo" -> peito de frango)
 * e podem precisar de ajuste manual — ver comentários inline.
 */
export function classifyMeat(dishName: string): string[] {
  const name = dishName.toUpperCase();
  const categories: string[] = [];

  if (/COXA|SOBRECOXA/.test(name)) {
    categories.push('Coxa e sobrecoxa desossada');
  }
  if (/PALETA/.test(name)) {
    categories.push('Paleta em tirinhas');
  }
  if (/M[ÚU]SCULO/.test(name)) {
    categories.push('Músculo em cubinhos');
  }
  if (/LINGUI[ÇC]A/.test(name)) {
    categories.push('Linguicinha');
  }
  if (/CARNE DE PORCO|LOMBO/.test(name)) {
    categories.push('Copa lombo picadinho');
  }
  if (/CARNE MO[ÍI]DA|BOLONHESA|ALM[ÔO]NDEGA/.test(name)) {
    categories.push('Carne moída (patinho)');
  }
  // "Frango" só conta como peito se o prato não já foi classificado como coxa/sobrecoxa
  // (ex: "Estrogonofe de frango" -> peito; "Sobrecoxa assada" já caiu na regra acima).
  if (/FRANGO|ESTROGONOFE/.test(name) && !categories.includes('Coxa e sobrecoxa desossada')) {
    categories.push('Filé de peito de frango picadinho');
  }

  return categories;
}

export interface MeatShoppingListItem {
  category: string;
  occurrences: number;
  kg: number;
  packageKg: number;
  packages: number;
  days: string[]; // datas (yyyy-MM-dd) em que a carne aparece, para conferência
}

/**
 * Calcula a lista de compras de carnes para um conjunto de dias já gerados
 * (generateMonthlyMenu ou o estado atual do editor, incluindo edições manuais).
 */
export function calculateMeatShoppingList(days: DailyMeal[]): MeatShoppingListItem[] {
  const byCategory = new Map<string, { days: string[] }>();

  for (const day of days) {
    const categories = classifyMeat(day.lunchMain);
    for (const category of categories) {
      if (!byCategory.has(category)) {
        byCategory.set(category, { days: [] });
      }
      byCategory.get(category)!.days.push(day.date);
    }
  }

  return MEAT_CATEGORIES.map((meat) => {
    const entry = byCategory.get(meat.name);
    const occurrences = entry?.days.length ?? 0;
    const kg = occurrences * meat.kgPerOccurrence;
    const packages = Math.ceil(kg / meat.packageKg);
    return {
      category: meat.name,
      occurrences,
      kg,
      packageKg: meat.packageKg,
      packages,
      days: entry?.days ?? [],
    };
  }).filter((item) => item.occurrences > 0);
}
