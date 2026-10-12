# Leave & Expense Approval Tracker

A full-stack **MERN (MongoDB, Express.js, React.js, Node.js)** web application implementing a **2-stage sequential approval workflow** with concurrency-safe atomic state transitions, role-based access control (RBAC), and an immutable audit trail.

Built as part of the **StartupMeu Software Engineer Intern (MERN Stack)** technical assessment.

---

## Key Features

- **Multi-Role Authentication & RBAC**:
  - Supports four distinct organizational roles: `employee`, `manager`, `hr`, and `admin`.
  - Password hashing with `bcryptjs` and stateless authentication via signed JWT `Bearer` tokens.
  - Brute-force protection on `/auth/login` using `express-rate-limit`.
- **Sequential 2-Step Approval Pipeline**:
  - Every request progresses strictly in order: **Step 1 (Manager)** $\rightarrow$ **Step 2 (HR)**.
  - Step 1 approval advances `currentStep` from `1` to `2` while keeping `status: 'pending'`.
  - Step 2 approval transitions `status` to `'approved'`.
  - Rejection at either step immediately locks the request with `status: 'rejected'`.
- **Concurrency-Safe Atomic Locking**:
  - Uses MongoDB atomic `findOneAndUpdate` with `{ _id, status: 'pending', currentStep }` in the filter criteria so two simultaneous approval requests cannot both succeed (preventing double-approval race conditions).
- **Strict Business Rule Guards**:
  - Approvers cannot approve or reject their own requests (`403 Forbidden`).
  - Out-of-order approvals (e.g., HR attempting to approve Step 1) are blocked (`403 Forbidden`).
  - Finalized requests (`approved`, `rejected`, `cancelled`) are permanently locked against further mutation (`409 Conflict`).
  - Request owners can cancel their own requests only while still `pending`.
- **Immutable Audit Trail**:
  - Every state transition (`CREATED`, `APPROVED_STEP_1`, `APPROVED_STEP_2`, `REJECTED`, `CANCELLED`) is recorded in the `AuditLog` collection with actor metadata, `fromStatus`, `toStatus`, decision comments, and timestamps.
- **Layered Backend Architecture & Validation**:
  - Clean separation of concerns: `routes` $\rightarrow$ `controllers` $\rightarrow$ `services` $\rightarrow$ `models` $\rightarrow$ `middleware`.
  - Request payload validation with **Zod** (`.superRefine()` enforcing positive amounts for expenses and valid `startDate <= endDate` ranges for leaves).
  - Centralized error-handling middleware returning a consistent JSON error contract across all endpoints.
- **Interactive React + Vite Frontend**:
  - Visual 2-stage pipeline stepper on every request card (`[Step 1: Manager] ➔ [Step 2: HR]`).
  - **1-Click Demo Role Switcher** in both the login screen and navigation bar to test Employee, Manager, HR, and Admin perspectives instantaneously.
  - Role-scoped tabs (`Pending For Me`, `My Requests`, `All Requests`), status/type filtering, pagination, and a modal Audit Trail timeline viewer.

---

## Technologies Used

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Database** | MongoDB & Mongoose 8 | Schema modeling, compound indexing, atomic `findOneAndUpdate` locking |
| **Backend** | Node.js & Express.js 4 (ES Modules) | REST API, layered service architecture, middleware pipeline |
| **Authentication** | `jsonwebtoken` & `bcryptjs` | JWT signing/verification and salted password hashing |
| **Validation & Security** | `zod` & `express-rate-limit` | Schema validation and login rate limiting |
| **Frontend** | React 18 & Vite 5 | Component-based SPA, Context API state management, responsive CSS |
| **Testing** | Jest & Supertest | 29 integration tests covering RBAC, validation, and concurrency races |
| **Containerization** | Docker & Docker Compose | Reproducible local MongoDB instance |

---

## Project Structure

```text
approval-tracker-mern/
├── docker-compose.yml                  # Local MongoDB container definition
├── server/                             # Express + Mongoose Backend API
│   ├── src/
│   │   ├── config/db.js                # MongoDB connection lifecycle
│   │   ├── controllers/                # HTTP request/response handlers
│   │   ├── errors/AppError.js          # Custom operational error class
│   │   ├── middleware/                 # Auth, RBAC, Zod validator, rate limiter, central errorHandler
│   │   ├── models/                     # User, Request, and AuditLog Mongoose schemas + indexes
│   │   ├── routes/                     # /auth and /requests Express routers
│   │   ├── scripts/seed.js             # Seeds 4 demo users + 4 sample workflow requests
│   │   ├── services/                   # Core business logic & atomic approval engine
│   │   ├── validators/                 # Zod schemas for auth and requests
│   │   ├── app.js                      # Express app setup (exported for Supertest)
│   │   └── server.js                   # HTTP listener entrypoint (PORT 6969)
│   ├── tests/                          # Jest + Supertest integration suites
│   │   ├── setup.js
│   │   ├── auth.test.js                # 14 tests for auth, validation, RBAC, rate limiting
│   │   └── requests.test.js            # 15 tests for sequential workflow & double-approve race
│   ├── .env.example
│   └── package.json
└── client/                             # React + Vite Frontend SPA
    ├── src/
    │   ├── api/api.js                  # Fetch wrapper with automatic Bearer token injection
    │   ├── components/                 # AuthView, Navbar, Dashboard, RequestCard, Modals
    │   ├── context/AuthContext.jsx     # Session persistence & role switching
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    ├── .env.example
    ├── vite.config.js                  # Proxy configuration to localhost:6969
    └── package.json
```

---

## Setup and Installation Instructions

### Prerequisites
- **Node.js** v18+ and **npm**
- **MongoDB** running locally on port `27017` (or **Docker** to spin it up with one command)

### 1. Clone the Repository
```bash
git clone https://github.com/NamTheGreat/approval-tracker-mern.git
cd approval-tracker-mern
```

### 2. Start MongoDB
If using Docker:
```bash
docker compose up -d
```
*(Alternatively, ensure your local `mongod` service is running on `mongodb://localhost:27017`.)*

### 3. Configure & Install Backend (`/server`)
```bash
cd server
cp .env.example .env
npm install
```

The default `server/.env.example` uses:
```ini
PORT=6969
MONGO_URI=mongodb://localhost:27017/approval-tracker
MONGO_URI_TEST=mongodb://localhost:27017/approval-tracker-test
JWT_SECRET=supersecretkey_for_dev_assessment_min_32_chars
JWT_EXPIRES_IN=1d
```

### 4. Seed Demo Users & Sample Requests
```bash
npm run seed
```
This creates 4 demo accounts (one per role) and 4 realistic requests across all workflow states (`Step 1 pending`, `Step 2 pending`, `approved`, `rejected`):

| Role | Email | Password |
| :--- | :--- | :--- |
| **Employee** | `employee@startupmeu.local` | `Password123!` |
| **Manager (Step 1)** | `manager@startupmeu.local` | `Password123!` |
| **HR (Step 2)** | `hr@startupmeu.local` | `Password123!` |
| **Admin** | `admin@startupmeu.local` | `Password123!` |

### 5. Configure & Install Frontend (`/client`)
```bash
cd ../client
cp .env.example .env
npm install
```

---

## Instructions for Running the Application

### 1. Start the Backend Server (Port `6969`)
From `/server`:
```bash
npm run dev
```
The API will be live at `http://localhost:6969` (Health check: `GET http://localhost:6969/health`).

### 2. Start the React Frontend (Port `5173`)
In a new terminal, from `/client`:
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser. Use the **Quick Demo Login** buttons on the sign-in card or the **Switch Role** bar in the top navigation header to test the full sequential approval flow across roles.

### 3. Run the Automated Test Suite (Jest & Supertest)
From `/server`:
```bash
npm test
```
Runs all **29 integration tests** across `tests/auth.test.js` and `tests/requests.test.js`, including the `Promise.all` concurrent double-approval race condition test.

---

## API Endpoints Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register a new user account and receive JWT |
| `POST` | `/auth/login` | Public (Rate-limited) | Authenticate credentials and receive JWT |
| `GET` | `/auth/me` | Authenticated | Get current authenticated user profile |
| `POST` | `/requests` | Authenticated | Submit a new `leave` or `expense` request |
| `GET` | `/requests` | Authenticated | List requests with `scope`, `status`, `type`, `page`, `limit` |
| `GET` | `/requests/:id` | Owner / Approver / Admin | Get full details of a single request |
| `POST` | `/requests/:id/approve` | Manager (Step 1) / HR (Step 2) / Admin | Atomically approve current step |
| `POST` | `/requests/:id/reject` | Manager (Step 1) / HR (Step 2) / Admin | Atomically reject and lock request |
| `POST` | `/requests/:id/cancel` | Request Owner / Admin | Cancel request while still `pending` |
| `GET` | `/requests/:id/audit` | Owner / Approver / Admin | Retrieve chronological audit trail for a request |

---

## Code0 Workflow & AI-Assisted Development Experience

### Confirmation of Code0 Usage
I confirm that **Code0 (`frigga.code0`)** was used as the primary development environment and AI engineering workflow tool throughout the creation of this project, including architectural planning, component and API implementation, debugging, testing, and terminal Git/GitHub operations.

### How Code0 Was Integrated Into My Engineering Workflow
Rather than generating monolithic boilerplate blindly, I used an **iterative, test-verified workflow** inside Code0:
1. **Architecture & Edge-Case Planning First**: Before writing application code, I aligned on the data models, explicit role hierarchy (`employee`, `manager`, `hr`, `admin`), and concurrency invariants so every layer had a single responsibility.
2. **Task-by-Task Execution & Review**: Each layer (Database $\rightarrow$ Error Handling $\rightarrow$ Models $\rightarrow$ Validation $\rightarrow$ Auth $\rightarrow$ Approval Engine $\rightarrow$ React UI) was built in small, isolated increments and committed on dedicated Git Flow feature branches (`feat/backend-core-and-auth`, `feat/approval-engine`, `feat/client-ui`).
3. **Validation of AI Suggestions**: Every generated module was verified against actual runtime behavior and automated Supertest assertions—catching subtle Express route ordering and error-message formatting nuances early.

### 5 Specific Tasks Where Code0 Helped

1. **Designing the Concurrency-Safe Atomic Approval Engine (`server/src/services/requestService.js`)**:
   - *Challenge*: Preventing a race condition where two managers click "Approve" at the exact same millisecond on a Step 1 request.
   - *How Code0 Helped*: Assisted in structuring the atomic `Request.findOneAndUpdate({ _id: requestId, status: 'pending', currentStep: 1 }, { $set: { currentStep: 2 }, $push: { steps: ... } })` query so MongoDB enforces document-level locking. If a concurrent request arrives, the filter fails to match, returning `null` and triggering a `409 Conflict` response.

2. **Conditional Request Validation with Zod (`server/src/validators/requestValidator.js`)**:
   - *Challenge*: A single `/requests` endpoint needed to validate two polymorphic request types (`leave` requiring `startDate <= endDate`, and `expense` requiring `amount > 0`).
   - *How Code0 Helped*: Helped craft a clean `.superRefine()` Zod pipeline that attaches field-specific validation issues and forwards them to the central `errorHandler.js` middleware for structured `400 Bad Request` responses.

3. **Debugging Express Catch-All Route Ordering in Supertest (`server/tests/auth.test.js` & `server/src/routes/authRoutes.js`)**:
   - *Challenge*: During initial RBAC middleware testing, a dynamically mounted test route returned `404` instead of `403`/`200` because Express had already registered the `app.all('*', ...)` 404 catch-all handler in `app.js`.
   - *How Code0 Helped*: Diagnosed the middleware registration order from the Supertest failure output and refactored the role check into `authRoutes.js` (`/auth/manager-check`) prior to the 404 handler.

4. **Building the Visual 2-Stage Pipeline Stepper & Role Switcher (`client/src/components/RequestCard.jsx` & `Navbar.jsx`)**:
   - *Challenge*: Making the sequential approval state immediately clear to both employees and approvers without cluttering the UI.
   - *How Code0 Helped*: Accelerated the development of the `RequestCard` stepper component (visually distinguishing completed, active, queued, and rejected steps) and the 1-click Demo Role Switcher that re-authenticates and re-scopes the dashboard automatically.

5. **Writing the Automated Concurrency & Approval Rule Test Suite (`server/tests/requests.test.js`)**:
   - *Challenge*: Proving deterministically that self-approval, out-of-order approval, locked-state mutation, and simultaneous double-approval are all prevented.
   - *How Code0 Helped*: Helped scaffold the 29-test Jest + Supertest suite using `Promise.all` to fire parallel approval requests from two separate manager tokens and asserting that the sorted HTTP status codes strictly equal `[200, 409]`.
