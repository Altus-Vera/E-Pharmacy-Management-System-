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
import { canAccess } from "../utils/roles";
import { SupplierReturnsPage } from "../pages/SupplierReturns";
import { AuditLogPage } from "../pages/AuditLog";
import { SystemPage } from "../pages/System";

function Guard({ path, children }: { path: string; children: React.ReactNode }) {
  const userType = useAuthStore((s) => s.user?.user_type);
  if (!canAccess(path, userType)) {
    return (
      <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
        <h2 style={{ color: "var(--color-danger)" }}>Access denied</h2>
        <p style={{ color: "var(--color-text-secondary)" }}>Your role does not have permission to open this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

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
        <Route path="inventory" element={<Guard path="/inventory"><InventoryPage /></Guard>} />
        <Route path="customers" element={<Guard path="/customers"><CustomersPage /></Guard>} />
        <Route path="doctors" element={<Guard path="/doctors"><DoctorsPage /></Guard>} />
        <Route path="prescriptions" element={<Guard path="/prescriptions"><PrescriptionsPage /></Guard>} />
        <Route path="suppliers" element={<Guard path="/suppliers"><SuppliersPage /></Guard>} />
        <Route path="purchase-orders" element={<Guard path="/purchase-orders"><PurchaseOrdersPage /></Guard>} />
        <Route path="stock-locations" element={<Guard path="/stock-locations"><StockLocationsPage /></Guard>} />
        <Route path="uom" element={<Guard path="/uom"><UnitsOfMeasurePage /></Guard>} />
        <Route path="stock-view" element={<Guard path="/stock-view"><StockViewPage /></Guard>} />
        <Route path="grn" element={<Guard path="/grn"><GoodsReceiptsPage /></Guard>} />
        <Route path="purchase-requisitions" element={<Guard path="/purchase-requisitions"><PurchaseRequisitionsPage /></Guard>} />
        <Route path="purchase-invoices" element={<Guard path="/purchase-invoices"><PurchaseInvoicesPage /></Guard>} />
        <Route path="sales-returns" element={<Guard path="/sales-returns"><SalesReturnsPage /></Guard>} />
        <Route path="outlets" element={<Guard path="/outlets"><OutletsPage /></Guard>} />
        <Route path="stock-transfers" element={<Guard path="/stock-transfers"><StockTransfersPage /></Guard>} />
        <Route path="users" element={<Guard path="/users"><UserManagementPage /></Guard>} />
        <Route path="supplier-returns" element={<Guard path="/supplier-returns"><SupplierReturnsPage /></Guard>} />
        <Route path="audit-log" element={<Guard path="/audit-log"><AuditLogPage /></Guard>} />
        <Route path="system" element={<Guard path="/system"><SystemPage /></Guard>} />
        <Route path="reports" element={<Guard path="/reports"><ReportsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
