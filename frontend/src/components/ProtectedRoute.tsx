import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LoadingScreen } from '@/components/ui/spinner';
import type { Role } from '@/types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Checking your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
