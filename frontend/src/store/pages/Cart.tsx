import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus } from 'lucide-react';
import { useCart } from '../CartContext';
import { useStoreAuth } from '../StoreAuthContext';
import { formatCurrency } from '@/lib/format';

export default function Cart() {
  const { items, subtotal, setQty, remove } = useCart();
  const { customer } = useStoreAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Your cart is empty.</p>
        <Link to="/shop" className="mt-3 inline-block rounded-lg bg-[#A61E57] px-5 py-2 font-medium text-white">Shop now</Link>
      </div>
    );
  }

  const checkout = () => navigate(customer ? '/shop/checkout' : '/shop/login?next=/shop/checkout');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.variantId} className="flex gap-3 rounded-xl border bg-white p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.productName}</p>
              <p className="text-xs text-gray-500">{i.color} / {i.size} · {i.designNumber}</p>
              <p className="mt-1 font-semibold text-[#A61E57]">{formatCurrency(i.price)}</p>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setQty(i.variantId, i.quantity - 1)} className="rounded border p-1"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-8 text-center text-sm">{i.quantity}</span>
                <button onClick={() => setQty(i.variantId, i.quantity + 1)} className="rounded border p-1"><Plus className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i.variantId)} className="ml-auto text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="text-right font-semibold">{formatCurrency(i.price * i.quantity)}</div>
          </div>
        ))}
      </div>

      <div className="h-fit rounded-xl border bg-white p-4">
        <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between text-sm text-gray-600"><span>Shipping</span><span>Free</span></div>
        <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatCurrency(subtotal)}</span></div>
        <button onClick={checkout} className="mt-4 w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white hover:bg-[#8e1a4a]">
          {customer ? 'Proceed to checkout' : 'Login & checkout'}
        </button>
        <Link to="/shop" className="mt-3 block text-center text-sm text-gray-500 underline">Continue shopping</Link>
      </div>
    </div>
  );
}
