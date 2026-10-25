import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import type { StoreProduct } from '../lib/storeApi';

export function ProductCard({ p }: { p: StoreProduct }) {
  const hasCompare = !!p.compareAtPrice && p.compareAtPrice > p.price;
  const off = hasCompare ? Math.round(((p.compareAtPrice! - p.price) / p.compareAtPrice!) * 100) : 0;

  return (
    <Link
      to={`/shop/product/${p.id}`}
      className="group relative overflow-hidden rounded-xl border bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">No image</div>
        )}
        {hasCompare && (
          <span className="absolute left-2 top-2 rounded-full bg-[#A61E57] px-2 py-0.5 text-xs font-bold text-white">{off}% OFF</span>
        )}
        {!p.inStock && (
          <span className="absolute right-2 top-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-xs font-medium text-white">Sold out</span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{p.name}</p>
        <p className="truncate text-xs text-gray-500">{p.category}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold text-[#A61E57]">{formatCurrency(p.price)}</span>
          {hasCompare && <span className="text-xs text-gray-400 line-through">{formatCurrency(p.compareAtPrice!)}</span>}
        </div>
      </div>
    </Link>
  );
}
