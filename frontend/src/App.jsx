import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import Dashboard from "./pages/dashboard/Dashboard.jsx";
import PropertyList from "./pages/properties/PropertyList.jsx";
import PropertyView from "./pages/properties/PropertyView.jsx";
import LeadsList from "./pages/leads/LeadsList.jsx";
import CustomersList from "./pages/customers/CustomersList.jsx";
import BookingsList from "./pages/bookings/BookingsList.jsx";
import Invoices from "./pages/billing/Invoices.jsx";
import Reports from "./pages/reports/Reports.jsx";
import UserManagement from "./pages/admin/UserManagement.jsx";
import AppSettings from "./pages/admin/AppSettings.jsx";
import AgreementsLegal from "./pages/legal/AgreementsLegal.jsx";
import RentalsManagement from "./pages/rentals/RentalsManagement.jsx";
import AccountsFinance from "./pages/accounts/AccountsFinance.jsx";
import Commissions from "./pages/commissions/Commissions.jsx";
import AgentMobilePanel from "./pages/agent/AgentMobilePanel.jsx";

import { isAuthed } from "./store/auth.store.js";

function Protected({ children }) {
  return isAuthed() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/app"
        element={
          <Protected>
            <DashboardLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="properties" element={<PropertyList />} />
        <Route path="properties/:id" element={<PropertyView />} />
        <Route path="leads" element={<LeadsList />} />
        <Route path="customers" element={<CustomersList />} />
        <Route path="bookings" element={<BookingsList />} />
        <Route path="rentals" element={<RentalsManagement />} />
        <Route path="billing/invoices" element={<Invoices />} />
        <Route path="accounts/finance" element={<AccountsFinance />} />
        <Route path="commissions" element={<Commissions />} />
        <Route path="agent/mobile" element={<AgentMobilePanel />} />
        <Route path="reports" element={<Reports />} />
        <Route path="legal/agreements" element={<AgreementsLegal />} />
        <Route path="admin/users" element={<UserManagement />} />
        <Route path="admin/settings" element={<AppSettings />} />
      </Route>

      <Route path="*" element={<div className="p-8">Not found</div>} />
    </Routes>
  );
}
