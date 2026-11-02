import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ArrowLeft, ChevronRight, Layers, Sparkles, AlertCircle, RefreshCw, Check } from 'lucide-react';
import {
  storeApi,
  trackEvent,
  type StoreProduct,
  type StoreCollection,
  type StoreFilterOptions,
  type StoreCategoryItem,
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

function isFacetDisabled(key: keyof StoreFilterOptions, optsCount: number, activeCategory?: string): boolean {
  if (optsCount === 0) return true;
  const isJewel = activeCategory && /jewel/i.test(activeCategory);
  if (isJewel) {
    // For jewellery, apparel-specific attributes like gher are disabled
    const apparelFacets = ['gher', 'dupatta', 'blouseSize', 'backOpening', 'sleeves', 'backClosure', 'bottomType'];
    if (apparelFacets.includes(key)) return true;
  }
  const isKids = activeCategory && /kid|girl|boy/i.test(activeCategory);
  if (isKids) {
    if (['blouseSize'].includes(key)) return true;
  }
  return false;
}

export default function Home() {
  const [params, setSearchParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const categoryParam = params.get('category') ?? '';
  const subCategoryParam = params.get('subCategory') ?? '';
  const sortParam = params.get('sort') ?? 'newest';
  const colorParam = params.get('color') ?? '';

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [options, setOptions] = useState<StoreFilterOptions | null>(null);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [categoryTree, setCategoryTree] = useState<StoreCategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<StoreCategoryItem | null>(null);

  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync category, subCategory, sort, color from URL into local filters state
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      if (categoryParam) next.category = categoryParam;
      else delete next.category;
      if (subCategoryParam) next.subCategory = subCategoryParam;
      else delete next.subCategory;
      if (colorParam) next.color = colorParam;
      else delete next.color;
      return next;
    });
  }, [categoryParam, subCategoryParam, colorParam]);

  // Is user actively browsing/filtering products?
  // Front page only shows categories when NOT searching, sorting, or filtering.
  const activeCount = useMemo(() => {
    return Object.entries(filters).filter(([k, v]) => Boolean(v) && k !== 'category' && k !== 'subCategory').length;
  }, [filters]);

  const isBrowsingProducts = Boolean(q || categoryParam || subCategoryParam || activeCount > 0 || sortParam !== 'newest');

  // Load collections, category-tree, and initial filters
  useEffect(() => {
    trackEvent('page_view', { path: '/shop' });
    storeApi
      .get('/collections', { params: { featured: true } })
      .then((r) => setCollections(r.data.data as StoreCollection[]))
      .catch(() => undefined);

    storeApi
      .get('/products/category-tree')
      .then((r) => setCategoryTree(r.data.data as StoreCategoryItem[]))
      .catch(() => undefined);
  }, []);

  // Fetch contextual filter options based on category
  useEffect(() => {
    const filterQuery: Record<string, string> = {};
    if (categoryParam) filterQuery.category = categoryParam;
    storeApi
      .get('/products/filters', { params: filterQuery })
      .then((r) => setOptions(r.data.data as StoreFilterOptions))
      .catch(() => undefined);
  }, [categoryParam]);

  // Load products when browsing
  useEffect(() => {
    if (!isBrowsingProducts) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const apiParams: Record<string, string | number | boolean> = {
      inStock: true,
      limit: 60,
      sort: sortParam,
    };
    if (q) apiParams.search = q;
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
        console.error('Failed to load products:', err);
        setLoadError('Failed to load products. Please check your connection and try again.');
      })
      .finally(() => setLoading(false));

    if (q) trackEvent('search', { query: q });
  }, [q, filters, sortParam, isBrowsingProducts]);

  // Ensure "All items" collection is always at the very end
  const sortedCollections = useMemo(() => {
    const isAll = (c: StoreCollection) => c.handle === 'all-items' || /^all\s*items$/i.test(c.title);
    return [...collections].sort((a, b) => {
      const aAll = isAll(a);
      const bAll = isAll(b);
      if (aAll && !bAll) return 1;
      if (!aAll && bAll) return -1;
      return 0;
    });
  }, [collections]);

  // Navigation helpers that safely update URL search params (fixing back-button issue)
  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'newest') next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: false });
  };

  const setSort = (s: string) => updateParam('sort', s);

  const setFacet = (key: keyof StoreFilterOptions, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    if (key === 'category') updateParam('category', value || undefined);
    else if (key === 'subCategory') updateParam('subCategory', value || undefined);
    else if (key === 'color') updateParam('color', value || undefined);
  };

  // Toggle multi-color selection
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
    if (categoryParam) next.set('category', categoryParam);
    if (subCategoryParam) next.set('subCategory', subCategoryParam);
    setSearchParams(next, { replace: false });
  };

  const selectCategory = (cat: StoreCategoryItem) => {
    if (cat.subCategories.length === 0) {
      // Direct jump to products for this category
      const next = new URLSearchParams();
      next.set('category', cat.name);
      setSearchParams(next, { replace: false });
    } else {
      setSelectedCategory(cat);
    }
  };

  const selectSubCategory = (catName: string, subName?: string) => {
    const next = new URLSearchParams();
    next.set('category', catName);
    if (subName) next.set('subCategory', subName);
    setSearchParams(next, { replace: false });
    setSelectedCategory(null);
  };

  const backToCategories = () => {
    setSelectedCategory(null);
    setSearchParams(new URLSearchParams(), { replace: false });
    setFilters({});
  };

  // Extract selected colors list for multi-select UI
  const selectedColors = useMemo(() => {
    return (filters.color ? filters.color.split(',') : []).map((c) => c.trim()).filter(Boolean);
  }, [filters.color]);

  return (
    <div>
      {/* Hero Banner (shown on default landing) */}
      {!isBrowsingProducts && !selectedCategory && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#A61E57] to-[#d64c84] px-6 py-8 text-white shadow-sm sm:px-10 sm:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" /> Festive Collection
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-4xl">MNM Fashion</h1>
          <p className="mt-2 max-w-lg text-sm text-white/90 sm:text-base">
            Festive chaniya cholis, kurtas, kediyas &amp; more — handpicked in Wagholi, Pune. Cash on delivery available.
          </p>
        </div>
      )}

      {/* Shop by Collection (Compact, mobile-friendly grid so all collections fit on mobile screen) */}
      {!isBrowsingProducts && sortedCollections.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold sm:text-lg">Shop by Collection</h2>
            <span className="text-xs text-gray-400">All collections</span>
          </div>
          {/* Responsive 3-column grid on mobile (showing all collections at a glance) and 6-column on larger screens */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
            {sortedCollections.map((c) => (
              <Link
                key={c.id}
                to={`/shop/collection/${c.handle}`}
                className="group relative flex h-20 flex-col justify-end overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-[#A61E57]/15 to-[#d64c84]/25 p-2 text-center transition hover:scale-[1.02] hover:shadow-md sm:h-28"
              >
                {c.image && (
                  <img
                    src={c.image}
                    alt={c.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <span className="relative z-10 text-[11px] font-semibold leading-tight text-white drop-shadow sm:text-xs">
                  {c.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FRONT PAGE: Categories view when not actively browsing products */}
      {!isBrowsingProducts && (
        <div>
          {/* If a category is clicked, show its subcategories */}
          {selectedCategory ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              <button
                onClick={() => setSelectedCategory(null)}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#A61E57] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Categories
              </button>

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">{selectedCategory.name}</h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Choose a sub-category below to explore matching designs.
                  </p>
                </div>
                <button
                  onClick={() => selectSubCategory(selectedCategory.name)}
                  className="rounded-xl bg-[#A61E57] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#8e1a4a]"
                >
                  View All in {selectedCategory.name} ({selectedCategory.count})
                </button>
              </div>

              {/* Subcategories Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {selectedCategory.subCategories.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => selectSubCategory(selectedCategory.name, sub)}
                    className="group flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-left transition hover:border-[#A61E57] hover:bg-white hover:shadow-sm"
                  >
                    <span className="text-sm font-medium text-gray-800 group-hover:text-[#A61E57]">{sub}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[#A61E57]" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Front page category cards list */
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold sm:text-xl">Shop by Category</h2>
                  <p className="text-xs text-gray-500">Select a category to explore designs &amp; sub-categories</p>
                </div>
              </div>

              {categoryTree.length === 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                  {categoryTree.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => selectCategory(cat)}
                      className="group relative flex h-36 flex-col justify-end overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#A61E57]/10 to-[#d64c84]/20 p-4 text-left transition hover:scale-[1.02] hover:border-[#A61E57]/40 hover:shadow-md sm:h-44"
                    >
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[#A61E57]/30">
                          <Layers className="h-12 w-12" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                      <div className="relative z-10">
                        <span className="block text-sm font-bold text-white drop-shadow sm:text-base">
                          {cat.name}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/80">
                          <span>{cat.count} {cat.count === 1 ? 'item' : 'items'}</span>
                          {cat.subCategories.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{cat.subCategories.length} sub-categories</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BROWSING VIEW: When a category/search/filter is selected, display toolbar & products */}
      {isBrowsingProducts && (
        <div>
          {/* Breadcrumb / Navigation back to categories */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={backToCategories}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:border-[#A61E57] hover:text-[#A61E57]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Categories
              </button>
              {categoryParam && (
                <span className="text-xs font-medium text-gray-500">
                  Category: <span className="font-semibold text-gray-800">{categoryParam}</span>
                  {subCategoryParam && (
                    <> · <span className="text-[#A61E57]">{subCategoryParam}</span></>
                  )}
                </span>
              )}
            </div>
            {activeCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#A61E57]"
              >
                <X className="h-3.5 w-3.5" /> Clear filters ({activeCount})
              </button>
            )}
          </div>

          {/* Filter + Sort toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium shadow-sm transition hover:border-[#A61E57]"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#A61E57]" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>

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

          {/* Multi-Colour Filter Strip (for quick multi-color filtering) */}
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
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter Products</span>
                <button onClick={() => setShowFilters(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {FACETS.map(({ key, label }) => {
                  const opts = (options?.[key] ?? []) as (string | number)[];
                  const disabled = isFacetDisabled(key, opts.length, categoryParam);

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

          {/* Error State */}
          {loadError && (
            <div className="my-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-[#A61E57]" />
              <p className="mt-2 text-sm text-rose-800">{loadError}</p>
              <button
                onClick={() => {
                  setFilters({ ...filters });
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#A61E57] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#8e1a4a]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}

          {/* Product Grid / Loading / Empty */}
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : products.length === 0 && !loadError ? (
            <div className="py-20 text-center">
              <p className="text-base font-medium text-gray-700">No products match these filters.</p>
              <p className="mt-1 text-xs text-gray-400">Try clearing some filters or changing your selection.</p>
              <button
                onClick={clearAllFilters}
                className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-[#A61E57] hover:border-[#A61E57]"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
