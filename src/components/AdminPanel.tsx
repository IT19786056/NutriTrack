import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, ShieldCheck, UserCog, UserPlus, Trash2, Mail, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

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
      setInvitations(snapshot.docs.map(doc => ({
        email: doc.data().email || doc.id,
        ...doc.data()
      } as Invitation)));
    }, (error) => {
      console.error("Invitations snapshot error:", error);
    });

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserData)));
    }, (error) => {
      console.error("Users snapshot error:", error);
    });

    return () => {
      unsubInv();
      unsubUsers();
    };
  }, []);

  const toggleAdmin = async (targetUser: UserData) => {
    if (targetUser.email?.toLowerCase() === 'ravindijason@gmail.com') {
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
      const token = await user.getIdToken();
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          email, 
          invitedBy: user.displayName || user.email 
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to send email';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          const rawText = await response.text().catch(() => '');
          errorMsg = rawText.slice(0, 200) || `Server error (${response.status})`;
        }
        throw new Error(errorMsg);
      }

      await setDoc(doc(db, 'invitations', email), {
        email,
        status: 'pending',
        invitedAt: new Date().toISOString(),
        invitedBy: user.displayName || user.email
      });

      toast.success(`Invitation dispatched to ${email}`);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#CCFF00] uppercase tracking-widest font-bold">ADMIN CONSOLE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">Access & Member Control</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Manage user authorization, whitelist invitations, and athletic roles.</p>
        </div>
      </div>

      <Tabs defaultValue="invitations" className="space-y-6">
        <TabsList className="p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="invitations" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black">
            Whitelisted Invites ({invitations.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black">
            Active Athletes ({users.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invitations">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Invite Form Card */}
            <Card className="md:col-span-1 rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-800/80 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#CCFF00]" />
                  Invite Athlete
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">Whitelist an email address for instant access.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-bold text-zinc-300">Athlete Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="athlete@example.com" 
                        className="pl-9 rounded-xl bg-zinc-900 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:border-[#CCFF00]"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-10 rounded-xl bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)]" 
                    disabled={isInviting}
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Dispatching Invite...
                      </>
                    ) : (
                      'Dispatch Invitation'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Whitelist Table Card */}
            <Card className="md:col-span-2 rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-800/80 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-white">Whitelisted Credentials</CardTitle>
                <CardDescription className="text-xs text-zinc-400">Members granted access to NutriTrack Pro telemetry.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader className="bg-zinc-900/60">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-xs font-bold text-zinc-400">Email</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-400">Status</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-400">Invited</TableHead>
                        <TableHead className="text-right text-xs font-bold text-zinc-400">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-zinc-500 py-10 text-xs">
                            No invitations sent yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invitations.map((inv) => (
                          <TableRow key={inv.email} className="border-zinc-800 hover:bg-zinc-900/50">
                            <TableCell className="font-bold text-xs text-white">{inv.email}</TableCell>
                            <TableCell>
                              {inv.status === 'accepted' ? (
                                <span className="inline-flex items-center gap-1 text-[#CCFF00] font-mono text-[11px] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-orange-400 font-mono text-[11px] font-bold">
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-400 font-mono">
                              {new Date(inv.invitedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 rounded-lg"
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
                <div className="md:hidden divide-y divide-zinc-800/80">
                  {invitations.length === 0 ? (
                    <div className="text-center text-zinc-500 py-10 text-xs">
                      No invitations sent yet.
                    </div>
                  ) : (
                    invitations.map((inv) => (
                      <div key={inv.email} className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-xs text-white">{inv.email}</p>
                          <div className="flex items-center gap-3 mt-1 font-mono">
                            {inv.status === 'accepted' ? (
                              <span className="inline-flex items-center gap-1 text-[#CCFF00] text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Accepted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-orange-400 text-[10px] font-bold">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-500">
                              {new Date(inv.invitedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 rounded-lg"
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
          <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-zinc-800/80 pb-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <UserCog className="w-4 h-4 text-[#CCFF00]" />
                Athlete Directory & Permissions
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">Manage administrator privileges across athlete accounts.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-zinc-900/60">
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-xs font-bold text-zinc-400">Athlete</TableHead>
                      <TableHead className="text-xs font-bold text-zinc-400">Email</TableHead>
                      <TableHead className="text-xs font-bold text-zinc-400">Role</TableHead>
                      <TableHead className="text-xs font-bold text-zinc-400">Joined</TableHead>
                      <TableHead className="text-right text-xs font-bold text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.uid} className="border-zinc-800 hover:bg-zinc-900/50">
                        <TableCell className="font-bold text-xs text-white">{u.displayName}</TableCell>
                        <TableCell className="text-zinc-400 text-xs font-mono">{u.email}</TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'admin' ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30' : 'bg-zinc-900 text-zinc-400'
                          }`}>
                            {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                            {u.role || 'athlete'}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400 font-mono">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 rounded-xl text-xs font-bold border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                            onClick={() => toggleAdmin(u)}
                            disabled={u.email?.toLowerCase() === 'ravindijason@gmail.com'}
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
              <div className="md:hidden divide-y divide-zinc-800/80">
                {users.map((u) => (
                  <div key={u.uid} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate text-xs text-white">{u.displayName}</p>
                        <p className="text-[10px] text-zinc-400 truncate font-mono">{u.email}</p>
                      </div>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30' : 'bg-zinc-900 text-zinc-400'
                      }`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {u.role || 'athlete'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 rounded-lg text-[10px] px-3 border-zinc-700 bg-zinc-900 text-zinc-200"
                        onClick={() => toggleAdmin(u)}
                        disabled={u.email?.toLowerCase() === 'ravindijason@gmail.com'}
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