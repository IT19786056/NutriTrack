import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { FoodHint, FoodItem, FoodMemoryEntry } from '../types';
import { normalizeFoodKey } from './nutrition';

const HINT_LIMIT = 40;

const memoryPath = (uid: string) => `users/${uid}/foodMemory`;

/** The user's most-used foods, sent with each scan so estimates drift toward how they actually eat. */
export async function loadFoodHints(uid: string): Promise<FoodHint[]> {
  try {
    const snap = await getDocs(
      query(collection(db, memoryPath(uid)), orderBy('useCount', 'desc'), limit(HINT_LIMIT))
    );
    return snap.docs.map((d) => {
      const e = d.data() as FoodMemoryEntry;
      return { name: e.name, typicalGrams: e.gramsTypical, source: e.source, per100g: e.per100g };
    });
  } catch (error) {
    // Memory is an enhancement; a scan must still work without it.
    console.warn('Could not load food memory:', error);
    return [];
  }
}

/**
 * Learn from a saved meal. Portions always update the running typical weight. Nutrient values are
 * only replaced when the user corrected them, so an unchecked AI guess never overrides a correction.
 */
export async function rememberFoods(uid: string, items: FoodItem[]): Promise<void> {
  const now = new Date().toISOString();
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.per100g || !item.grams) continue;
    const key = normalizeFoodKey(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    try {
      const ref = doc(db, memoryPath(uid), key);
      const existing = (await getDoc(ref)).data() as FoodMemoryEntry | undefined;
      const corrected = item.source === 'user';

      const entry: FoodMemoryEntry = {
        uid,
        key,
        name: item.name.slice(0, 100),
        gramsTypical: existing ? Math.round(existing.gramsTypical * 0.7 + item.grams * 0.3) : item.grams,
        per100g: corrected || !existing ? item.per100g : existing.per100g,
        source: corrected ? 'user' : existing?.source ?? (item.source ?? 'ai'),
        useCount: (existing?.useCount ?? 0) + 1,
        updatedAt: now,
      };
      await setDoc(ref, entry);
    } catch (error) {
      console.warn(`Could not remember "${item.name}":`, error);
    }
  }
}
