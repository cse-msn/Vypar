import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { storeApi, trackEvent } from '../lib/storeApi';
import { useCart } from '../CartContext';
import { useStoreAuth } from '../StoreAuthContext';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { customer, loading } = useStoreAuth();
  const navigate = useNavigate();
  const [addr, setAddr] = useState({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !customer) navigate('/shop/login?next=/shop/checkout');
  }, [loading, customer, navigate]);

  useEffect(() => {
    if (customer) setAddr((a) => ({ ...a, name: a.name || customer.name || '', phone: a.phone || customer.phone || '' }));
  }, [customer]);

  useEffect(() => {
    if (items.length) trackEvent('begin_checkout', { value: subtotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) {
    return <p className="py-20 text-center text-gray-500">Your cart is empty.</p>;
  }

  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr({ ...addr, [k]: e.target.value });

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        shippingAddress: {
          name: addr.name.trim(),
          phone: addr.phone.trim(),
          line1: addr.line1.trim(),
          line2: addr.line2.trim() || undefined,
          city: addr.city.trim(),
          state: addr.state.trim() || undefined,
          pincode: addr.pincode.trim(),
        },
        paymentMethod: 'cod' as const,
        notes: notes.trim() || undefined,
      };
      const r = await storeApi.post('/orders', body);
      const order = r.data.data;
      trackEvent('purchase', { value: order.total });
      clear();
      toast.success(`Order ${order.orderNumber} placed!`);
      navigate('/shop/orders');
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={place} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-1 text-sm text-gray-500">Cash on delivery. Online payment coming soon.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <F label="Full name" value={addr.name} onChange={set('name')} />
          <F label="Phone" value={addr.phone} onChange={set('phone')} />
          <F label="Address line 1" value={addr.line1} onChange={set('line1')} full />
          <F label="Address line 2" value={addr.line2} onChange={set('line2')} required={false} full />
          <F label="City" value={addr.city} onChange={set('city')} />
          <F label="State" value={addr.state} onChange={set('state')} required={false} />
          <F label="Pincode" value={addr.pincode} onChange={set('pincode')} />
          <F label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} required={false} full />
        </div>
      </div>

      <div className="h-fit rounded-xl border bg-white p-4">
        <p className="font-semibold">Order summary</p>
        <div className="mt-3 space-y-2 text-sm">
          {items.map((i) => (
            <div key={i.variantId} className="flex justify-between gap-2">
              <span className="min-w-0 truncate text-gray-600">{i.productName} ({i.color}/{i.size}) ×{i.quantity}</span>
              <span>{formatCurrency(i.price * i.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatCurrency(subtotal)}</span></div>
        <button disabled={busy} className="mt-4 w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Placing…' : 'Place order (COD)'}
        </button>
      </div>
    </form>
  );
}

function F({ label, value, onChange, required = true, full = false }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; full?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium">{label}</span>
      <input value={value} onChange={onChange} required={required} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#A61E57]" />
    </label>
  );
}
