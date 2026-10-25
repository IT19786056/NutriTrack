import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { analyzeFoodImage, getNutritionByName, NutritionalInfo } from '@/src/lib/gemini';
import { loadFoodHints, rememberFoods } from '@/src/lib/foodMemory';
import { isGramBased, totalsOf } from '@/src/lib/nutrition';
import { FoodItemsEditor } from '@/src/components/FoodItemsEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Upload, Loader2, Plus, Utensils, Info, Sparkles, Trash2, History, X, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { resizeImage } from '@/src/lib/image-utils';
import { FoodLog, FoodItem, FoodHint } from '@/src/types';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

export const FoodTracker: React.FC = () => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingNutrition, setIsFetchingNutrition] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAiResultOpen, setIsAiResultOpen] = useState(false);
  const [aiResult, setAiResult] = useState<NutritionalInfo | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hints, setHints] = useState<FoodHint[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualFood, setManualFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    mealType: 'lunch' as const,
    items: [] as FoodItem[]
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/foodLogs`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFoodLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/foodLogs`);
    });

    return () => unsubscribe();
  }, [user]);

  const fetchNutrition = async () => {
    if (!manualFood.name) {
      toast.error('Please enter a food name first');
      return;
    }

    setIsFetchingNutrition(true);
    try {
      const knownFoods = user ? await loadFoodHints(user.uid) : [];
      setHints(knownFoods);
      const result = await getNutritionByName(manualFood.name, knownFoods);
      setManualFood({
        ...manualFood,
        calories: result.calories.toString(),
        protein: result.protein.toString(),
        carbs: result.carbs.toString(),
        fats: result.fats.toString(),
        items: result.items || []
      });
      toast.success(`Found nutritional telemetry for ${manualFood.name}`);
    } catch (error) {
      console.error('Failed to fetch nutrition:', error);
      toast.error('Could not find nutritional facts. Please enter manually.');
    } finally {
      setIsFetchingNutrition(false);
    }
  };

  // Items carry per-100g values, so totals are plain arithmetic: no AI call when a weight changes.
  const handleItemsChange = (isAi: boolean, items: FoodItem[]) => {
    const totals = isGramBased(items) ? totalsOf(items) : null;
    if (isAi && aiResult) {
      setAiResult({ ...aiResult, items, ...(totals ?? {}) });
    } else {
      setManualFood({
        ...manualFood,
        items,
        ...(totals
          ? {
              calories: totals.calories.toString(),
              protein: totals.protein.toString(),
              carbs: totals.carbs.toString(),
              fats: totals.fats.toString(),
            }
          : {}),
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setIsAnalyzing(true);
      try {
        const resized = await resizeImage(reader.result as string);
        const base64Data = resized.split(',')[1];
        setCapturedImage(resized);
        
        const knownFoods = user ? await loadFoodHints(user.uid) : [];
        setHints(knownFoods);
        const result = await analyzeFoodImage(base64Data, knownFoods);
        setAiResult(result);
        setIsAiResultOpen(true);
      } catch (error) {
        console.error('AI Analysis failed:', error);
        toast.error('Failed to analyze image. Please try again or enter manually.');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveFoodLog = async (food: any) => {
    if (!user) return;
    
    const path = `users/${user.uid}/foodLogs`;
    try {
      if (capturedImage) {
        const sizeInBytes = Math.round((capturedImage.length * 3) / 4);
        if (sizeInBytes > 1000000) {
          throw new Error('Image is too large to save (max 1MB). Please try a smaller photo.');
        }
      }

      await addDoc(collection(db, path), {
        uid: user.uid,
        name: food.name,
        calories: Number(food.calories),
        protein: Number(food.protein || 0),
        carbs: Number(food.carbs || 0),
        fats: Number(food.fats || 0),
        mealType: food.mealType || 'snack',
        timestamp: new Date().toISOString(),
        imageUrl: capturedImage || null,
        items: food.items || []
      });

      // Learn from this meal (weights always, nutrient values only when the user corrected them).
      await rememberFoods(user.uid, food.items || []);

      confetti({
        particleCount: 80,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#00F5FF', '#FF3B30', '#FFFFFF']
      });

      toast.success(`${food.name} logged successfully!`, { icon: '🥗' });
      setIsManualOpen(false);
      setIsAiResultOpen(false);
      setAiResult(null);
      setCapturedImage(null);
      setManualFood({ name: '', calories: '', protein: '', carbs: '', fats: '', mealType: 'lunch', items: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteLog = async (id: string) => {
    if (!user || !id) return;
    const path = `users/${user.uid}/foodLogs/${id}`;
    try {
      await deleteDoc(doc(db, path));
      toast.success('Food log removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#CCFF00] uppercase tracking-widest font-bold">NUTRITIONAL INTELLIGENCE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">Macro Fueling</h2>
          <p className="text-xs sm:text-sm text-zinc-400">AI optical food recognition & precise macronutrient logging.</p>
        </div>
      </div>

      {/* Grid: AI Viewfinder Card & Manual Entry Card */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Futuristic AI Viewfinder Card */}
        <Card 
          className="relative overflow-hidden rounded-3xl border border-[#CCFF00]/40 bg-zinc-950/90 shadow-[0_0_30px_rgba(204,255,0,0.12)] cursor-pointer group" 
          onClick={() => fileInputRef.current?.click()}
        >
          {/* Viewfinder Reticle Brackets */}
          <div className="absolute top-3 left-3 text-[10px] font-mono text-[#CCFF00]/70 font-bold pointer-events-none">
            [AI_NEURAL_CAM]
          </div>
          <div className="absolute top-3 right-3 text-[10px] font-mono text-zinc-500 pointer-events-none">
            READY
          </div>

          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(204,255,0,0.25)]">
              <Camera className="w-8 h-8 text-[#CCFF00]" />
            </div>
            <CardTitle className="text-lg font-black text-white uppercase tracking-wide">AI Optical Recognition</CardTitle>
            <CardDescription className="text-xs text-zinc-400 max-w-sm mx-auto">
              Snap or upload a photo of your meal. Gemini will automatically break down calories and macros.
            </CardDescription>
          </CardHeader>

          {/* Laser Scanning Animation Bar */}
          <div className="relative h-1 bg-zinc-900 mx-6 rounded overflow-hidden">
            <div className="w-32 h-full bg-gradient-to-r from-transparent via-[#CCFF00] to-transparent animate-pulse" />
          </div>

          <CardContent className="flex justify-center pb-7 pt-4">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              disabled={isAnalyzing}
            />
            <Button 
              disabled={isAnalyzing} 
              className="rounded-2xl px-7 h-10 bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] active:scale-95 transition-all"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin stroke-[3]" />
                  Optical Analysis in Progress...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4 stroke-[2.5]" />
                  Scan Meal Photo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Tactical Manual Entry Card */}
        <Card 
          className="rounded-3xl border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-all cursor-pointer group shadow-xl flex flex-col justify-between"
          onClick={() => setIsManualOpen(true)}
        >
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-lg font-black text-white uppercase tracking-wide">Manual Food Input</CardTitle>
            <CardDescription className="text-xs text-zinc-400 max-w-sm mx-auto">
              Know your exact calories and macro grams? Enter them manually with optional AI nutritional lookups.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-7 pt-4">
            <Button 
              variant="outline" 
              className="rounded-2xl px-7 h-10 border-zinc-700 text-zinc-200 hover:bg-zinc-800 font-extrabold text-xs active:scale-95 transition-all"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Meal Telemetry History */}
      <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#CCFF00]" />
              Recent Meal Telemetry
            </CardTitle>
            <span className="text-xs font-mono text-zinc-400">{foodLogs.length} total entries</span>
          </div>
          <CardDescription className="text-xs text-zinc-400">Recently logged meals, snacks, and macro breakdowns</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {foodLogs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Utensils className="w-12 h-12 mx-auto mb-3 opacity-20 text-[#CCFF00]" />
                <p className="text-sm font-bold text-zinc-400">No meals logged yet today.</p>
                <p className="text-xs text-zinc-500 mt-1">Scan a meal using the AI camera above to get started.</p>
              </div>
            ) : (
              foodLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 transition-all gap-3 group"
                >
                  <div className="flex items-center gap-3.5">
                    {log.imageUrl ? (
                      <img src={log.imageUrl} alt={log.name} className="w-14 h-14 rounded-xl object-cover border border-zinc-700 shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-center shrink-0">
                        <Utensils className="w-6 h-6 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-white">{log.name}</h4>
                        <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {log.mealType}
                        </span>
                      </div>

                      {/* Macro Pill Chips */}
                      <div className="flex items-center gap-2 text-[10px] mt-1.5 font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold">
                          P: {log.protein || 0}g
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                          C: {log.carbs || 0}g
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold">
                          F: {log.fats || 0}g
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                    <span className="text-sm font-black text-[#CCFF00]">
                      {log.calories} kcal
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-60 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 rounded-lg transition-all"
                      onClick={() => log.id && deleteLog(log.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Result Dialog */}
      <Dialog open={isAiResultOpen} onOpenChange={setIsAiResultOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border-zinc-800 text-zinc-100 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#CCFF00]" />
              AI Optical Breakdown
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Estimated caloric and macronutrient telemetry from your image.
            </DialogDescription>
          </DialogHeader>

          {aiResult && (
            <div className="space-y-5 py-3">
              {capturedImage && (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-800 shadow-md">
                  <img src={capturedImage} alt="Captured meal" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-300">Identified Dish</Label>
                  <Input 
                    value={aiResult.name} 
                    onChange={(e) => setAiResult({...aiResult, name: e.target.value})}
                    className="rounded-xl bg-zinc-900 border-zinc-800 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-300">Meal Window</Label>
                  <Select onValueChange={(v: any) => setAiResult({...aiResult, mealType: v})} defaultValue="lunch">
                    <SelectTrigger className="rounded-xl bg-zinc-900 border-zinc-800 text-white text-xs">
                      <SelectValue placeholder="Select meal" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2.5">
                <Label className="text-xs font-black uppercase tracking-wider text-zinc-300">Components & Weights</Label>
                <FoodItemsEditor
                  items={aiResult.items}
                  onChange={(items) => handleItemsChange(true, items)}
                  hints={hints}
                />
              </div>

              {/* Macro Values Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <Label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Calories</Label>
                  <span className="text-base font-black text-[#CCFF00]">{aiResult.calories}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <Label className="text-[10px] uppercase font-bold text-blue-400 block mb-1">Protein</Label>
                  <span className="text-base font-black text-white">{aiResult.protein}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <Label className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Carbs</Label>
                  <span className="text-base font-black text-white">{aiResult.carbs}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <Label className="text-[10px] uppercase font-bold text-orange-400 block mb-1">Fats</Label>
                  <span className="text-base font-black text-white">{aiResult.fats}g</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsAiResultOpen(false)} className="rounded-xl text-zinc-400">
              Cancel
            </Button>
            <Button 
              onClick={() => saveFoodLog(aiResult)}
              className="rounded-xl bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)]"
            >
              Confirm & Log Telemetry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border-zinc-800 text-zinc-100 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Utensils className="w-5 h-5 text-[#CCFF00]" />
              Manual Meal Calibration
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Input specific macro values or use AI auto-fetch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-zinc-300">Food Name</Label>
              <div className="flex gap-2">
                <Input 
                  id="name" 
                  placeholder="e.g. Grilled Salmon & Quinoa" 
                  value={manualFood.name} 
                  onChange={e => setManualFood({...manualFood, name: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
                />
                <Button 
                  type="button" 
                  onClick={fetchNutrition} 
                  disabled={isFetchingNutrition}
                  className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[#CCFF00] px-3 shrink-0"
                  title="Auto-fill with AI"
                >
                  {isFetchingNutrition ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {manualFood.items.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-zinc-300">Components & Weights</Label>
                <FoodItemsEditor
                  items={manualFood.items}
                  onChange={(items) => handleItemsChange(false, items)}
                  hints={hints}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="calories" className="text-xs font-bold text-zinc-300">Calories (kcal)</Label>
                <Input 
                  id="calories" 
                  type="number" 
                  value={manualFood.calories} 
                  onChange={e => setManualFood({...manualFood, calories: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mealType" className="text-xs font-bold text-zinc-300">Meal Window</Label>
                <Select onValueChange={(v: any) => setManualFood({...manualFood, mealType: v})} defaultValue="lunch">
                  <SelectTrigger className="rounded-xl bg-zinc-900 border-zinc-800 text-white">
                    <SelectValue placeholder="Select meal" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="protein" className="text-xs font-bold text-blue-400">Protein (g)</Label>
                <Input 
                  id="protein" 
                  type="number" 
                  value={manualFood.protein} 
                  onChange={e => setManualFood({...manualFood, protein: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carbs" className="text-xs font-bold text-emerald-400">Carbs (g)</Label>
                <Input 
                  id="carbs" 
                  type="number" 
                  value={manualFood.carbs} 
                  onChange={e => setManualFood({...manualFood, carbs: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fats" className="text-xs font-bold text-orange-400">Fats (g)</Label>
                <Input 
                  id="fats" 
                  type="number" 
                  value={manualFood.fats} 
                  onChange={e => setManualFood({...manualFood, fats: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsManualOpen(false)} className="rounded-xl text-zinc-400">
              Cancel
            </Button>
            <Button 
              onClick={() => saveFoodLog(manualFood)}
              className="rounded-xl bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)]"
            >
              Log Food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
