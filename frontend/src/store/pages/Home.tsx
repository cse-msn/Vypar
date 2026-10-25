import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { storeApi, trackEvent, type StoreProduct, type StoreCollection } from '../lib/storeApi';
import { ProductCard } from '../components/ProductCard';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const browsing = !!q || !!category;

  useEffect(() => {
    trackEvent('page_view', { path: '/shop' });
    storeApi.get('/products/categories').then((r) => setCategories(r.data.data as string[])).catch(() => undefined);
    storeApi.get('/collections', { params: { featured: true } }).then((r) => setCollections(r.data.data as StoreCollection[])).catch(() => undefined);
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
    next.delete('q');
    setParams(next);
  };

  return (
    <div>
      {/* Hero — only on the default landing view */}
      {!browsing && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#A61E57] to-[#d64c84] px-6 py-10 text-white sm:px-10 sm:py-14">
          <h1 className="text-2xl font-bold sm:text-4xl">MNM Fashion</h1>
          <p className="mt-2 max-w-lg text-sm text-white/90 sm:text-base">
            Festive chaniya cholis, kurtas, kediyas &amp; more — handpicked in Wagholi, Pune. Cash on delivery available.
          </p>
        </div>
      )}

      {/* Featured collections */}
      {!browsing && collections.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Shop by collection</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {collections.map((c) => (
              <Link
                key={c.id}
                to={`/shop/collection/${c.handle}`}
                className="relative flex h-28 w-44 shrink-0 items-end overflow-hidden rounded-xl border bg-gray-100 p-3"
              >
                {c.image && <img src={c.image} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />}
                <span className="relative rounded bg-white/90 px-2 py-1 text-sm font-semibold">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
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
