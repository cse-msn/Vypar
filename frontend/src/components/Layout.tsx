import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ScanLine,
  ReceiptText,
  Users,
  Truck,
  Building2,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useOnline } from '@/hooks/useOnline';
import { OfflineBanner } from './OfflineBanner';
import { InstallPrompt } from './InstallPrompt';
import { UpdatePrompt } from './UpdatePrompt';
import type { Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/billing', label: 'New Bill', icon: ShoppingCart },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/stock', label: 'Stock Lookup', icon: ScanLine },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/purchases', label: 'Purchases', icon: Truck },
  { to: '/suppliers', label: 'Suppliers', icon: Building2 },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner'] },
];

const BOTTOM_NAV = NAV.slice(0, 5); // Dashboard, Bill, Products, Stock, Invoices

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-display text-lg font-semibold text-primary-foreground ring-1 ring-gold/40">
        M
      </div>
      <span className="font-display text-xl font-semibold tracking-tight">MNM Fashion</span>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleNav = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="px-2 py-2">
          <Brand />
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-2 border-t pt-3">
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', online ? 'bg-success' : 'bg-warning')} />
            {online ? 'Online' : 'Offline'}
          </div>
          <div className="truncate px-2 py-1 text-sm font-medium">{user?.name}</div>
          <div className="truncate px-2 text-xs capitalize text-muted-foreground">{user?.role}</div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-2.5 md:hidden">
          <Brand />
          <span className={cn('h-2.5 w-2.5 rounded-full', online ? 'bg-success' : 'bg-warning')} />
        </header>

        <OfflineBanner />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
        >
          <MenuIcon className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* Mobile "More" drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <Brand />
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium',
                      isActive ? 'border-primary bg-primary/5 text-primary' : 'text-foreground',
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user?.name}</div>
                <div className="truncate text-xs capitalize text-muted-foreground">{user?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />
      <UpdatePrompt />
    </div>
  );
}
