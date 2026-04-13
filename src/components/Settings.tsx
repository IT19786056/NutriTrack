import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Target, Scale, Ruler } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    dailyCalorieGoal: profile?.dailyCalorieGoal || 2000,
    dailyWaterGoal: profile?.dailyWaterGoal || 2000,
    weight: profile?.weight || '',
    height: profile?.height || '',
  });

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        dailyCalorieGoal: Number(formData.dailyCalorieGoal),
        dailyWaterGoal: Number(formData.dailyWaterGoal),
        weight: Number(formData.weight),
        height: Number(formData.height),
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your profile and daily goals.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your public profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight" className="flex items-center gap-1">
                  <Scale className="w-3 h-3" /> Weight (kg)
                </Label>
                <Input id="weight" type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="flex items-center gap-1">
                  <Ruler className="w-3 h-3" /> Height (cm)
                </Label>
                <Input id="height" type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Daily Goals
            </CardTitle>
            <CardDescription>Set your targets for nutrition and hydration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calorieGoal">Daily Calorie Goal (kcal)</Label>
              <Input id="calorieGoal" type="number" value={formData.dailyCalorieGoal} onChange={e => setFormData({...formData, dailyCalorieGoal: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waterGoal">Daily Water Goal (ml)</Label>
              <Input id="waterGoal" type="number" value={formData.dailyWaterGoal} onChange={e => setFormData({...formData, dailyWaterGoal: e.target.value})} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="px-8 rounded-full">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};
