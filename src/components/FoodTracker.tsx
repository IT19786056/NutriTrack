import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { analyzeFoodImage, getNutritionByName, NutritionalInfo, recalculateNutrition } from '@/src/lib/gemini';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Upload, Loader2, Plus, Utensils, Info, Sparkles, Trash2, History, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { resizeImage } from '@/src/lib/image-utils';
import { FoodLog, FoodItem } from '@/src/types';

export const FoodTracker: React.FC = () => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingNutrition, setIsFetchingNutrition] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAiResultOpen, setIsAiResultOpen] = useState(false);
  const [aiResult, setAiResult] = useState<NutritionalInfo | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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

  const [newItem, setNewItem] = useState({ name: '', portion: '' });

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
      const result = await getNutritionByName(manualFood.name);
      setManualFood({
        ...manualFood,
        calories: result.calories.toString(),
        protein: result.protein.toString(),
        carbs: result.carbs.toString(),
        fats: result.fats.toString(),
        items: result.items || []
      });
      toast.success(`Found nutritional facts for ${manualFood.name}`);
    } catch (error) {
      console.error('Failed to fetch nutrition:', error);
      toast.error('Could not find nutritional facts. Please enter manually.');
    } finally {
      setIsFetchingNutrition(false);
    }
  };

  const handleRecalculate = async (isAi: boolean) => {
    const currentFood = isAi ? aiResult : manualFood;
    if (!currentFood || !currentFood.items || currentFood.items.length === 0) {
      toast.error('Add items to recalculate');
      return;
    }

    setIsRecalculating(true);
    try {
      const result = await recalculateNutrition(currentFood.items, currentFood.name);
      if (isAi && aiResult) {
        setAiResult({
          ...aiResult,
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fats: result.fats,
          items: result.items
        });
      } else {
        setManualFood({
          ...manualFood,
          calories: result.calories.toString(),
          protein: result.protein.toString(),
          carbs: result.carbs.toString(),
          fats: result.fats.toString(),
          items: result.items
        });
      }
      toast.success('Nutrition updated based on items');
    } catch (error) {
      console.error('Recalculation failed:', error);
      toast.error('Failed to recalculate nutrition');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setIsAnalyzing(true);
      try {
        // Resize image to keep it under Firestore/Gemini limits
        const resized = await resizeImage(reader.result as string);
        const base64Data = resized.split(',')[1];
        
        setCapturedImage(resized);
        
        const result = await analyzeFoodImage(base64Data);
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
        console.log(`Saving food log with image. Size: ${(sizeInBytes / 1024).toFixed(2)} KB`);
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
      toast.success(`${food.name} logged successfully!`);
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
      toast.success('Log deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addItem = (isAi: boolean) => {
    if (!newItem.name.trim() || !newItem.portion.trim()) {
      toast.error('Enter both name and portion');
      return;
    }
    const item: FoodItem = { name: newItem.name.trim(), portion: newItem.portion.trim() };
    if (isAi && aiResult) {
      setAiResult({ ...aiResult, items: [...aiResult.items, item] });
    } else {
      setManualFood({ ...manualFood, items: [...manualFood.items, item] });
    }
    setNewItem({ name: '', portion: '' });
  };

  const removeItem = (isAi: boolean, index: number) => {
    if (isAi && aiResult) {
      const newItems = [...aiResult.items];
      newItems.splice(index, 1);
      setAiResult({ ...aiResult, items: newItems });
    } else {
      const newItems = [...manualFood.items];
      newItems.splice(index, 1);
      setManualFood({ ...manualFood, items: newItems });
    }
  };

  const updateItemPortion = (isAi: boolean, index: number, portion: string) => {
    if (isAi && aiResult) {
      const newItems = [...aiResult.items];
      newItems[index] = { ...newItems[index], portion };
      setAiResult({ ...aiResult, items: newItems });
    } else {
      const newItems = [...manualFood.items];
      newItems[index] = { ...newItems[index], portion };
      setManualFood({ ...manualFood, items: newItems });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nutrition</h2>
          <p className="text-muted-foreground">Log your meals and track your macros.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* AI Tracker Card */}
        <Card className="relative overflow-hidden border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-2">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>AI Food Recognition</CardTitle>
            <CardDescription>Snap a photo of your meal to automatically estimate calories and macros.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              disabled={isAnalyzing}
            />
            <Button disabled={isAnalyzing} className="rounded-full px-8">
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Tracker Card */}
        <Card className="border-2 border-dashed border-muted bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setIsManualOpen(true)}>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle>Manual Entry</CardTitle>
            <CardDescription>Enter food details manually if you know the exact nutritional facts.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button variant="outline" className="rounded-full px-8">
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Logs
          </CardTitle>
          <CardDescription>Your recently logged meals and snacks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {foodLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No logs yet today.</p>
            ) : (
              foodLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border group">
                  <div className="flex items-center gap-3">
                    {log.imageUrl ? (
                      <img src={log.imageUrl} alt={log.name} className="w-12 h-12 rounded-md object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                        <Utensils className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium">{log.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {log.mealType.charAt(0).toUpperCase() + log.mealType.slice(1)} • {log.calories} kcal
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                    onClick={() => log.id && deleteLog(log.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Result Dialog */}
      <Dialog open={isAiResultOpen} onOpenChange={setIsAiResultOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Analysis Result</DialogTitle>
            <DialogDescription>
              We've estimated the nutritional content of your meal.
            </DialogDescription>
          </DialogHeader>
          {aiResult && (
            <div className="space-y-6 py-4">
              {capturedImage && (
                <div className="relative aspect-video rounded-lg overflow-hidden border">
                  <img src={capturedImage} alt="Captured food" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Food Item</Label>
                  <Input value={aiResult.name} onChange={(e) => setAiResult({...aiResult, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Meal Type</Label>
                  <Select onValueChange={(v: any) => setAiResult({...aiResult, mealType: v})} defaultValue="lunch">
                    <SelectTrigger>
                      <SelectValue placeholder="Select meal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Food Items / Components</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs gap-1"
                    onClick={() => handleRecalculate(true)}
                    disabled={isRecalculating}
                  >
                    {isRecalculating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Recalculate Nutrition
                  </Button>
                </div>
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  {aiResult.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-background border rounded-lg p-2 text-xs">
                      <span className="font-medium flex-1">{item.name}</span>
                      <Input 
                        className="w-24 h-7 text-[10px]" 
                        value={item.portion} 
                        onChange={(e) => updateItemPortion(true, idx, e.target.value)}
                        placeholder="Portion (e.g. 1 cup)"
                      />
                      <button onClick={() => removeItem(true, idx)} className="hover:text-destructive p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Item name (e.g. Rice)" 
                        className="h-8 text-xs flex-1" 
                        value={newItem.name}
                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                      />
                      <Input 
                        placeholder="Portion" 
                        className="h-8 text-xs w-24" 
                        value={newItem.portion}
                        onChange={e => setNewItem({...newItem, portion: e.target.value})}
                      />
                    </div>
                    <Button size="sm" className="h-8 w-full" onClick={() => addItem(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Add Item
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Calories</Label>
                  <Input type="number" className="h-8" value={aiResult.calories} onChange={(e) => setAiResult({...aiResult, calories: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Protein</Label>
                  <Input type="number" className="h-8" value={aiResult.protein} onChange={(e) => setAiResult({...aiResult, protein: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Carbs</Label>
                  <Input type="number" className="h-8" value={aiResult.carbs} onChange={(e) => setAiResult({...aiResult, carbs: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Fats</Label>
                  <Input type="number" className="h-8" value={aiResult.fats} onChange={(e) => setAiResult({...aiResult, fats: Number(e.target.value)})} />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-[10px] text-muted-foreground">
                <Info className="w-4 h-4 shrink-0" />
                <p>Modifying items allows for more accurate nutrition tracking. Click "Recalculate" to update macros based on your changes.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiResultOpen(false)}>Cancel</Button>
            <Button onClick={() => saveFoodLog(aiResult)}>Confirm & Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Food Entry</DialogTitle>
            <DialogDescription>
              Enter the nutritional details of your meal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Food Name</Label>
              <div className="flex gap-2">
                <Input id="name" placeholder="e.g. Chicken Salad" value={manualFood.name} onChange={e => setManualFood({...manualFood, name: e.target.value})} />
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="icon" 
                  onClick={fetchNutrition} 
                  disabled={isFetchingNutrition}
                  title="Auto-fill nutrition using AI"
                >
                  {isFetchingNutrition ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                </Button>
              </div>
            </div>

            {/* Items Section for Manual */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Food Items / Components</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs gap-1"
                  onClick={() => handleRecalculate(false)}
                  disabled={isRecalculating}
                >
                  {isRecalculating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Recalculate Nutrition
                </Button>
              </div>
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                {manualFood.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-background border rounded-lg p-2 text-xs">
                    <span className="font-medium flex-1">{item.name}</span>
                    <Input 
                      className="w-24 h-7 text-[10px]" 
                      value={item.portion} 
                      onChange={(e) => updateItemPortion(false, idx, e.target.value)}
                      placeholder="Portion"
                    />
                    <button onClick={() => removeItem(false, idx)} className="hover:text-destructive p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Item name (e.g. Rice)" 
                      className="h-8 text-xs flex-1" 
                      value={newItem.name}
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                    />
                    <Input 
                      placeholder="Portion" 
                      className="h-8 text-xs w-24" 
                      value={newItem.portion}
                      onChange={e => setNewItem({...newItem, portion: e.target.value})}
                    />
                  </div>
                  <Button size="sm" className="h-8 w-full" onClick={() => addItem(false)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="calories">Calories (kcal)</Label>
                <Input id="calories" type="number" value={manualFood.calories} onChange={e => setManualFood({...manualFood, calories: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mealType">Meal Type</Label>
                <Select onValueChange={(v: any) => setManualFood({...manualFood, mealType: v})} defaultValue="lunch">
                  <SelectTrigger>
                    <SelectValue placeholder="Select meal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input id="protein" type="number" value={manualFood.protein} onChange={e => setManualFood({...manualFood, protein: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input id="carbs" type="number" value={manualFood.carbs} onChange={e => setManualFood({...manualFood, carbs: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fats">Fats (g)</Label>
                <Input id="fats" type="number" value={manualFood.fats} onChange={e => setManualFood({...manualFood, fats: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualOpen(false)}>Cancel</Button>
            <Button onClick={() => saveFoodLog(manualFood)}>Log Food</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
