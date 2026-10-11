# 🧳 WhereIsMyBag

> **Real-Time Simulated Airline Baggage Tracking System**  
> *A hackathon-grade prototype enabling passengers to verify credentials, track checked baggage live over Server-Sent Events (SSE), scan tag barcodes, and log delayed baggage reports.*

---

## 📸 Overview & Visual Design

**WhereIsMyBag** is a full-stack web application designed for modern airport baggage visibility. It models the end-to-end baggage handling pipeline from airport check-in, security screening, sorting facility, container loading, aircraft loading, transfer layovers, carousel arrival, to baggage claim.

The user interface features a **cinematic dark airport aesthetic** inspired by modern airport baggage claim carousels, cool spotlight beams, reflective metallic tracks, and electric cyan accents.

---

## ✨ Key Features

- **📸 Mobile Camera Barcode Scanner**: Scan physical 10-digit baggage tag barcodes directly using your device camera (`@zxing/browser`) or enter the tag manually.
- **🔐 Secure Passenger Verification**: Validates 10-digit baggage tag, passenger surname, and 6-character PNR against airline booking records. Issues cryptographically signed, short-lived, tag-scoped HMAC-SHA256 access tokens.
- **📡 Real-Time SSE Stream**: Streams live baggage progress events over HTTP Server-Sent Events (`text/event-stream`), supporting automatic reconnection and `Last-Event-ID` message replay.
- **🏷️ IATA BSM Message Processing**: Generates and parses standard IATA Baggage Source Messages (`BSM`, `BSI`, `BSN`, `BSR`, `BSD`) for check-in and transit gates.
- **📝 Delayed Baggage Reporting**: Allows passengers to log missing/delayed baggage reports and receive a unique tracking reference code (e.g. `WIMB-DEL-20261011-9435`).
- **⚡ 1-Click Interactive Demo Scenarios**: Pre-configured test scenarios for instant demonstration (Happy Path, Tight Layover, Missed Connection).
- **🔄 Demo Reset API**: Administrative endpoint (`POST /api/demo/reset`) for resetting simulation timers and replaying scenarios during presentations.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19, Vite 8, JavaScript (ESNext) |
| **Styling** | Custom Vanilla CSS (Design Tokens, Glassmorphism, Responsive CSS Grid/Flexbox) |
| **Barcode Scanning** | `@zxing/browser` |
| **Backend Runtime** | Node.js (CommonJS), Express 5 |
| **Real-Time Protocol** | Server-Sent Events (SSE) |
| **Security & Auth** | Node.js `crypto` (HMAC-SHA256 Tokens), CORS Middleware, Express Rate Limiter |
| **Testing Engine** | Node.js Native Test Runner (`node --test`) — 182 Automated Tests |

---

## 📂 Repository Structure

```text
WhereIsMyBag/
├── CONTRACT.md               # Shared API specification & single source of truth
├── README.md                 # Project documentation & setup guide
├── server/                   # Node.js Express Backend API
│   ├── .env.example          # Environment variables template
│   ├── package.json          # Backend dependencies & scripts
│   ├── src/
│   │   ├── adapters/         # SimulatorBaggageAdapter & BaggageAdapter interface
│   │   ├── controllers/      # Baggage, Demo & Verification controllers
│   │   ├── data/             # Fictional baggage booking fixtures & scenarios
│   │   ├── middleware/       # Auth enforcement, Rate limiter, Error handler
│   │   ├── routes/           # Express API route declarations (/api/*)
│   │   ├── services/         # Simulation Engine, AuthService, BSM Generator
│   │   ├── utils/            # Tag parser, Barcode generator, Response helper
│   │   ├── app.js            # Express app configuration
│   │   └── index.js          # Server entrypoint (Port 3001)
│   └── tests/                # 14 test suites (182 test cases)
└── web/                      # React Vite Frontend Web App
    ├── .env.example          # Frontend environment variables template
    ├── package.json          # Frontend dependencies
    ├── vite.config.js        # Vite bundler configuration
    ├── public/               # Favicon & static icons
    └── src/
        ├── assets/           # High-res cinematic carousel graphics
        ├── components/       # Barcode generator & scanner components
        ├── lib/              # API fetch client & HTTP wrapper (`api.js`)
        ├── App.jsx           # Main application view & hero layout
        ├── BaggageTimeline.jsx # Real-time SSE timeline component
        ├── BarcodeScanner.jsx # Camera barcode scanner component
        ├── MissingBagReport.jsx # Delayed report submission form
        └── index.css         # Dark theme airport design system
```

---

## 🚀 Quick Start & Installation Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Faidaaa/WhereIsMyBag.git
cd WhereIsMyBag
```

---

### Step 2: Set Up the Backend Server
```bash
cd server
npm install
```

Create a `.env` file inside `server/` (or copy `.env.example`):
```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
DEMO_RESET_SECRET=wimb-demo-reset-2026
```

Start the backend development server:
```bash
npm run dev
```
> The API server will start on **`http://localhost:3001/api`**.

---

### Step 3: Set Up the Frontend Web App
Open a **second terminal window** and run:
```bash
cd web
npm install
```

Create a `.env` file inside `web/` (or copy `.env.example`):
```env
VITE_API_BASE_URL=http://localhost:3001
```

Start the frontend development server:
```bash
npm run dev
```
> The React web app will start on **`http://localhost:5173`**.

---

## 🎫 Fictional Demo Credentials

Use any of these pre-loaded fictional passenger bookings to test the system:

| Scenario Title | 10-Digit Bag Tag | Passenger Surname | PNR Code | Expected Journey Behaviour |
|---|---|---|---|---|
| **Happy Path** | `0055123456` | `OKAFOR` | `NBFX01` | Smooth journey from LHR ➔ JFK (Status: `DELIVERED`) |
| **Tight Layover** | `0055123457` | `LINDQVIST` | `NBFX02` | Tight transfer at hub, bag loaded on connecting flight |
| **Missed Connection** | `0055123458` | `FERREIRA` | `NBFX03` | Layover delay triggers `MISSED_CONNECTION` milestone |
| **Default Demo** | `0123456789` | `SMITH` | `WIMB01` | Standard demo scenario tag from `CONTRACT.md` |

---

## 🔌 API Endpoints Reference

All API routes are mounted under the `/api` prefix on `http://localhost:3001`.

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service health status check | No |
| `POST` | `/api/verify` | Passenger verification & token issuance | Rate Limited |
| `GET` | `/api/bags/:tag/timeline` | REST historical baggage timeline snapshot | Bearer Token |
| `GET` | `/api/bag/:tag/stream` | Real-time Server-Sent Events (SSE) stream | Token (Header / Query) |
| `POST` | `/api/report` | Delayed baggage report submission | Bearer Token |
| `GET` | `/api/scenarios` | List available demo scenarios | No |
| `GET` | `/api/bsm/:tag` | Printable/viewable IATA BSM message data | No |
| `GET` | `/api/barcodes/:tag.png` | PNG Interleaved 2-of-5 barcode generator | No |
| `POST` | `/api/demo/reset` | Resets active simulation timers & demo state | Secret Header (`X-Demo-Reset-Secret`) |

---

## 🧪 Running Automated Tests

The backend includes 14 comprehensive unit and integration test suites covering tag parsing, verification security, BSM generation, SSE stream handling, report submission, and state machine transitions.

To run the backend test suite:
```bash
cd server
npm test
```

**Test Output:**
```text
ℹ tests 182
ℹ suites 13
ℹ pass 182
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 1607ms
```

To run the frontend production build test:
```bash
cd web
npm run build
```

---

## 🛡️ Security & Privacy Features

- **Tag-Scoped Tokens**: Access tokens are cryptographically locked to a single baggage tag number (`tagNumber`). Using a token issued for Tag A to access Tag B returns `403 TOKEN_BAG_MISMATCH`.
- **Generic Auth Errors**: Rejections for invalid surnames or PNRs return a generic `401 VERIFICATION_FAILED` message to prevent credential enumeration attacks.
- **Sensitive Data Logging Protection**: Surnames, PNRs, raw passwords, and authorization tokens are strictly sanitized and never written to server logs.
- **Environment Isolation**: `.env` files and credentials are excluded from version control via `.gitignore`.

---

## 📜 Disclaimer & License

> **Notice**: **WhereIsMyBag** is a simulated hackathon demonstration platform. All passenger names, booking references, baggage tag numbers, flights, and airports used in demo scenarios are **entirely fictional**. This application does not connect to real-time commercial airline networks or WorldTracer systems.

Distributed under the **ISC License**. Created for Hackathon Demonstration.
