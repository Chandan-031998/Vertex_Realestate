# Vertex ERP — Real Estate Module (Full-Stack Starter)

Tech Stack:
- Frontend: React (Vite) + Tailwind CSS
- Backend: Node.js + Express.js
- Database: MySQL
- Auth: JWT (Role-based access control)
- Architecture: REST APIs

## Quick Start (Local)

### 1) Start MySQL (Docker optional)
If you use Docker:
```bash
docker compose up -d mysql
```

Or use local MySQL and update `backend/.env`.

### 2) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend runs on: http://localhost:4000

### 3) Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on: http://localhost:5173

## Seed Admin
- Email: admin@vertex.local
- Password: Admin@123
(You can change in `backend/src/database/seed.js`)

## Modules Included (Scaffold)
- Auth + Users + RBAC
- Properties & Inventory (towers/floors/units)
- Uploads: images + brochure PDF + documents vault
- QR code for Property ID
- Leads & CRM pipeline + dedupe + scoring + CSV import
- Customers & Tenants (basic)
- Site Visits + Bookings (hold expiry scheduler)
- Billing (invoices/payments basic)
- Notifications (internal + cron scheduler skeleton)
- Reports/Dashboard (sample endpoints)

> This is a starter scaffold meant for rapid extension in your Vertex ERP ecosystem.
# Vertex_Realestate
