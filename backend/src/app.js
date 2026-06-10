// backend/src/app.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { corsOptions } from "./config/cors.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import propertiesRoutes from "./modules/properties/properties.routes.js";
import inventoryRoutes from "./modules/properties/inventory/inventory.routes.js";
import amenitiesRoutes from "./modules/amenities/amenities.routes.js";
import documentsRoutes from "./modules/documents/documents.routes.js";
import leadsRoutes from "./modules/leads/leads.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import tenantsRoutes from "./modules/tenants/tenants.routes.js";
import ownersRoutes from "./modules/owners/owners.routes.js";
import siteVisitsRoutes from "./modules/siteVisits/siteVisits.routes.js";
import bookingsRoutes from "./modules/bookings/bookings.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import agreementsRoutes from "./modules/agreements/agreements.routes.js";
import rentalsRoutes from "./modules/rentals/rentals.routes.js";
import accountsRoutes from "./modules/accounts/accounts.routes.js";
import commissionsRoutes from "./modules/commissions/commissions.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";

import "./modules/bookings/hold.scheduler.js";
import "./modules/notifications/scheduler.js";

const app = express();

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

app.use("/api/properties", propertiesRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/amenities", amenitiesRoutes);
app.use("/api/documents", documentsRoutes);

app.use("/api/leads", leadsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/tenants", tenantsRoutes);
app.use("/api/owners", ownersRoutes);

app.use("/api/site-visits", siteVisitsRoutes);
app.use("/api/bookings", bookingsRoutes);

app.use("/api/billing", billingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/agreements", agreementsRoutes);
app.use("/api/rentals", rentalsRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/commissions", commissionsRoutes);
app.use("/api/settings", settingsRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
