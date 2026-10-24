import { Routes, Route } from 'react-router-dom';
import { StoreAuthProvider } from './StoreAuthContext';
import { CartProvider } from './CartContext';
import { StoreLayout } from './components/StoreLayout';
import Home from './pages/Home';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import Orders from './pages/Orders';

// Customer-facing storefront, mounted at /shop/* (public — separate from the admin app).
export default function StoreApp() {
  return (
    <StoreAuthProvider>
      <CartProvider>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="product/:id" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="orders" element={<Orders />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </CartProvider>
    </StoreAuthProvider>
  );
}
