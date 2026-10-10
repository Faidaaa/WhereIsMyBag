# WhereIsMyBag API & Data Contract (CONTRACT.md)

**Version:** 1.0.0  
**Project:** WhereIsMyBag — 12-Hour Hackathon Baggage Tracking Prototype  
**Audience:** Frontend Engineers (React), Backend Engineers (Node.js/Express), and Evaluators  

---

## 1. Executive Summary & Purpose

WhereIsMyBag is a simulated airline baggage tracking application. Passengers can track their checked luggage in real time using a 10-digit baggage tag number, their surname, and a 6-character PNR (Passenger Name Record). 

This document is the **single source of truth** for:
- API endpoint paths, methods, payloads, and response codes.
- Baggage event data formats and allowed enum values.
- Event visibility rules (passenger-facing vs. internal baggage handling operations).
- Token verification lifecycle and Server-Sent Events (SSE) streaming mechanics.
- Pre-configured demo scenarios and risk calculation formulas.

> **Resolution Note on `plan.md`:**  
> The physical repository did not contain a pre-existing `plan.md`. This contract formalizes all product requirements into an explicit, deterministic specification to ensure seamless communication between the frontend and backend.

---

## 2. Global API Conventions

- **Base URL:** `/api` (Backend runs on `http://localhost:3001` in development).
- **Format:** All requests and responses use `application/json` with UTF-8 encoding (except SSE endpoints, which use `text/event-stream`).
- **Timestamps:** ISO 8601 UTC strings (e.g., `2026-10-10T20:30:00.000Z`).
- **Standard Error Response Shape:**
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human-readable explanation of what went wrong.",
      "details": null
    }
  }
  ```

---

## 3. Endpoints Specification

### 3.1. Verification Endpoint
Validates that the passenger has rightful access to track the bag.

* **Path:** `POST /api/verify`
* **Purpose:** Authenticate passenger using bag tag, surname, and booking PNR.
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "tagNumber": "0123456789",
    "surname": "SMITH",
    "pnr": "WIMB01"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "verificationToken": "vtok_0123456789_f48a1290e",
      "expiresAt": "2026-10-10T22:30:00.000Z",
      "bag": {
        "tagNumber": "0123456789",
        "pnr": "WIMB01",
        "passengerSurname": "SMITH",
        "passengerFullName": "John Smith",
        "origin": "LHR",
        "destination": "JFK",
        "currentFlight": "BA178",
        "scenario": "SUCCESSFUL_JOURNEY"
      }
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request` (`INVALID_INPUT`): Missing field, `tagNumber` not 10 digits, or `pnr` not 6 alphanumeric characters.
  * `401 Unauthorized` (`VERIFICATION_FAILED`): Surname or PNR does not match records for this bag tag.
  * `404 Not Found` (`TAG_NOT_FOUND`): Bag tag number does not exist in the airline system.

---

### 3.2. Baggage Timeline Snapshot (REST Fallback)
Retrieves the complete historical timeline and current risk status.

* **Path:** `GET /api/bags/:tagNumber/timeline`
* **Request Headers:**
  * `Authorization: Bearer <verificationToken>`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "tagNumber": "0123456789",
      "currentStep": "LOADED_ON_AIRCRAFT",
      "riskAssessment": {
        "riskLevel": "LOW",
        "score": 0.1,
        "factors": [],
        "recommendation": "On schedule.",
        "eligibleForDelayedReport": false
      },
      "events": [
        {
          "id": "evt_001",
          "tagNumber": "0123456789",
          "step": "CHECKED_IN",
          "category": "CHECK_IN",
          "status": "COMPLETED",
          "flightNumber": "BA178",
          "airportCode": "LHR",
          "location": "Terminal 5 Bag Drop 12",
          "timestamp": "2026-10-10T17:15:00.000Z",
          "description": "Bag checked in at London Heathrow (LHR)."
        }
      ]
    }
  }
  ```
* **Error Responses:**
  * `401 Unauthorized` (`MISSING_OR_EXPIRED_TOKEN`): Token invalid, expired, or missing.
  * `403 Forbidden` (`TOKEN_BAG_MISMATCH`): Token was issued for a different tag number.
  * `404 Not Found` (`TAG_NOT_FOUND`): Tag number not recognized.

---

### 3.3. Real-Time Baggage Stream (Server-Sent Events)
Streams real-time journey progression and risk alerts.

* **Path:** `GET /api/bags/:tagNumber/stream?token=<verificationToken>`
* **Headers:** `Accept: text/event-stream`
* **Query Parameters:**
  * `token` *(required)*: The verification token received from `/api/verify`. Standard browser `EventSource` cannot send custom authorization headers, so query parameter authentication is required.
* **Server Response Headers:**
  * `Content-Type: text/event-stream`
  * `Cache-Control: no-cache, no-transform`
  * `Connection: keep-alive`
* **SSE Message Types Emitted:**
  
  1. `event: connected`  
     Sent immediately upon handshake.
     ```text
     event: connected
     data: {"message":"Connected to WhereIsMyBag real-time simulation stream","tagNumber":"0123456789"}
     ```

  2. `event: baggage-event`  
     Emitted when a new milestone occurs.
     ```text
     id: evt_003
     event: baggage-event
     data: {"id":"evt_003","tagNumber":"0123456789","step":"LOADED_ON_AIRCRAFT","category":"RAMP","status":"COMPLETED","flightNumber":"BA178","airportCode":"LHR","location":"Aircraft Hold 2","timestamp":"2026-10-10T18:40:00.000Z","description":"Baggage loaded onto aircraft BA178."}
     ```

  3. `event: risk-alert`  
     Emitted when the risk engine updates the risk rating.
     ```text
     event: risk-alert
     data: {"riskLevel":"HIGH","score":0.78,"factors":[{"code":"TIGHT_CONNECTION","message":"Layover window reduced to 35 min (MCT is 60 min)."}],"recommendation":"Bag transfer expedited by ramp team.","eligibleForDelayedReport":false}
     ```

  4. `event: ping` (Heartbeat comment)  
     Sent every 15 seconds to prevent network proxies from timing out:
     ```text
     : ping
     ```

  5. `event: stream-complete`  
     Emitted when the simulation finishes its final stage.
     ```text
     event: stream-complete
     data: {"status":"FINISHED","tagNumber":"0123456789"}
     ```

* **Error Handling on SSE:**
  If the token is invalid on initial connect, the server immediately returns standard JSON with HTTP status `401 Unauthorized` without upgrading to an SSE connection.

---

### 3.4. Delayed Baggage Report Submission
Submits a missing/delayed baggage report pre-filled by the client.

* **Path:** `POST /api/reports/delayed`
* **Request Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer <verificationToken>`
* **Request Body:**
  ```json
  {
    "tagNumber": "0555666777",
    "pnr": "WIMB04",
    "passengerSurname": "MUELLER",
    "deliveryAddress": "456 Sunset Blvd, Los Angeles, CA 90028",
    "contactPhone": "+1 (555) 019-2834",
    "contactEmail": "mueller@example.com",
    "bagDescription": "Navy blue soft-sided Samsonite upright suitcase with red identifier strap",
    "notes": "Connecting flight LH900 arrived late at LHR."
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "referenceNumber": "WIMB-DEL-20261010-7492",
      "tagNumber": "0555666777",
      "pnr": "WIMB04",
      "status": "SUBMITTED",
      "submittedAt": "2026-10-10T20:30:00.000Z",
      "estimatedResolutionHours": 24,
      "message": "Your report has been logged. Airline baggage services will arrange delivery to your specified address once your bag arrives."
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request` (`VALIDATION_ERROR`): Missing required fields (deliveryAddress, contactPhone, etc.).
  * `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.

---

### 3.5. Demo Scenarios Meta-Endpoint (Developer & Judge Friendly)
* **Path:** `GET /api/scenarios`
* **Purpose:** Returns list of demo scenarios for quick 1-click loading in the UI.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "successful_journey",
        "title": "Scenario 1: Successful Journey",
        "tagNumber": "0123456789",
        "surname": "SMITH",
        "pnr": "WIMB01",
        "description": "Standard smooth baggage handling from LHR to JFK."
      },
      {
        "id": "incorrect_verification",
        "title": "Scenario 2: Incorrect Verification",
        "tagNumber": "0987654321",
        "surname": "GARCIA",
        "pnr": "WIMB02",
        "description": "Demonstrates security rejection when incorrect credentials are provided."
      },
      {
        "id": "connection_risk",
        "title": "Scenario 3: Connection Risk Alert",
        "tagNumber": "0111222333",
        "surname": "PATEL",
        "pnr": "WIMB03",
        "description": "Tight 35-minute layover trigger showing active risk warning badge."
      },
      {
        "id": "missed_connection",
        "title": "Scenario 4: Missed Connection & Delay Report",
        "tagNumber": "0555666777",
        "surname": "MUELLER",
        "pnr": "WIMB04",
        "description": "Bag misses connection; unlocks instant pre-filled delayed claim filing."
      }
    ]
  }
  ```

---

## 4. Baggage Event Data Structure & Allowed Enum Values

Every baggage event contains the following JSON structure:

```json
{
  "id": "evt_001",
  "tagNumber": "0123456789",
  "step": "CHECKED_IN",
  "category": "CHECK_IN",
  "status": "COMPLETED",
  "flightNumber": "BA178",
  "airportCode": "LHR",
  "location": "Terminal 5 Bag Drop 12",
  "timestamp": "2026-10-10T17:15:00.000Z",
  "estimatedTimestamp": null,
  "description": "Bag checked in at London Heathrow.",
  "visibility": "PASSENGER",
  "internalNotes": null
}
```

### Allowed Enum Values

| Enum Field | Allowed Values |
| :--- | :--- |
| **`step`** | `CHECKED_IN`<br>`SECURITY_SCREENED`<br>`SORTED_TO_CONTAINER`<br>`LOADED_ON_AIRCRAFT`<br>`DEPARTED`<br>`ARRIVED_TRANSFER_HUB`<br>`TRANSFER_UNLOADED`<br>`TRANSFER_SORTED`<br>`TRANSFER_TIGHT_CONNECTION`<br>`LOADED_CONNECTING_FLIGHT`<br>`MISSED_CONNECTION`<br>`ARRIVED_DESTINATION`<br>`UNLOADED_FROM_AIRCRAFT`<br>`DELIVERED_TO_CAROUSEL`<br>`CLAIMED` |
| **`category`** | `CHECK_IN`<br>`SECURITY`<br>`SORTING`<br>`RAMP`<br>`FLIGHT`<br>`TRANSFER`<br>`ARRIVAL`<br>`EXCEPTION` |
| **`status`** | `COMPLETED`<br>`IN_PROGRESS`<br>`WARNING`<br>`FAILED`<br>`PENDING` |
| **`visibility`** | `PASSENGER`<br>`INTERNAL_ONLY` |

---

## 5. Visibility Rules: Passenger-Facing vs. Internal-Only

1. **Filtering Rule:** The backend API MUST filter out any event where `visibility === "INTERNAL_ONLY"` prior to sending it to client REST or SSE listeners.
2. **Internal Telemetry Stripping:** If an event has `visibility === "PASSENGER"`, internal-only diagnostic fields (such as `internalNotes`, baggage handling system chute numbers, conveyor speeds, or raw IATA BSM/BPM teletype strings) MUST be omitted or set to `null`.
3. **Operational Clarity:** High-frequency intermediate sensor scans (e.g., optical reader #47 on sorting conveyor) are classified as `INTERNAL_ONLY` to avoid overwhelming passengers. Only consumer milestones (e.g., `CHECKED_IN`, `SECURITY_SCREENED`, `LOADED_ON_AIRCRAFT`, `DELIVERED_TO_CAROUSEL`) are `PASSENGER` visible.
4. **Exception Masking:** When an operational exception occurs (e.g. `TRANSFER_TIGHT_CONNECTION`), the passenger receives calm, reassuring messaging (e.g., *"Transfer in progress — expedited handling applied"*) while internal logs record technical details.

---

## 6. Verification Token Lifecycle

1. **Generation:** When `POST /api/verify` succeeds, the backend generates a token formatted as `vtok_<tagNumber>_<randomHexString>`.
2. **Association:** The token is bound strictly to the specified `tagNumber`, `pnr`, and `surname`.
3. **Expiration:** Tokens are valid for **2 hours** (120 minutes) from issuance.
4. **Security Enforcement:**
   - Any request to `/api/bags/:tagNumber/timeline` or `/api/bags/:tagNumber/stream` with a token issued for a *different* tag number returns `403 Forbidden` (`TOKEN_BAG_MISMATCH`).
   - Expired or malformed tokens return `401 Unauthorized` (`MISSING_OR_EXPIRED_TOKEN`).

---

## 7. Server-Sent Events (SSE) Lifecycle & Reliability

1. **Handshake & Auth:**
   The frontend initiates: `new EventSource('/api/bags/' + tagNumber + '/stream?token=' + token)`.
2. **Immediate Flush:**
   The backend sets HTTP headers and flushes them immediately:
   ```javascript
   res.writeHead(200, {
     'Content-Type': 'text/event-stream',
     'Cache-Control': 'no-cache, no-transform',
     'Connection': 'keep-alive'
   });
   ```
3. **Keep-Alive Heartbeat:**
   Every 15 seconds, the backend emits `: ping\n\n`. This prevents client/proxy idle disconnects.
4. **Reconnection Support (`Last-Event-ID`):**
   Every SSE message includes `id: <eventId>`. If the network disconnects, browser `EventSource` automatically reconnects sending the `Last-Event-ID` header. The server resumes simulation from that event onward.
5. **Clean Termination:**
   When the simulation finishes (e.g. bag claimed or terminal delay reached), the server emits `event: stream-complete` and invokes `res.end()`.
   When the client navigates away or disconnects, the server detects `req.on('close')` and clears background timers to prevent memory leaks.

---

## 8. The 4 Demo Scenarios & Test Booking Credentials

| Scenario ID | Tag Number (10 digits) | Passenger Surname | Booking PNR | Route / Flight | Simulated Narrative & Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`successful_journey`** | `0123456789` | `SMITH` | `WIMB01` | LHR → JFK (`BA178`) | Direct flight. Smooth flow from check-in through to Carousel 4. Risk Level: **LOW**. |
| **`incorrect_verification`** | `0987654321` | `GARCIA` | `WIMB02` | MAD → CDG (`IB3160`) | Used to test auth failure. If entered with wrong surname (e.g. `DOE`), returns `401 Unauthorized`. If correct, shows normal check-in. |
| **`connection_risk`** | `0111222333` | `PATEL` | `WIMB03` | BOM → LHR → ORD (`BA198` / `BA295`) | Transfer flight. Layover shrinks to 35 min (MCT is 60 min). Triggers **HIGH** Risk warning banner. Bag makes connection at the last minute. |
| **`missed_connection`** | `0555666777` | `MUELLER` | `WIMB04` | FRA → LHR → LAX (`LH900` / `AA135`) | Connecting flight departs while bag is delayed in transfer sort. Bag status becomes `MISSED_CONNECTION`. Triggers **CRITICAL** risk and prompts pre-filled Delayed Baggage Report. |

---

## 9. Risk Calculation Engine: Inputs & Output

### 9.1. Inputs
- `scheduledDepartureTime` (Date): Departure time of connecting flight.
- `inboundArrivalTime` (Date): Arrival time of inbound feeder flight.
- `availableConnectionMinutes` (Number): `(scheduledDepartureTime - inboundArrivalTime) / 60000`.
- `minimumConnectTimeMinutes` (Number): Standard transfer threshold (default: 60 minutes).
- `bagMilestone` (String): Current baggage event step.
- `isTerminalTransfer` (Boolean): True if bag must cross terminals (+15 minute transfer penalty).

### 9.2. Calculation Logic
```text
effectiveMCT = minimumConnectTimeMinutes + (isTerminalTransfer ? 15 : 0)
bufferMinutes = availableConnectionMinutes - effectiveMCT

IF bagMilestone == "MISSED_CONNECTION":
    riskLevel = "CRITICAL", score = 1.0, eligibleForDelayedReport = true
ELSE IF bufferMinutes < 0 AND bagMilestone != "LOADED_CONNECTING_FLIGHT":
    riskLevel = "HIGH", score = 0.85, eligibleForDelayedReport = false
ELSE IF bufferMinutes < 20 AND bagMilestone != "LOADED_CONNECTING_FLIGHT":
    riskLevel = "MEDIUM", score = 0.50, eligibleForDelayedReport = false
ELSE:
    riskLevel = "LOW", score = 0.10, eligibleForDelayedReport = false
```

### 9.3. Output Schema
```json
{
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "score": 0.85,
  "factors": [
    {
      "code": "SHORT_LAYOVER",
      "message": "Layover window of 35 min is below airport minimum connection time (60 min)."
    }
  ],
  "recommendation": "Bag transfer expedited by airport handlers. Proceed to gate.",
  "eligibleForDelayedReport": false
}
```

---

## 10. BaggageAdapter Interface & Report Response

### 10.1. Adapter Architecture
The backend uses an Adapter pattern so the simulation can be swapped for a real airline API in the future without changing routes or controllers:

```javascript
/**
 * Abstract BaggageAdapter Interface
 */
class BaggageAdapter {
  async verifyPassenger({ tagNumber, surname, pnr }) {}
  async getBagDetails(tagNumber) {}
  async getTimeline(tagNumber) {}
  async calculateRisk(tagNumber) {}
  subscribeToUpdates(tagNumber, onEventCallback) {} // Returns unsubscribe function
  async submitDelayedReport(reportData) {}
}
```

* **`SimulatorBaggageAdapter`**: Default implementation. Plays timed events for the 4 hackathon demo scenarios.
* **`AirlineApiStubAdapter`**: Future extension stub with comments showing how to connect to IATA Resolution 753 REST/XML/GraphQL airline APIs.

### 10.2. Report Reference Format
Submissions to `POST /api/reports/delayed` return a formatted reference number:
* Format: `WIMB-DEL-<YYYYMMDD>-<4_DIGIT_RANDOM>`
* Example: `WIMB-DEL-20261010-7492`

---

## 11. Required vs. Optional Fields Matrix

| Payload / Entity | Field Name | Required / Optional | Constraints |
| :--- | :--- | :--- | :--- |
| **Verification Request** | `tagNumber` | **Required** | String, exactly 10 numeric digits |
| | `surname` | **Required** | String, non-empty, case-insensitive match |
| | `pnr` | **Required** | String, exactly 6 alphanumeric characters |
| **Delayed Report Request** | `tagNumber` | **Required** | String, 10 digits |
| | `pnr` | **Required** | String, 6 alphanumeric chars |
| | `passengerSurname` | **Required** | String, non-empty |
| | `deliveryAddress` | **Required** | String, minimum 5 characters |
| | `contactPhone` | **Required** | String, valid phone number format |
| | `contactEmail` | **Required** | String, valid email address |
| | `bagDescription` | **Required** | String, min 5 chars (brand, color, features) |
| | `notes` | *Optional* | String, any additional notes |
| **Baggage Event** | `id` | **Required** | Unique string identifier (`evt_xxx`) |
| | `tagNumber` | **Required** | 10-digit string |
| | `step` | **Required** | Enum (see Section 4) |
| | `category` | **Required** | Enum (see Section 4) |
| | `status` | **Required** | Enum (see Section 4) |
| | `airportCode` | **Required** | 3-letter IATA code |
| | `location` | **Required** | Human-readable location description |
| | `timestamp` | **Required** | ISO 8601 string |
| | `description` | **Required** | Passenger-friendly milestone description |
| | `visibility` | **Required** | `PASSENGER` or `INTERNAL_ONLY` |
| | `flightNumber` | *Optional* | String e.g. `BA178`, or `null` for ground scans |
| | `estimatedTimestamp`| *Optional* | ISO 8601 string or `null` |
| | `internalNotes` | *Optional* | String or `null` (never visible to passenger) |