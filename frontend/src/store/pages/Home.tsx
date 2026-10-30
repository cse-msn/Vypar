import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { storeApi, trackEvent, type StoreProduct, type StoreCollection, type StoreFilterOptions } from '../lib/storeApi';
import { ProductCard } from '../components/ProductCard';

// Facet dropdowns, in the order the shop asked for (sub-category right after category).
const FACETS: { key: keyof StoreFilterOptions; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'subCategory', label: 'Sub-category' },
  { key: 'gender', label: 'Gender' },
  { key: 'color', label: 'Colour' },
  { key: 'dupatta', label: 'Dupatta' },
  { key: 'backOpening', label: 'Back opening' },
  { key: 'blouseSize', label: 'Blouse size' },
  { key: 'gher', label: 'Gher' },
  { key: 'sleeves', label: 'Sleeves' },
  { key: 'backClosure', label: 'Back knot / hook' },
  { key: 'bottomType', label: 'Pant / Dhoti' },
  { key: 'sizeGroup', label: 'Size group' },
  { key: 'size', label: 'Size' },
  { key: 'fabric', label: 'Fabric' },
];

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'gher', label: 'Gher' },
];

type Filters = Partial<Record<keyof StoreFilterOptions, string>>;

export default function Home() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [options, setOptions] = useState<StoreFilterOptions | null>(null);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const browsing = !!q || activeCount > 0 || sort !== 'newest';

  useEffect(() => {
    trackEvent('page_view', { path: '/shop' });
    storeApi.get('/products/filters').then((r) => setOptions(r.data.data as StoreFilterOptions)).catch(() => undefined);
    storeApi.get('/collections', { params: { featured: true } }).then((r) => setCollections(r.data.data as StoreCollection[])).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number | boolean> = { inStock: true, limit: 60, sort };
    if (q) params.search = q;
    for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
    storeApi
      .get('/products', { params })
      .then((r) => setProducts(r.data.data as StoreProduct[]))
      .finally(() => setLoading(false));
    if (q) trackEvent('search', { query: q });
  }, [q, filters, sort]);

  const setFacet = (key: keyof StoreFilterOptions, value: string) =>
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  const clearAll = () => { setFilters({}); setSort('newest'); };

  return (
    <div>
      {!browsing && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#A61E57] to-[#d64c84] px-6 py-10 text-white sm:px-10 sm:py-14">
          <h1 className="text-2xl font-bold sm:text-4xl">MNM Fashion</h1>
          <p className="mt-2 max-w-lg text-sm text-white/90 sm:text-base">
            Festive chaniya cholis, kurtas, kediyas &amp; more — handpicked in Wagholi, Pune. Cash on delivery available.
          </p>
        </div>
      )}

      {!browsing && collections.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Shop by collection</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {collections.map((c) => (
              <Link key={c.id} to={`/shop/collection/${c.handle}`} className="relative flex h-28 w-44 shrink-0 items-end overflow-hidden rounded-xl border bg-gray-100 p-3">
                {c.image && <img src={c.image} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />}
                <span className="relative rounded bg-white/90 px-2 py-1 text-sm font-semibold">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filter + sort toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:border-gray-300"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        {activeCount > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#A61E57]">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-500">Sort by</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#A61E57]"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3 lg:grid-cols-4">
          {FACETS.map(({ key, label }) => {
            const opts = (options?.[key] ?? []) as (string | number)[];
            return (
              <label key={key} className="block">
                <span className="text-xs font-medium text-gray-600">{label}</span>
                <select
                  value={filters[key] ?? ''}
                  onChange={(e) => setFacet(key, e.target.value)}
                  disabled={opts.length === 0}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#A61E57] disabled:bg-gray-50 disabled:text-gray-300"
                >
                  <option value="">All</option>
                  {opts.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
                </select>
              </label>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-gray-500">No products match these filters{q ? ` for “${q}”` : ''}.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
