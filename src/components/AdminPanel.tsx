import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Trash2, Mail, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';

interface Invitation {
  email: string;
  status: 'pending' | 'accepted';
  invitedAt: string;
  invitedBy: string;
}

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'invitations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => doc.data() as Invitation));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invitations');
    });
    return () => unsubscribe();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !user) return;

    const email = newEmail.toLowerCase().trim();
    if (invitations.some(inv => inv.email === email)) {
      toast.error('User already invited');
      return;
    }

    setIsInviting(true);
    try {
      // 1. Send SMTP Email via Backend
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          invitedBy: user.displayName || user.email 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      // 2. Add to Firestore Whitelist
      await setDoc(doc(db, 'invitations', email), {
        email,
        status: 'pending',
        invitedAt: new Date().toISOString(),
        invitedBy: user.displayName || user.email
      });

      toast.success(`Invitation sent to ${email}`);
      setNewEmail('');
    } catch (error: any) {
      console.error('Invite error:', error);
      toast.error(error.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  const removeInvite = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', email));
      toast.success('Access revoked');
    } catch (error) {
      toast.error('Failed to revoke access');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground">Manage user access and invitations.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite User
            </CardTitle>
            <CardDescription>Add an email to the whitelist and send an invite.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="user@example.com" 
                    className="pl-9"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={isInviting}>
                {isInviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invitation'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Whitelisted Users</CardTitle>
            <CardDescription>Users who have been granted access to the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No invitations sent yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((inv) => (
                    <TableRow key={inv.email}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        {inv.status === 'accepted' ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs">Accepted</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs">Pending</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inv.invitedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeInvite(inv.email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
