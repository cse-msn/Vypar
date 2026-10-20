import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog, ShieldCheck, Ruler, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { LoadingScreen, Spinner } from '@/components/ui/spinner';
import { api, getApiError } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { useSizeGroups, useCreateSizeGroup, useUpdateSizeGroup, useDeleteSizeGroup } from '@/hooks/sizeGroups';
import type { Role, SizeGroup, User } from '@/types';

export default function Settings() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: qk.users,
    queryFn: async () => (await api.get('/auth/users')).data.data as User[],
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.users });

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage staff accounts and access."
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add user</Button>}
      />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4" /> Users</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingScreen />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell className="font-medium">{u.name}{u._id === me?._id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell><Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>{u.role}</Badge></TableCell>
                      <TableCell><Badge variant={u.active ? 'success' : 'destructive'}>{u.active ? 'active' : 'disabled'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      {me?.role === 'owner' && <SizeGroupsCard />}

      <Card className="mt-5">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> About</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          MNM Fashion — unified inventory &amp; billing. Installable as an app from your browser's menu
          (“Install app” / “Add to Home Screen”). The server is the source of truth for all stock and
          financial records; billing requires an internet connection to keep inventory accurate.
        </CardContent>
      </Card>

      {adding && <AddUserDialog onClose={() => setAdding(false)} onDone={refresh} />}
      {editing && <EditUserDialog user={editing} isSelf={editing._id === me?._id} onClose={() => setEditing(null)} onDone={refresh} />}
    </div>
  );
}

function AddUserDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' as Role });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      return toast.error('Fill all fields (password ≥ 6 chars)');
    }
    setSaving(true);
    try {
      await api.post('/auth/register', form);
      toast.success('User added');
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Create user</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, isSelf, onClose, onDone }: { user: User; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { role, active };
      if (password) body.password = password;
      await api.patch(`/auth/users/${user._id}`, body);
      toast.success('User updated');
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit {user.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
            Active {isSelf && <span className="text-xs text-muted-foreground">(can't disable yourself)</span>}
          </label>
          <div><Label>Reset password</Label><Input type="password" placeholder="Leave blank to keep" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" onClick={save} disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Save changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SizeGroupsCard() {
  const { data: groups, isLoading } = useSizeGroups();
  const del = useDeleteSizeGroup();
  const [editing, setEditing] = useState<SizeGroup | null | 'new'>(null);

  const remove = async (g: SizeGroup) => {
    if (!window.confirm(`Delete size group "${g.name}"? This only removes the template; existing products are unaffected.`)) return;
    try {
      await del.mutateAsync(g._id);
      toast.success('Size group deleted');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <Card className="mt-5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Ruler className="h-4 w-4" /> Size groups</CardTitle>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add size group</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingScreen />
        ) : !groups?.length ? (
          <p className="py-4 text-sm text-muted-foreground">No size groups yet. Add one to use it when creating products.</p>
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sizes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g._id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-wrap gap-1">
                        {g.sizes.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(g)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(g)} disabled={del.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </CardContent>
      {editing && <SizeGroupDialog group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function SizeGroupDialog({ group, onClose }: { group: SizeGroup | null; onClose: () => void }) {
  const create = useCreateSizeGroup();
  const update = useUpdateSizeGroup(group?._id ?? '');
  const [name, setName] = useState(group?.name ?? '');
  const [sizes, setSizes] = useState(group?.sizes.join(', ') ?? '');

  const save = async () => {
    const sizeList = sizes.split(',').map((s) => s.trim()).filter(Boolean);
    if (!name.trim()) return toast.error('Name is required');
    if (!sizeList.length) return toast.error('Enter at least one size');
    const body = { name: name.trim(), sizes: sizeList };
    try {
      if (group) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(group ? 'Size group updated' : 'Size group added');
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{group ? 'Edit size group' : 'Add size group'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input autoFocus placeholder="e.g. 20-24-28-32-36" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Sizes (comma separated)</Label>
            <Input placeholder="e.g. 20, 24, 28, 32, 36" value={sizes} onChange={(e) => setSizes(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Order matters — sizes appear as columns in the product grid.</p>
          </div>
          <Button className="w-full" onClick={save} disabled={pending}>{pending && <Spinner className="h-4 w-4" />} Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
