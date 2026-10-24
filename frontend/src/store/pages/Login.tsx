import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useStoreAuth } from '../StoreAuthContext';
import { getApiError } from '@/lib/api';

export default function Login() {
  const { login } = useStoreAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/shop';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(next);
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Login</h1>
      <p className="mt-1 text-sm text-gray-500">Welcome back to MNM Fashion.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        <button disabled={busy} className="w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        New here? <Link to={`/shop/register?next=${encodeURIComponent(next)}`} className="font-medium text-[#A61E57] underline">Create an account</Link>
      </p>
    </div>
  );
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#A61E57]"
      />
    </label>
  );
}
