# EXAMPRO — Online Examination & Student Assessment Management System

EXAMPRO is a full-stack web application built with React, Vite, Tailwind CSS, Express.js, and MongoDB/Mongoose for managing online examinations, question banks, academic classes, subjects, student assessments, automatic/manual grading, and verified result publication.

## Key Capabilities

- **Role-Based Access Control (RBAC)**: Distinct experiences and strict server-side authorization for **Administrators**, **Teachers**, and **Students**.
- **Examination & Question Bank Management**: Full CRUD for MCQ (4+ options), True/False, Short Answer, and Essay questions; manual question selection or randomized question-bank sampling; scheduled start/end windows; safe archiving to preserve submitted academic records.
- **Timed Online Examination Engine**: Server-authoritative countdown timer, periodic and on-change answer autosave, question flag/navigator grid, duplicate submission prevention, and automatic submission upon timer expiry.
- **Hybrid Grading & Configurable Scale**: Automatic grading for MCQ and True/False items, manual rubric grading and feedback for Short Answer and Essay items, configurable grading scale thresholds, and controlled result publication.
- **Reporting & Exports**: Recharts analytics dashboards plus CSV and PDF report generation (`jsPDF` + `jspdf-autotable`).
- **Security**: `bcryptjs` password hashing, JWT authentication with `HttpOnly; SameSite` cookies and in-memory Bearer tokens, Helmet headers, Express rate limiting, and NoSQL operator injection guards.

## Architecture

- `backend/` — Express REST API, Mongoose models (`User`, `Class`, `Subject`, `Question`, `Exam`, `ExamAttempt`, `Result`, `Settings`), JWT/RBAC middleware, grading service, and workspace seed service.
- `src/` — React 19 + Vite + Tailwind CSS v4 frontend, Axios client, Recharts dashboards, and role-scoped pages.
- `server.ts` — Unified full-stack Node.js server mounting `/api/*` and Vite middleware in development (or `dist/` in production).

## Local Installation & Running

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure environment variables as needed. (If `MONGODB_URI` is left blank in local development, EXAMPRO automatically boots an embedded MongoDB instance via `mongodb-memory-server`.)
3. Start development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build for production and start:
   ```bash
   npm run build
   npm start
   ```

## First-Run Initialization

On a fresh database with no administrator account, `/login` presents the **Initialize Administrator Account** screen. Set your administrator name, email, and workspace password, and optionally check the sample academic dataset box to seed sample classes, subjects, questions, exams, and demo teacher (`teacher@exampro.edu`) and student (`student@exampro.edu`) accounts sharing your chosen password.

## Deployment Guide

### Database (MongoDB Atlas)
1. Create a cluster in MongoDB Atlas and copy your connection string into `MONGODB_URI`.
2. Allow network access from your backend host.

### Backend (Render / Railway / Cloud Run)
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (a strong 32+ byte random string), and `CORS_ORIGIN` (your frontend origin, e.g. `https://exampro.vercel.app`).

### Frontend (Vercel, if deployed separately)
- Set `VITE_API_URL=https://your-backend-domain.com/api`
- Build Command: `npm run build`
- Output Directory: `dist`
