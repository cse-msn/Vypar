import { Navigate, useSearchParams } from 'react-router-dom';

// Sign-up now happens through the unified WhatsApp-OTP login flow, so /shop/register
// just forwards to /shop/login (preserving any ?next= target) for old links/bookmarks.
export default function Register() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/shop';
  return <Navigate to={`/shop/login?next=${encodeURIComponent(next)}`} replace />;
}
