import { FoodItem } from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

// Must stay identical to foodKey in api/nutrition/analyze.ts.
export function normalizeFoodKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/** Re-derive an item's macros from its per-100g values for a new weight. No AI call needed. */
export function withGrams(item: FoodItem, grams: number): FoodItem {
  const g = Math.min(3000, Math.max(1, Math.round(Number.isFinite(grams) ? grams : 0)));
  if (!item.per100g) return { ...item, grams: g, portion: `${g} g` };
  const f = g / 100;
  return {
    ...item,
    grams: g,
    portion: `${g} g`,
    calories: Math.round(item.per100g.calories * f),
    protein: round1(item.per100g.protein * f),
    carbs: round1(item.per100g.carbs * f),
    fats: round1(item.per100g.fats * f),
  };
}

/**
 * The user says "this item is really N kcal". Scale all of its macros proportionally so the
 * per-100g profile reflects the correction, and mark it as user-corrected so it is remembered.
 */
export function withCalories(item: FoodItem, kcal: number): FoodItem {
  if (!item.per100g || !item.grams || item.per100g.calories <= 0) return item;
  const target = Math.min(5000, Math.max(0, kcal));
  const ratio = target / (item.per100g.calories * (item.grams / 100));
  // Per-100g values are physically bounded (and validated by the Firestore rules).
  const per100g = {
    calories: Math.min(900, round1(item.per100g.calories * ratio)),
    protein: Math.min(100, round1(item.per100g.protein * ratio)),
    carbs: Math.min(100, round1(item.per100g.carbs * ratio)),
    fats: Math.min(100, round1(item.per100g.fats * ratio)),
  };
  return withGrams({ ...item, per100g, source: 'user' }, item.grams);
}

export function totalsOf(items: FoodItem[]) {
  return {
    calories: items.reduce((s, i) => s + (i.calories ?? 0), 0),
    protein: round1(items.reduce((s, i) => s + (i.protein ?? 0), 0)),
    carbs: round1(items.reduce((s, i) => s + (i.carbs ?? 0), 0)),
    fats: round1(items.reduce((s, i) => s + (i.fats ?? 0), 0)),
  };
}

/** True when every item carries per-100g data, i.e. totals can be derived locally. */
export function isGramBased(items: FoodItem[]): boolean {
  return items.length > 0 && items.every((i) => i.per100g && i.grams);
}
