import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FoodHint, FoodItem, NutrientSource } from '@/src/types';
import { withCalories, withGrams } from '@/src/lib/nutrition';
import { lookupComponent } from '@/src/lib/gemini';

const SOURCE_LABEL: Record<NutrientSource, { text: string; className: string }> = {
  memory: { text: 'your data', className: 'text-[#CCFF00]' },
  user: { text: 'edited', className: 'text-[#CCFF00]' },
  usda: { text: 'USDA', className: 'text-emerald-400' },
  ai: { text: 'AI est.', className: 'text-zinc-400' },
};

interface RowProps {
  item: FoodItem;
  onChange: (item: FoodItem) => void;
  onRemove: () => void;
}

const ItemRow: React.FC<RowProps> = ({ item, onChange, onRemove }) => {
  const gramBased = !!item.per100g && !!item.grams;
  const [grams, setGrams] = useState(String(item.grams ?? ''));
  const [kcal, setKcal] = useState(String(item.calories ?? ''));

  useEffect(() => {
    setGrams(String(item.grams ?? ''));
    setKcal(String(item.calories ?? ''));
  }, [item.grams, item.calories]);

  const commitGrams = () => {
    const value = Number(grams);
    if (!Number.isFinite(value) || value <= 0) {
      setGrams(String(item.grams ?? ''));
      return;
    }
    if (value !== item.grams) onChange(withGrams(item, value));
  };

  const commitKcal = () => {
    const value = Number(kcal);
    if (!Number.isFinite(value) || value < 0) {
      setKcal(String(item.calories ?? ''));
      return;
    }
    if (value !== item.calories) onChange(withCalories(item, value));
  };

  const onEnter = (commit: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
  };

  const source = item.source ? SOURCE_LABEL[item.source] : null;
  const unsure = item.confidence !== undefined && item.confidence < 0.5;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-bold flex-1 text-white truncate">{item.name}</span>
        {unsure && <span className="text-[10px] font-bold text-amber-400">check this</span>}
        {source && <span className={`text-[10px] font-mono ${source.className}`}>{source.text}</span>}
        <button onClick={onRemove} className="hover:text-red-400 p-1 text-zinc-400" aria-label={`Remove ${item.name}`}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {gramBased ? (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-zinc-400">
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              max={3000}
              className="w-20 h-7 text-[11px] rounded-lg bg-zinc-900 border-zinc-800 text-white"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              onBlur={commitGrams}
              onKeyDown={onEnter(commitGrams)}
              aria-label={`${item.name} weight in grams`}
            />
            g
          </label>
          <label className="flex items-center gap-1 text-zinc-400">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              className="w-20 h-7 text-[11px] rounded-lg bg-zinc-900 border-zinc-800 text-white"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              onBlur={commitKcal}
              onKeyDown={onEnter(commitKcal)}
              aria-label={`${item.name} calories`}
            />
            kcal
          </label>
          <span className="ml-auto font-mono text-[10px] text-zinc-500">
            P {item.protein ?? 0} · C {item.carbs ?? 0} · F {item.fats ?? 0}
          </span>
        </div>
      ) : (
        <Input
          className="h-7 text-[11px] rounded-lg bg-zinc-900 border-zinc-800 text-white"
          value={item.portion}
          onChange={(e) => onChange({ ...item, portion: e.target.value })}
          placeholder="Portion"
        />
      )}
    </div>
  );
};

interface EditorProps {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
  hints: FoodHint[];
}

export const FoodItemsEditor: React.FC<EditorProps> = ({ items, onChange, hints }) => {
  const [newName, setNewName] = useState('');
  const [newGrams, setNewGrams] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addComponent = async () => {
    const name = newName.trim();
    const grams = Number(newGrams);
    if (!name || !Number.isFinite(grams) || grams <= 0) {
      toast.error('Enter a component name and its weight in grams');
      return;
    }
    setIsAdding(true);
    try {
      const item = await lookupComponent(name, grams, hints);
      onChange([...items, item]);
      setNewName('');
      setNewGrams('');
    } catch (error: any) {
      toast.error(error?.message || 'Could not look up that component');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-2xl border border-zinc-800 bg-zinc-900/60">
      {items.map((item, idx) => (
        <ItemRow
          key={`${item.name}-${idx}`}
          item={item}
          onChange={(updated) => onChange(items.map((it, i) => (i === idx ? updated : it)))}
          onRemove={() => onChange(items.filter((_, i) => i !== idx))}
        />
      ))}
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="New component"
          className="h-8 text-xs flex-1 rounded-xl bg-zinc-950 border-zinc-800 text-white"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Input
          type="number"
          inputMode="decimal"
          placeholder="grams"
          className="h-8 text-xs w-20 rounded-xl bg-zinc-950 border-zinc-800 text-white"
          value={newGrams}
          onChange={(e) => setNewGrams(e.target.value)}
        />
        <Button
          size="sm"
          className="h-8 rounded-xl bg-zinc-800 text-white"
          onClick={addComponent}
          disabled={isAdding}
          aria-label="Add component"
        >
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
};
