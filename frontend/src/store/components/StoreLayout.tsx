import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, Search } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../CartContext';
import { useStoreAuth } from '../StoreAuthContext';

export function StoreLayout() {
  const { count } = useCart();
  const { customer, logout } = useStoreAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  return (
    <div className="min-h-screen bg-[#FBF8FA] text-[#1b1b1b]">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/shop" className="shrink-0 text-xl font-bold tracking-tight text-[#A61E57]">
            MNM Fashion
          </Link>
          <form
            className="relative ml-2 hidden flex-1 sm:block"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/shop?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search designs…"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-[#A61E57]"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            {customer ? (
              <div className="flex items-center gap-2">
                <Link to="/shop/orders" className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
                  My orders
                </Link>
                <button onClick={logout} className="rounded-full px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/shop/login" className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
                <User className="h-4 w-4" /> Login
              </Link>
            )}
            <Link to="/shop/cart" className="relative ml-1 rounded-full p-2 hover:bg-gray-100" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#A61E57] px-1 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mt-10 border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-gray-600">
            <Link to="/shop/contact" className="hover:text-[#A61E57]">Contact Us</Link>
            <Link to="/shop/refund-policy" className="hover:text-[#A61E57]">Refund Policy</Link>
            <Link to="/shop/terms" className="hover:text-[#A61E57]">Terms &amp; Conditions</Link>
          </nav>
          <p className="mt-4 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} MNM Fashion, Wagholi, Pune · <Link to="/login" className="underline">Staff login</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
