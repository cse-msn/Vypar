import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storeApi, type StoreOrder } from '../lib/storeApi';
import { useStoreAuth } from '../StoreAuthContext';
import { formatCurrency, formatDate } from '@/lib/format';

export default function Orders() {
  const { customer, loading } = useStoreAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !customer) navigate('/shop/login?next=/shop/orders');
  }, [loading, customer, navigate]);

  useEffect(() => {
    if (!customer) return;
    storeApi.get('/orders').then((r) => setOrders(r.data.data as StoreOrder[])).finally(() => setBusy(false));
  }, [customer]);

  if (busy) return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;

  if (orders.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">No orders yet.</p>
        <Link to="/shop" className="mt-3 inline-block rounded-lg bg-[#A61E57] px-5 py-2 font-medium text-white">Start shopping</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My orders</h1>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o._id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{o.orderNumber}</p>
                <p className="text-xs text-gray-500">{formatDate(o.placedAt || o.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium capitalize text-amber-800">{o.status}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium uppercase text-gray-600">{o.paymentMethod}</span>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {o.items.map((i, idx) => (
                <span key={idx}>{i.productName} ({i.color}/{i.size}) ×{i.quantity}{idx < o.items.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
            <div className="mt-2 text-right font-semibold text-[#A61E57]">{formatCurrency(o.total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
