import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { LoginPage } from "../pages/Login";
import { DashboardPage } from "../pages/Dashboard";
import { InventoryPage } from "../pages/Inventory";
import { SuppliersPage } from "../pages/Suppliers";
import { PurchaseOrdersPage } from "../pages/PurchaseOrders";
import { UserManagementPage } from "../pages/UserManagement";
import { ReportsPage } from "../pages/Reports";
import { useAuthStore } from "../store/authStore";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
