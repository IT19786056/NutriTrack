import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, ShieldCheck, UserCog } from 'lucide-react';
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

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role?: 'admin' | 'user';
  createdAt: string;
}

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const qInv = query(collection(db, 'invitations'));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => doc.data() as Invitation));
    });

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserData));
    });

    return () => {
      unsubInv();
      unsubUsers();
    };
  }, []);

  const toggleAdmin = async (targetUser: UserData) => {
    if (targetUser.email === 'ravindijason@gmail.com') {
      toast.error('Cannot modify primary admin role');
      return;
    }

    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      await setDoc(doc(db, 'users', targetUser.uid), { role: newRole }, { merge: true });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

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
        <p className="text-muted-foreground">Manage user access, invitations, and roles.</p>
      </div>

      <Tabs defaultValue="invitations" className="space-y-6">
        <TabsList className="rounded-full">
          <TabsTrigger value="invitations" className="rounded-full">Invitations</TabsTrigger>
          <TabsTrigger value="users" className="rounded-full">User Management</TabsTrigger>
        </TabsList>

        <TabsContent value="invitations">
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
              <CardContent className="p-0 md:p-6">
                <div className="hidden md:block">
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
                </div>
                
                {/* Mobile View */}
                <div className="md:hidden divide-y">
                  {invitations.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No invitations sent yet.
                    </div>
                  ) : (
                    invitations.map((inv) => (
                      <div key={inv.email} className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">{inv.email}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {inv.status === 'accepted' ? (
                              <div className="flex items-center gap-1 text-green-500">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[10px]">Accepted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-orange-500">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px]">Pending</span>
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(inv.invitedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive h-8 w-8"
                          onClick={() => removeInvite(inv.email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage user roles and permissions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.uid}>
                        <TableCell className="font-medium">{u.displayName}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                            {u.role || 'user'}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 rounded-full text-xs"
                            onClick={() => toggleAdmin(u)}
                            disabled={u.email === 'ravindijason@gmail.com'}
                          >
                            {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y">
                {users.map((u) => (
                  <div key={u.uid} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-sm">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {u.role || 'user'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 rounded-full text-[10px] px-3"
                        onClick={() => toggleAdmin(u)}
                        disabled={u.email === 'ravindijason@gmail.com'}
                      >
                        {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};