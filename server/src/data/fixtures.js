/**
 * Fictional Demo Fixtures for WhereIsMyBag — PART B
 *
 * These are entirely fictional records created for hackathon demo purposes.
 * They are NOT real passenger, airline, or flight data.
 *
 * These fixtures use the NEW tag numbers introduced in this task:
 *   0055123456 — Happy path (complete journey, no risk)
 *   0055123457 — Connection-risk scenario (tight layover, HIGH risk)
 *   0055123458 — Missed-connection scenario (CRITICAL risk, delay report eligible)
 *   0055123459 — Auth-test fixture (used to test wrong surname / PNR rejection)
 *
 * Tag structure (per tagParser.js):
 *   "0055123456" → leading: "0", airlineCode: "055", serial: "123456"
 *   Airline code "055" → Nimbus Airways (NB) — fictional
 *
 * The CONTRACT.md Section 8 scenarios (0123456789 etc.) remain unchanged
 * in server/src/data/scenarios.js. This file adds supplementary fixtures only.
 *
 * Reference: CONTRACT.md Section 4, 8, 9, 11
 */

'use strict';

// ---------------------------------------------------------------------------
// PART B.1: Fictional Airlines
// ---------------------------------------------------------------------------

const FICTIONAL_AIRLINES = {
  NB: {
    iata: 'NB',
    numericCode: '055',
    name: 'Nimbus Airways',
    hub: 'ARC'
  },
  SV: {
    iata: 'SV',
    numericCode: '077',
    name: 'Silverstone Air',
    hub: 'CLV'
  }
};

// ---------------------------------------------------------------------------
// PART B.2: Fictional Airports
// ---------------------------------------------------------------------------

const FICTIONAL_AIRPORTS = {
  ARC: { code: 'ARC', name: 'Arcadia International Airport', city: 'Arcadia', country: 'Fictavia' },
  CLV: { code: 'CLV', name: 'Cloverfield Regional Airport', city: 'Cloverfield', country: 'Fictavia' },
  PNX: { code: 'PNX', name: 'Phoenix Dunes Airport', city: 'Duneshire', country: 'Westmark' },
  VLN: { code: 'VLN', name: 'Valena Coastal Airport', city: 'Valena', country: 'Westmark' },
  NRD: { code: 'NRD', name: 'Nordvik Central Airport', city: 'Nordvik', country: 'Nordheim' }
};

// ---------------------------------------------------------------------------
// PART B.3: Fictional Bookings
// ---------------------------------------------------------------------------

const FICTIONAL_BOOKINGS = {
  NBFX01: {
    pnr: 'NBFX01',
    passengerSurname: 'OKAFOR',
    passengerFullName: 'Chidi Okafor',
    tagNumber: '0055123456',
    scenario: 'happy_path'
  },
  NBFX02: {
    pnr: 'NBFX02',
    passengerSurname: 'LINDQVIST',
    passengerFullName: 'Astrid Lindqvist',
    tagNumber: '0055123457',
    scenario: 'connection_risk_fixture'
  },
  NBFX03: {
    pnr: 'NBFX03',
    passengerSurname: 'FERREIRA',
    passengerFullName: 'Marco Ferreira',
    tagNumber: '0055123458',
    scenario: 'missed_connection_fixture'
  },
  NBFX04: {
    pnr: 'NBFX04',
    passengerSurname: 'TANAKA',
    passengerFullName: 'Yuki Tanaka',
    tagNumber: '0055123459',
    scenario: 'auth_test_fixture'
  }
};

// ---------------------------------------------------------------------------
// PART B.4: Fictional Flights
// ---------------------------------------------------------------------------

const FICTIONAL_FLIGHTS = {
  'NB201': {
    flightNumber: 'NB201',
    airline: 'NB',
    origin: 'ARC',
    destination: 'PNX',
    scheduledDeparture: '2026-10-11T08:00:00.000Z',
    scheduledArrival:   '2026-10-11T11:30:00.000Z',
    loadingCutoff:      '2026-10-11T07:30:00.000Z'
  },
  'NB202': {
    flightNumber: 'NB202',
    airline: 'NB',
    origin: 'PNX',
    destination: 'VLN',
    scheduledDeparture: '2026-10-11T13:30:00.000Z',
    scheduledArrival:   '2026-10-11T16:15:00.000Z',
    loadingCutoff:      '2026-10-11T13:00:00.000Z'
  },
  'NB301': {
    flightNumber: 'NB301',
    airline: 'NB',
    origin: 'ARC',
    destination: 'CLV',
    scheduledDeparture: '2026-10-11T09:00:00.000Z',
    scheduledArrival:   '2026-10-11T11:35:00.000Z',
    loadingCutoff:      '2026-10-11T08:30:00.000Z'
  },
  'SV410': {
    flightNumber: 'SV410',
    airline: 'SV',
    origin: 'CLV',
    destination: 'NRD',
    scheduledDeparture: '2026-10-11T12:05:00.000Z',
    scheduledArrival:   '2026-10-11T15:50:00.000Z',
    loadingCutoff:      '2026-10-11T11:35:00.000Z'
  },
  'NB401': {
    flightNumber: 'NB401',
    airline: 'NB',
    origin: 'ARC',
    destination: 'CLV',
    scheduledDeparture: '2026-10-11T10:00:00.000Z',
    scheduledArrival:   '2026-10-11T12:45:00.000Z',
    loadingCutoff:      '2026-10-11T09:30:00.000Z'
  },
  'SV500': {
    flightNumber: 'SV500',
    airline: 'SV',
    origin: 'CLV',
    destination: 'NRD',
    scheduledDeparture: '2026-10-11T13:00:00.000Z',
    scheduledArrival:   '2026-10-11T17:30:00.000Z',
    loadingCutoff:      '2026-10-11T12:30:00.000Z'
  }
};

// ---------------------------------------------------------------------------
// PART B.5: Demo Scenario Fixtures
// ---------------------------------------------------------------------------

/**
 * Scenario 1 (PART B): Happy Path — Tag 0055123456
 * Chidi Okafor / NB201 / ARC → PNX. Direct flight, no transfer.
 * Risk Level: LOW throughout.
 */
const HAPPY_PATH_FIXTURE = {
  id: 'happy_path',
  title: 'Fixture 1: Happy Path — Direct Flight',
  tagNumber: '0055123456',
  surname: 'OKAFOR',
  pnr: 'NBFX01',
  passengerFullName: 'Chidi Okafor',
  origin: 'ARC',
  destination: 'PNX',
  currentFlight: 'NB201',
  description: 'Direct flight from Arcadia to Phoenix Dunes. Smooth end-to-end flow.',
  riskConfig: {
    minimumConnectTimeMinutes: 60,
    isTerminalTransfer: false,
    availableConnectionMinutes: 120
  },
  events: [
    {
      id: 'evt_hp_01',
      tagNumber: '0055123456',
      step: 'CHECKED_IN',
      category: 'CHECK_IN',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'ARC',
      location: 'Arcadia International — Check-in Zone C, Counter 14',
      timestamp: '2026-10-11T06:15:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag checked in at Arcadia International (ARC).',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_hp_02',
      tagNumber: '0055123456',
      step: 'SECURITY_SCREENED',
      category: 'SECURITY',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'ARC',
      location: 'ARC In-line Baggage Screening Unit 3',
      timestamp: '2026-10-11T06:40:00.000Z',
      estimatedTimestamp: null,
      description: 'Security inspection passed. No anomalies detected.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_hp_03_int',
      tagNumber: '0055123456',
      step: 'SORTED_TO_CONTAINER',
      category: 'SORTING',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'ARC',
      location: 'ARC Automated Sortation Chute 7',
      timestamp: '2026-10-11T07:00:00.000Z',
      estimatedTimestamp: null,
      description: 'Sortation scan at chute 7.',
      visibility: 'INTERNAL_ONLY',
      internalNotes: 'Belt speed 1.2 m/s. Optical scan ID confirmed.'
    },
    {
      id: 'evt_hp_04',
      tagNumber: '0055123456',
      step: 'LOADED_ON_AIRCRAFT',
      category: 'RAMP',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'ARC',
      location: 'NB201 Hold — Forward Bay',
      timestamp: '2026-10-11T07:20:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag loaded onto Nimbus Airways flight NB201.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_hp_05',
      tagNumber: '0055123456',
      step: 'DEPARTED',
      category: 'FLIGHT',
      status: 'IN_PROGRESS',
      flightNumber: 'NB201',
      airportCode: 'ARC',
      location: 'Runway 28L',
      timestamp: '2026-10-11T08:00:00.000Z',
      estimatedTimestamp: '2026-10-11T11:30:00.000Z',
      description: 'Flight NB201 departed Arcadia for Phoenix Dunes.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_hp_06',
      tagNumber: '0055123456',
      step: 'ARRIVED_DESTINATION',
      category: 'ARRIVAL',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'PNX',
      location: 'Phoenix Dunes Airport — Gate 9',
      timestamp: '2026-10-11T11:28:00.000Z',
      estimatedTimestamp: null,
      description: 'Flight NB201 arrived at Phoenix Dunes (PNX).',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_hp_07',
      tagNumber: '0055123456',
      step: 'DELIVERED_TO_CAROUSEL',
      category: 'ARRIVAL',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'PNX',
      location: 'PNX Arrivals Hall — Carousel 3',
      timestamp: '2026-10-11T11:55:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag delivered to Carousel 3 at Phoenix Dunes.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_hp_08',
      tagNumber: '0055123456',
      step: 'CLAIMED',
      category: 'ARRIVAL',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'PNX',
      location: 'Carousel 3 Exit',
      timestamp: '2026-10-11T12:05:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag successfully retrieved by passenger.',
      visibility: 'PASSENGER',
      internalNotes: null
    }
  ]
};

/**
 * Scenario 2 (PART B): Connection-Risk — Tag 0055123457
 * Astrid Lindqvist / NB301 + SV410 / ARC → CLV → NRD
 * Transfer at Cloverfield: 30 min available, MCT 60 min (inter-terminal) → HIGH risk.
 * Bag makes connection at last moment.
 */
const CONNECTION_RISK_FIXTURE = {
  id: 'connection_risk_fixture',
  title: 'Fixture 2: Connection Risk — Tight Layover',
  tagNumber: '0055123457',
  surname: 'LINDQVIST',
  pnr: 'NBFX02',
  passengerFullName: 'Astrid Lindqvist',
  origin: 'ARC',
  destination: 'NRD',
  currentFlight: 'NB301',
  description: 'Transfer at Cloverfield with only 30 min layover vs. 60 min MCT. Triggers HIGH risk.',
  riskConfig: {
    minimumConnectTimeMinutes: 60,
    isTerminalTransfer: false,
    availableConnectionMinutes: 30
  },
  events: [
    {
      id: 'evt_cr2_01',
      tagNumber: '0055123457',
      step: 'CHECKED_IN',
      category: 'CHECK_IN',
      status: 'COMPLETED',
      flightNumber: 'NB301',
      airportCode: 'ARC',
      location: 'Arcadia International — Check-in Zone A, Counter 2',
      timestamp: '2026-10-11T07:00:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag checked in at Arcadia International (ARC).',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_02',
      tagNumber: '0055123457',
      step: 'SECURITY_SCREENED',
      category: 'SECURITY',
      status: 'COMPLETED',
      flightNumber: 'NB301',
      airportCode: 'ARC',
      location: 'ARC In-line Screening Unit 1',
      timestamp: '2026-10-11T07:30:00.000Z',
      estimatedTimestamp: null,
      description: 'Baggage security check passed.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_03',
      tagNumber: '0055123457',
      step: 'LOADED_ON_AIRCRAFT',
      category: 'RAMP',
      status: 'COMPLETED',
      flightNumber: 'NB301',
      airportCode: 'ARC',
      location: 'NB301 Hold — Aft Bay',
      timestamp: '2026-10-11T08:25:00.000Z',
      estimatedTimestamp: null,
      description: 'Loaded onto NB301 bound for Cloverfield.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_04',
      tagNumber: '0055123457',
      step: 'DEPARTED',
      category: 'FLIGHT',
      status: 'COMPLETED',
      flightNumber: 'NB301',
      airportCode: 'ARC',
      location: 'Runway 10R',
      timestamp: '2026-10-11T09:00:00.000Z',
      estimatedTimestamp: '2026-10-11T11:35:00.000Z',
      description: 'Flight NB301 departed Arcadia.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_05',
      tagNumber: '0055123457',
      step: 'ARRIVED_TRANSFER_HUB',
      category: 'TRANSFER',
      status: 'COMPLETED',
      flightNumber: 'NB301',
      airportCode: 'CLV',
      location: 'Cloverfield Regional — Gate T2',
      timestamp: '2026-10-11T11:35:00.000Z',
      estimatedTimestamp: null,
      description: 'Inbound flight NB301 arrived at Cloverfield transfer hub.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_06',
      tagNumber: '0055123457',
      step: 'TRANSFER_TIGHT_CONNECTION',
      category: 'TRANSFER',
      status: 'WARNING',
      flightNumber: 'SV410',
      airportCode: 'CLV',
      location: 'CLV Transfer Sorting Hub',
      timestamp: '2026-10-11T11:45:00.000Z',
      estimatedTimestamp: null,
      description: 'Transfer in progress — expedited handling applied.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_07',
      tagNumber: '0055123457',
      step: 'LOADED_CONNECTING_FLIGHT',
      category: 'RAMP',
      status: 'COMPLETED',
      flightNumber: 'SV410',
      airportCode: 'CLV',
      location: 'SV410 Hold',
      timestamp: '2026-10-11T11:58:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag made connection and loaded onto SV410 to Nordvik.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_cr2_08',
      tagNumber: '0055123457',
      step: 'ARRIVED_DESTINATION',
      category: 'ARRIVAL',
      status: 'PENDING',
      flightNumber: 'SV410',
      airportCode: 'NRD',
      location: 'Nordvik Central Airport — Arrivals',
      timestamp: '2026-10-11T15:50:00.000Z',
      estimatedTimestamp: null,
      description: 'Estimated arrival at Nordvik.',
      visibility: 'PASSENGER',
      internalNotes: null
    }
  ]
};

/**
 * Scenario 3 (PART B): Missed Connection — Tag 0055123458
 * Marco Ferreira / NB401 + SV500 / ARC → CLV → NRD
 * Inbound NB401 delayed. Bag missed SV500 loading cutoff.
 * Risk Level: CRITICAL. Eligible for delayed baggage report.
 */
const MISSED_CONNECTION_FIXTURE = {
  id: 'missed_connection_fixture',
  title: 'Fixture 3: Missed Connection — Delayed Report Eligible',
  tagNumber: '0055123458',
  surname: 'FERREIRA',
  pnr: 'NBFX03',
  passengerFullName: 'Marco Ferreira',
  origin: 'ARC',
  destination: 'NRD',
  currentFlight: 'NB401',
  description: 'Inbound flight delayed. Bag misses connecting flight SV500. Triggers CRITICAL risk and delayed report.',
  riskConfig: {
    minimumConnectTimeMinutes: 60,
    isTerminalTransfer: false,
    availableConnectionMinutes: 15
  },
  events: [
    {
      id: 'evt_mc2_01',
      tagNumber: '0055123458',
      step: 'CHECKED_IN',
      category: 'CHECK_IN',
      status: 'COMPLETED',
      flightNumber: 'NB401',
      airportCode: 'ARC',
      location: 'Arcadia International — Check-in Zone B, Counter 8',
      timestamp: '2026-10-11T07:30:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag checked in at Arcadia International (ARC).',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_mc2_02',
      tagNumber: '0055123458',
      step: 'SECURITY_SCREENED',
      category: 'SECURITY',
      status: 'COMPLETED',
      flightNumber: 'NB401',
      airportCode: 'ARC',
      location: 'ARC In-line Screening Unit 4',
      timestamp: '2026-10-11T08:00:00.000Z',
      estimatedTimestamp: null,
      description: 'Security screening cleared.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_mc2_03',
      tagNumber: '0055123458',
      step: 'LOADED_ON_AIRCRAFT',
      category: 'RAMP',
      status: 'COMPLETED',
      flightNumber: 'NB401',
      airportCode: 'ARC',
      location: 'NB401 Hold',
      timestamp: '2026-10-11T09:15:00.000Z',
      estimatedTimestamp: null,
      description: 'Loaded onto NB401 to Cloverfield.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_mc2_04',
      tagNumber: '0055123458',
      step: 'DEPARTED',
      category: 'FLIGHT',
      status: 'COMPLETED',
      flightNumber: 'NB401',
      airportCode: 'ARC',
      location: 'Runway 05',
      timestamp: '2026-10-11T10:00:00.000Z',
      estimatedTimestamp: '2026-10-11T12:45:00.000Z',
      description: 'Flight NB401 departed Arcadia — delayed by 60 minutes.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_mc2_05',
      tagNumber: '0055123458',
      step: 'ARRIVED_TRANSFER_HUB',
      category: 'TRANSFER',
      status: 'COMPLETED',
      flightNumber: 'NB401',
      airportCode: 'CLV',
      location: 'Cloverfield Regional — Gate T4',
      timestamp: '2026-10-11T12:55:00.000Z',
      estimatedTimestamp: null,
      description: 'Delayed inbound flight NB401 arrived at Cloverfield. Connecting flight SV500 departed at 13:00.',
      visibility: 'PASSENGER',
      internalNotes: null
    },
    {
      id: 'evt_mc2_06_int',
      tagNumber: '0055123458',
      step: 'TRANSFER_UNLOADED',
      category: 'TRANSFER',
      status: 'COMPLETED',
      flightNumber: 'NB401',
      airportCode: 'CLV',
      location: 'CLV Transfer Ramp',
      timestamp: '2026-10-11T13:05:00.000Z',
      estimatedTimestamp: null,
      description: 'Transfer offload scan.',
      visibility: 'INTERNAL_ONLY',
      internalNotes: 'SV500 cargo doors closed at 12:50. Bag cannot be loaded.'
    },
    {
      id: 'evt_mc2_07',
      tagNumber: '0055123458',
      step: 'MISSED_CONNECTION',
      category: 'EXCEPTION',
      status: 'FAILED',
      flightNumber: 'SV500',
      airportCode: 'CLV',
      location: 'Cloverfield Baggage Resolution Desk',
      timestamp: '2026-10-11T13:10:00.000Z',
      estimatedTimestamp: null,
      description: 'Connecting flight SV500 departed while bag was in transit. Bag held at Cloverfield; rebooked on next available service.',
      visibility: 'PASSENGER',
      internalNotes: null
    }
  ]
};

/**
 * Scenario 4 (PART B): Auth-Test Fixture — Tag 0055123459
 * Yuki Tanaka / NB201 / ARC → PNX.
 * Used exclusively to test that wrong surname/PNR combinations return 401.
 *
 * Correct credentials: surname "TANAKA", pnr "NBFX04"
 * Test: use surname "WRONGNAME" or pnr "ZZZZZZ" → expect VERIFICATION_FAILED.
 */
const AUTH_TEST_FIXTURE = {
  id: 'auth_test_fixture',
  title: 'Fixture 4: Auth Test — Incorrect Surname / PNR',
  tagNumber: '0055123459',
  surname: 'TANAKA',
  pnr: 'NBFX04',
  passengerFullName: 'Yuki Tanaka',
  origin: 'ARC',
  destination: 'PNX',
  currentFlight: 'NB201',
  description: 'Fixture used to verify credential rejection. Enter wrong surname or PNR to receive 401 VERIFICATION_FAILED.',
  riskConfig: {
    minimumConnectTimeMinutes: 60,
    isTerminalTransfer: false,
    availableConnectionMinutes: 120
  },
  events: [
    {
      id: 'evt_at_01',
      tagNumber: '0055123459',
      step: 'CHECKED_IN',
      category: 'CHECK_IN',
      status: 'COMPLETED',
      flightNumber: 'NB201',
      airportCode: 'ARC',
      location: 'Arcadia International — Check-in Zone C, Counter 6',
      timestamp: '2026-10-11T06:00:00.000Z',
      estimatedTimestamp: null,
      description: 'Bag checked in at Arcadia International (ARC).',
      visibility: 'PASSENGER',
      internalNotes: null
    }
  ]
};

// ---------------------------------------------------------------------------
// PART B.6: Fixtures index — all 4 new fixture scenarios keyed by tag number
// ---------------------------------------------------------------------------

const FIXTURE_SCENARIOS = {
  '0055123456': HAPPY_PATH_FIXTURE,
  '0055123457': CONNECTION_RISK_FIXTURE,
  '0055123458': MISSED_CONNECTION_FIXTURE,
  '0055123459': AUTH_TEST_FIXTURE
};

module.exports = {
  FICTIONAL_AIRLINES,
  FICTIONAL_AIRPORTS,
  FICTIONAL_FLIGHTS,
  FICTIONAL_BOOKINGS,
  FIXTURE_SCENARIOS,
  HAPPY_PATH_FIXTURE,
  CONNECTION_RISK_FIXTURE,
  MISSED_CONNECTION_FIXTURE,
  AUTH_TEST_FIXTURE
};
