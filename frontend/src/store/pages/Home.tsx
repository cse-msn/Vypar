import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { storeApi, trackEvent, type StoreProduct } from '../lib/storeApi';
import { formatCurrency } from '@/lib/format';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent('page_view', { path: '/shop' });
    storeApi.get('/products/categories').then((r) => setCategories(r.data.data as string[])).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    storeApi
      .get('/products', { params: { search: q || undefined, category: category || undefined, inStock: true, limit: 60 } })
      .then((r) => setProducts(r.data.data as StoreProduct[]))
      .finally(() => setLoading(false));
    if (q) trackEvent('search', { query: q });
  }, [q, category]);

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params);
    if (c) next.set('category', c);
    else next.delete('category');
    setParams(next);
  };

  return (
    <div>
      {/* Category chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={!category} onClick={() => setCategory('')}>All</Chip>
        {categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-gray-500">No products found{q ? ` for “${q}”` : ''}.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/shop/product/${p.id}`}
              className="group overflow-hidden rounded-xl border bg-white transition hover:shadow-md"
            >
              <div className="aspect-square overflow-hidden bg-gray-100">
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">No image</div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-gray-500">{p.category}</p>
                <p className="mt-1 font-semibold text-[#A61E57]">{formatCurrency(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? 'border-[#A61E57] bg-[#A61E57] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}
