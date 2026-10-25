import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { storeApi, trackEvent, type StoreProduct, type StoreCollection } from '../lib/storeApi';
import { ProductCard } from '../components/ProductCard';

export default function Collection() {
  const { handle } = useParams();
  const [collection, setCollection] = useState<StoreCollection | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    trackEvent('page_view', { path: `/shop/collection/${handle}` });
    Promise.all([
      storeApi.get(`/collections/${handle}`).then((r) => setCollection(r.data.data as StoreCollection)).catch(() => setCollection(null)),
      storeApi
        .get('/products', { params: { collection: handle, inStock: true, limit: 60 } })
        .then((r) => setProducts(r.data.data as StoreProduct[])),
    ]).finally(() => setLoading(false));
  }, [handle]);

  return (
    <div>
      <Link to="/shop" className="text-sm text-gray-500 underline">← All products</Link>
      <h1 className="mt-2 text-2xl font-bold">{collection?.title ?? 'Collection'}</h1>
      {collection?.description && <p className="mt-1 text-sm text-gray-500">{collection.description}</p>}

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-gray-500">No products in this collection yet.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
