# VeriLedger 🏦

VeriLedger is an enterprise-grade, full-stack Balance Sheet Management and Financial Control Portal built to enforce strict corporate compliance, multi-stage linear approval workflows, and immutable data auditing. 

The system transitions traditional, messy financial workflows into a secure, role-based pipeline with high visibility, data validation, and built-in anomaly detection.

---

## 🚀 Core Architecture & Features

### 1. Multi-Stage Linear Workflow & RBAC
VeriLedger implements a strict **Role-Based Access Control (RBAC)** model split across 4 distinct financial corporate entities:
* **Maker:** Initiates General Ledger (GL) entries, attaches supporting financial balance sheets, and routes them securely to a specific Checker via a unique system-generated ID.
* **Checker:** Verifies entries. Can either approve (forward to Financial Controller) or reject (bounce back to Maker with structured correction notes).
* **Financial Controller (FC):** Performs secondary organizational compliance checks. Can approve or reject back to the initial Maker.
* **Chief Financial Officer (CFO):** The final sign-off authority. Upon CFO approval, the record state transforms into `FINALIZED_LOCKED`, applying database-level immutability.

### 2. Enterprise Office Utilities
* **Unique Employee ID Sequencer:** Automatically registers and tracks internal users utilizing a standardized format (`EMP-2026-XXXX`).
* **Strict Four-Eyes Principle:** Employs built-in compliance boundaries preventing a user from checking or approving their own data submissions.
* **Automated Flux Analysis:** Scans ledger entry updates against past cycles. Variances greater than 15% automatically trigger a `HIGH_VARIANCE` system flag, mandating explicit justification before routing.
* **Live Work Deadlines:** Integrated countdown metrics visible on user queues ensuring operational financial closing dates are met.
* **Workspace Discussion Sidebar:** Dedicated contextual comments panel on data grids, bypassing messy email chains for internal reconciliation.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS, Vite (Port `5173`)
* **Backend:** Python, FastAPI, Pydantic, SQLAlchemy (Port `8000`)
* **Database:** PostgreSQL (Relational integrity and JSONB audit trails)
* **Containerization:** Docker, Docker Compose

---

## 📁 Project Structure

```text
VeriLedger/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── models/           # SQLAlchemy DB Models (Users, Sheets, Comments)
│   │   ├── schemas/          # Pydantic schemas for request/response validation
│   │   ├── routes/           # Auth, Workflow Engine, and Dashboard API endpoints
│   │   └── main.py           # FastAPI initialization
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile
├── frontend/                 # React UI Application
│   ├── src/
│   │   ├── components/       # Visual Timeline Steppers, Forms, Calendars
│   │   ├── pages/            # Role-specific Dashboards, Login
│   │   └── App.jsx
│   ├── package.json          # Node dependencies
│   └── Dockerfile
└── docker-compose.yml        # Orchestration for Web, API, and DB layers
