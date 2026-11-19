import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { LoginPage } from "../pages/Login";
import { DispensingPage } from "../pages/Dispensing";
import { CustomerPage } from "../pages/Customer";
import { PrescriptionPage } from "../pages/Prescription";
import { useAuthStore } from "../store/authStore";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
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
        <Route index element={<DispensingPage />} />
        <Route path="customers" element={<CustomerPage />} />
        <Route path="prescriptions" element={<PrescriptionPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
