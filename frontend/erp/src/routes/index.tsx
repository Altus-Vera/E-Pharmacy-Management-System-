import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { LoginPage } from "../pages/Login";
import { DashboardPage } from "../pages/Dashboard";
import { InventoryPage } from "../pages/Inventory";
import { SuppliersPage } from "../pages/Suppliers";
import { PurchaseOrdersPage } from "../pages/PurchaseOrders";
import { CustomersPage } from "../pages/Customers";
import { DoctorsPage } from "../pages/Doctors";
import { PrescriptionsPage } from "../pages/Prescriptions";
import { UserManagementPage } from "../pages/UserManagement";
import { ReportsPage } from "../pages/Reports";
import { StockLocationsPage } from "../pages/StockLocations";
import { UnitsOfMeasurePage } from "../pages/UnitsOfMeasure";
import { StockViewPage } from "../pages/StockView";
import { GoodsReceiptsPage } from "../pages/GoodsReceipts";
import { PurchaseRequisitionsPage } from "../pages/PurchaseRequisitions";
import { PurchaseInvoicesPage } from "../pages/PurchaseInvoices";
import { SalesReturnsPage } from "../pages/SalesReturns";
import { OutletsPage } from "../pages/Outlets";
import { StockTransfersPage } from "../pages/StockTransfers";
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
        <Route path="customers" element={<CustomersPage />} />
        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="stock-locations" element={<StockLocationsPage />} />
        <Route path="uom" element={<UnitsOfMeasurePage />} />
        <Route path="stock-view" element={<StockViewPage />} />
        <Route path="grn" element={<GoodsReceiptsPage />} />
        <Route path="purchase-requisitions" element={<PurchaseRequisitionsPage />} />
        <Route path="purchase-invoices" element={<PurchaseInvoicesPage />} />
        <Route path="sales-returns" element={<SalesReturnsPage />} />
        <Route path="outlets" element={<OutletsPage />} />
        <Route path="stock-transfers" element={<StockTransfersPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
