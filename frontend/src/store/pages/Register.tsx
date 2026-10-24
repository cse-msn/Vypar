import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useStoreAuth } from '../StoreAuthContext';
import { getApiError } from '@/lib/api';

export default function Register() {
  const { register } = useStoreAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/shop';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password });
      navigate(next);
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-gray-500">Shop faster and track your orders.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Field label="Full name" value={form.name} onChange={set('name')} />
        <Field label="Email" type="email" value={form.email} onChange={set('email')} />
        <Field label="Phone / WhatsApp" value={form.phone} onChange={set('phone')} required={false} />
        <Field label="Password" type="password" value={form.password} onChange={set('password')} />
        <button disabled={busy} className="w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account? <Link to={`/shop/login?next=${encodeURIComponent(next)}`} className="font-medium text-[#A61E57] underline">Login</Link>
      </p>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, required = true }: { label: string; type?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input type={type} value={value} onChange={onChange} required={required} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#A61E57]" />
    </label>
  );
}
