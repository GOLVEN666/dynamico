import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { Onboarding } from '@/pages/Onboarding';
import { Dashboard } from '@/pages/Dashboard';
import { Products } from '@/pages/products/Products';
import { ProductFormPage } from '@/pages/products/ProductFormPage';
import { ProductDetail } from '@/pages/products/ProductDetail';
import { StockMovements } from '@/pages/StockMovements';
import { Warehouses } from '@/pages/Warehouses';
import { Suppliers } from '@/pages/Suppliers';
import { PurchaseOrders } from '@/pages/purchase-orders/PurchaseOrders';
import { NewPurchaseOrder } from '@/pages/purchase-orders/NewPurchaseOrder';
import { PurchaseOrderDetail } from '@/pages/purchase-orders/PurchaseOrderDetail';
import { Alerts } from '@/pages/Alerts';
import { Analytics } from '@/pages/Analytics';
import { Activity } from '@/pages/Activity';
import { Integrations } from '@/pages/Integrations';
import { Admin } from '@/pages/Admin';
import { Team } from '@/pages/Team';
import { Settings } from '@/pages/Settings';
import { NotFound } from '@/pages/NotFound';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  );
}

/** Blocks until the session is restored; redirects guests to /login. */
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Auth pages bounce signed-in users back into the app. */
function RedirectIfAuthed() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** The workspace shell: users without a workspace go to onboarding. */
function RequireWorkspace() {
  const { workspace, loading } = useWorkspace();
  if (loading) return <FullScreenLoader />;
  if (!workspace) return <Navigate to="/onboarding" replace />;
  return <AppLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public marketing site */}
        <Route path="/" element={<Landing />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<RequireWorkspace />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/products/:id/edit" element={<ProductFormPage />} />
            <Route path="/stock-movements" element={<StockMovements />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/purchase-orders/new" element={<NewPurchaseOrder />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/team" element={<Team />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
