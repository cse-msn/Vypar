import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useStoreAuth } from '../StoreAuthContext';
import { getApiError } from '@/lib/api';

export default function Login() {
  const { requestOtp, verifyOtp } = useStoreAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/shop';

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return toast.error('Enter a valid 10-digit number');
    setBusy(true);
    try {
      const res = await requestOtp(phone.trim());
      setIsNew(res.isNewCustomer);
      setStep('otp');
      // The OTP is the last 4 digits of the number (demo scheme, no message is sent).
      toast.success(res.devOtp ? `OTP: ${res.devOtp} (last 4 digits of your number)` : res.hint);
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length < 4) return toast.error('Enter the 4-digit OTP');
    if (isNew && !name.trim()) return toast.error('Please enter your name');
    setBusy(true);
    try {
      await verifyOtp(phone.trim(), otp.trim(), name.trim() || undefined);
      navigate(next);
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Login / Sign up</h1>
      <p className="mt-1 text-sm text-gray-500">Continue with your WhatsApp number.</p>

      {step === 'phone' ? (
        <form onSubmit={sendOtp} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">WhatsApp number</span>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#A61E57]"
            />
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white disabled:opacity-60">
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
          <p className="text-center text-xs text-gray-400">We'll verify your number with a 4-digit OTP.</p>
        </form>
      ) : (
        <form onSubmit={confirm} className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{phone}</span>
            <button type="button" onClick={() => { setStep('phone'); setOtp(''); }} className="text-[#A61E57] underline">Change</button>
          </div>
          {isNew && (
            <label className="block">
              <span className="text-sm font-medium">Your name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#A61E57]"
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium">OTP</span>
            <input
              inputMode="numeric"
              autoFocus={!isNew}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit OTP"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 tracking-[0.3em] outline-none focus:border-[#A61E57]"
            />
            <span className="mt-1 block text-xs text-gray-400">Enter the last 4 digits of your mobile number.</span>
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white disabled:opacity-60">
            {busy ? 'Verifying…' : 'Verify & continue'}
          </button>
        </form>
      )}
    </div>
  );
}
