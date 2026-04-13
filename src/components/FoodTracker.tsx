import React, { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { analyzeFoodImage, getNutritionByName, NutritionalInfo } from '@/src/lib/gemini';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Upload, Loader2, Plus, Utensils, Info, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';

export const FoodTracker: React.FC = () => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingNutrition, setIsFetchingNutrition] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAiResultOpen, setIsAiResultOpen] = useState(false);
  const [aiResult, setAiResult] = useState<NutritionalInfo | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualFood, setManualFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    mealType: 'lunch' as const
  });

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
      });
      toast.success(`Found nutritional facts for ${manualFood.name}`);
    } catch (error) {
      console.error('Failed to fetch nutrition:', error);
      toast.error('Could not find nutritional facts. Please enter manually.');
    } finally {
      setIsFetchingNutrition(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      setCapturedImage(reader.result as string);
      setIsAnalyzing(true);
      
      try {
        const result = await analyzeFoodImage(base64String);
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
      await addDoc(collection(db, path), {
        uid: user.uid,
        name: food.name,
        calories: Number(food.calories),
        protein: Number(food.protein || 0),
        carbs: Number(food.carbs || 0),
        fats: Number(food.fats || 0),
        mealType: food.mealType || 'snack',
        timestamp: new Date().toISOString(),
        imageUrl: capturedImage || null
      });
      toast.success(`${food.name} logged successfully!`);
      setIsManualOpen(false);
      setIsAiResultOpen(false);
      setAiResult(null);
      setCapturedImage(null);
      setManualFood({ name: '', calories: '', protein: '', carbs: '', fats: '', mealType: 'lunch' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
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

      {/* AI Result Dialog */}
      <Dialog open={isAiResultOpen} onOpenChange={setIsAiResultOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>AI Analysis Result</DialogTitle>
            <DialogDescription>
              We've estimated the nutritional content of your meal.
            </DialogDescription>
          </DialogHeader>
          {aiResult && (
            <div className="space-y-4 py-4">
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
                  <Label className="text-xs text-muted-foreground">Calories (kcal)</Label>
                  <Input type="number" value={aiResult.calories} onChange={(e) => setAiResult({...aiResult, calories: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Protein (g)</Label>
                  <Input type="number" value={aiResult.protein} onChange={(e) => setAiResult({...aiResult, protein: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Carbs (g)</Label>
                  <Input type="number" value={aiResult.carbs} onChange={(e) => setAiResult({...aiResult, carbs: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fats (g)</Label>
                  <Input type="number" value={aiResult.fats} onChange={(e) => setAiResult({...aiResult, fats: Number(e.target.value)})} />
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
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-[10px] text-muted-foreground">
                <Info className="w-4 h-4 shrink-0" />
                <p>These are AI-generated estimates based on the image provided. Please verify for accuracy.</p>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manual Food Entry</DialogTitle>
            <DialogDescription>
              Enter the nutritional details of your meal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
