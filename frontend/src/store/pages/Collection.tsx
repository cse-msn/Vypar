import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ArrowLeft, Check, AlertCircle, RefreshCw } from 'lucide-react';
import {
  storeApi,
  trackEvent,
  type StoreProduct,
  type StoreCollection,
  type StoreFilterOptions,
} from '../lib/storeApi';
import { ProductCard } from '../components/ProductCard';

// Facet dropdowns: "Category" is renamed to "Collection" per requirement.
const FACETS: { key: keyof StoreFilterOptions; label: string }[] = [
  { key: 'category', label: 'Collection' }, // Renamed from Category to Collection
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

function isFacetDisabledForCollection(key: keyof StoreFilterOptions, optsCount: number, collectionHandle?: string): boolean {
  if (optsCount === 0) return true;
  const isJewel = collectionHandle && /jewel/i.test(collectionHandle);
  if (isJewel) {
    // For jewellery collection, apparel attributes like gher are disabled
    const apparelFacets = ['gher', 'dupatta', 'blouseSize', 'backOpening', 'sleeves', 'backClosure', 'bottomType'];
    if (apparelFacets.includes(key)) return true;
  }
  const isKids = collectionHandle && /kid/i.test(collectionHandle);
  if (isKids) {
    if (['blouseSize'].includes(key)) return true;
  }
  return false;
}

export default function Collection() {
  const { handle } = useParams();
  const [params, setSearchParams] = useSearchParams();
  const sortParam = params.get('sort') ?? 'newest';
  const colorParam = params.get('color') ?? '';

  const [collection, setCollection] = useState<StoreCollection | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [options, setOptions] = useState<StoreFilterOptions | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync color from URL into filters
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      if (colorParam) next.color = colorParam;
      else delete next.color;
      return next;
    });
  }, [colorParam]);

  const activeCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length;
  }, [filters]);

  // Load collection metadata and collection-specific filter facets
  useEffect(() => {
    if (!handle) return;
    trackEvent('page_view', { path: `/shop/collection/${handle}` });

    storeApi
      .get(`/collections/${handle}`)
      .then((r) => setCollection(r.data.data as StoreCollection))
      .catch(() => {
        // Fallback for virtual collections like 'all-items'
        if (handle === 'all-items') {
          setCollection({
            id: 'all-items',
            title: 'All Items',
            handle: 'all-items',
            featured: true,
            description: 'Explore our complete fashion catalog.',
          });
        } else {
          setCollection(null);
        }
      });

    // Fetch filters contextual to this collection
    storeApi
      .get('/products/filters', { params: { collection: handle } })
      .then((r) => setOptions(r.data.data as StoreFilterOptions))
      .catch(() => undefined);
  }, [handle]);

  // Load products matching collection + filters + sort
  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setLoadError(null);

    const apiParams: Record<string, string | number | boolean> = {
      collection: handle,
      inStock: true,
      limit: 60,
      sort: sortParam,
    };
    for (const [k, v] of Object.entries(filters)) {
      if (v) apiParams[k] = v;
    }

    storeApi
      .get('/products', { params: apiParams })
      .then((r) => {
        setProducts(r.data.data as StoreProduct[]);
        setLoadError(null);
      })
      .catch((err) => {
        console.error('Failed to load collection products:', err);
        setLoadError('Failed to load products. Please check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [handle, filters, sortParam]);

  // Safe URL parameter updates (fixes back-button error)
  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'newest') next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: false });
  };

  const setSort = (s: string) => updateParam('sort', s);

  const setFacet = (key: keyof StoreFilterOptions, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    if (key === 'color') updateParam('color', value || undefined);
  };

  const toggleColor = (colorName: string) => {
    const current = (filters.color ? filters.color.split(',') : []).map((c) => c.trim()).filter(Boolean);
    const exists = current.includes(colorName);
    const next = exists ? current.filter((c) => c !== colorName) : [...current, colorName];
    const val = next.join(',');
    setFacet('color', val);
  };

  const clearAllFilters = () => {
    setFilters({});
    const next = new URLSearchParams();
    setSearchParams(next, { replace: false });
  };

  const selectedColors = useMemo(() => {
    return (filters.color ? filters.color.split(',') : []).map((c) => c.trim()).filter(Boolean);
  }, [filters.color]);

  return (
    <div>
      <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#A61E57]">
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>

      <div className="mt-2 mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{collection?.title ?? 'Collection'}</h1>
        {collection?.description && <p className="mt-1 text-sm text-gray-500">{collection.description}</p>}
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium shadow-sm transition hover:border-[#A61E57]"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#A61E57]" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        {activeCount > 0 && (
          <button onClick={clearAllFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#A61E57]">
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Sort by</label>
          <select
            value={sortParam}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium outline-none transition focus:border-[#A61E57]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Multi-Colour Filter Quick Strip */}
      {options?.color && options.color.length > 0 && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-medium text-gray-500">Colours:</span>
          {options.color.map((c) => {
            const isSelected = selectedColors.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleColor(c)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${
                  isSelected
                    ? 'bg-[#A61E57] font-semibold text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {isSelected && <Check className="h-3 w-3" />}
                {c}
              </button>
            );
          })}
        </div>
      )}

      {/* Extended Facets Grid */}
      {showFilters && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter Collection</span>
            <button onClick={() => setShowFilters(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {FACETS.map(({ key, label }) => {
              const opts = (options?.[key] ?? []) as (string | number)[];
              const disabled = isFacetDisabledForCollection(key, opts.length, handle);

              return (
                <label key={key} className={`block ${disabled ? 'opacity-50' : ''}`}>
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                  <select
                    value={filters[key] ?? ''}
                    onChange={(e) => setFacet(key, e.target.value)}
                    disabled={disabled}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none transition focus:border-[#A61E57] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">{disabled ? 'Not applicable' : 'All'}</option>
                    {!disabled &&
                      opts.map((o) => (
                        <option key={String(o)} value={String(o)}>
                          {String(o)}
                        </option>
                      ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Error state */}
      {loadError && (
        <div className="my-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-[#A61E57]" />
          <p className="mt-2 text-sm text-rose-800">{loadError}</p>
          <button
            onClick={() => setFilters({ ...filters })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#A61E57] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#8e1a4a]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : products.length === 0 && !loadError ? (
        <div className="py-20 text-center">
          <p className="text-base font-medium text-gray-700">No products match these filters in this collection.</p>
          <p className="mt-1 text-xs text-gray-400">Try clearing some filters or changing your selection.</p>
          {activeCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-[#A61E57] hover:border-[#A61E57]"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
