import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { storeApi, trackEvent, type StoreProduct } from '../lib/storeApi';
import { useCart } from '../CartContext';
import { formatCurrency } from '@/lib/format';

export default function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [p, setP] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [img, setImg] = useState(0);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    storeApi
      .get(`/products/${id}`)
      .then((r) => {
        const prod = r.data.data as StoreProduct;
        setP(prod);
        trackEvent('view_product', { productId: prod.id, path: `/shop/product/${prod.id}` });
      })
      .catch(() => setP(null))
      .finally(() => setLoading(false));
  }, [id]);

  const colors = useMemo(() => Array.from(new Set((p?.variants ?? []).map((v) => v.color))), [p]);
  const sizesForColor = useMemo(
    () => (p?.variants ?? []).filter((v) => v.color === color),
    [p, color],
  );
  const selected = useMemo(
    () => (p?.variants ?? []).find((v) => v.color === color && v.size === size),
    [p, color, size],
  );

  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-gray-100" />;
  if (!p) return <p className="py-20 text-center text-gray-500">Product not found. <Link className="underline" to="/shop">Back to shop</Link></p>;

  const addToCart = () => {
    if (!selected) return toast.error('Please choose colour and size');
    if (!selected.inStock) return toast.error('That option is out of stock');
    add({
      productId: p.id,
      variantId: selected.id,
      designNumber: p.designNumber,
      productName: p.name,
      color: selected.color,
      size: selected.size,
      price: p.price,
      image: p.images[0],
    });
    trackEvent('add_to_cart', { productId: p.id, variantId: selected.id, quantity: 1, value: p.price });
    toast.success('Added to cart');
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="aspect-square overflow-hidden rounded-xl border bg-gray-100">
          {p.images[img] ? (
            <img src={p.images[img]} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">No image</div>
          )}
        </div>
        {p.images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {p.images.map((src, i) => (
              <button key={i} onClick={() => setImg(i)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === img ? 'border-[#A61E57]' : 'border-transparent'}`}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''}</p>
        <h1 className="mt-1 text-2xl font-bold">{p.name}</h1>
        <p className="mt-2 text-2xl font-semibold text-[#A61E57]">{formatCurrency(p.price)}</p>
        {p.description && <p className="mt-4 text-sm leading-relaxed text-gray-600">{p.description}</p>}

        {/* Colour */}
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Colour</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setSize(''); }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${color === c ? 'border-[#A61E57] bg-[#A61E57]/5 font-medium' : 'border-gray-200'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        {color && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map((v) => (
                <button
                  key={v.id}
                  disabled={!v.inStock}
                  onClick={() => setSize(v.size)}
                  className={`min-w-11 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${size === v.size ? 'border-[#A61E57] bg-[#A61E57]/5 font-medium' : 'border-gray-200'}`}
                >
                  {v.size}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={addToCart}
          className="mt-8 w-full rounded-xl bg-[#A61E57] py-3 font-semibold text-white transition hover:bg-[#8e1a4a] sm:w-auto sm:px-10"
        >
          Add to cart
        </button>
        <button onClick={() => navigate('/shop/cart')} className="mt-3 block text-sm text-gray-500 underline">
          Go to cart
        </button>
      </div>
    </div>
  );
}
