/**
 * Deterministic Baggage Simulation Engine & State Machine
 *
 * Implements realistic baggage movement tracking, state transitions,
 * scenario execution, timer management, subscription handling, memory cleanup,
 * and strict field privacy per CONTRACT.md.
 *
 * Reference: CONTRACT.md Section 4, 5, 7, 8, 9
 */

'use strict';

const { DEMO_SCENARIOS } = require('../data/scenarios');
const { FIXTURE_SCENARIOS } = require('../data/fixtures');
const { calculateRisk } = require('./riskService');

/**
 * CONTRACT.md Section 4: Allowed Enum Values
 */
const ALLOWED_STEPS = [
  'CHECKED_IN',
  'SECURITY_SCREENED',
  'SORTED_TO_CONTAINER',
  'LOADED_ON_AIRCRAFT',
  'DEPARTED',
  'ARRIVED_TRANSFER_HUB',
  'TRANSFER_UNLOADED',
  'TRANSFER_SORTED',
  'TRANSFER_TIGHT_CONNECTION',
  'LOADED_CONNECTING_FLIGHT',
  'MISSED_CONNECTION',
  'ARRIVED_DESTINATION',
  'UNLOADED_FROM_AIRCRAFT',
  'DELIVERED_TO_CAROUSEL',
  'CLAIMED'
];

const ALLOWED_CATEGORIES = [
  'CHECK_IN',
  'SECURITY',
  'SORTING',
  'RAMP',
  'FLIGHT',
  'TRANSFER',
  'ARRIVAL',
  'EXCEPTION'
];

const ALLOWED_STATUSES = [
  'COMPLETED',
  'IN_PROGRESS',
  'WARNING',
  'FAILED',
  'PENDING'
];

/**
 * Baggage Movement State Machine: Valid step transitions
 */
const ALLOWED_TRANSITIONS = {
  CHECKED_IN: ['SECURITY_SCREENED'],
  SECURITY_SCREENED: ['SORTED_TO_CONTAINER', 'LOADED_ON_AIRCRAFT'],
  SORTED_TO_CONTAINER: ['LOADED_ON_AIRCRAFT'],
  LOADED_ON_AIRCRAFT: ['DEPARTED'],
  DEPARTED: ['ARRIVED_TRANSFER_HUB', 'ARRIVED_DESTINATION', 'UNLOADED_FROM_AIRCRAFT'],
  ARRIVED_TRANSFER_HUB: ['TRANSFER_UNLOADED', 'TRANSFER_TIGHT_CONNECTION'],
  TRANSFER_UNLOADED: ['TRANSFER_SORTED', 'TRANSFER_TIGHT_CONNECTION', 'MISSED_CONNECTION'],
  TRANSFER_SORTED: ['TRANSFER_TIGHT_CONNECTION', 'LOADED_CONNECTING_FLIGHT', 'MISSED_CONNECTION'],
  TRANSFER_TIGHT_CONNECTION: ['LOADED_CONNECTING_FLIGHT', 'MISSED_CONNECTION'],
  LOADED_CONNECTING_FLIGHT: ['DEPARTED', 'ARRIVED_DESTINATION'],
  MISSED_CONNECTION: [],
  ARRIVED_DESTINATION: ['UNLOADED_FROM_AIRCRAFT', 'DELIVERED_TO_CAROUSEL'],
  UNLOADED_FROM_AIRCRAFT: ['DELIVERED_TO_CAROUSEL'],
  DELIVERED_TO_CAROUSEL: ['CLAIMED'],
  CLAIMED: []
};

/**
 * State Machine Helper
 */
class BaggageStateMachine {
  static isValidStep(step) {
    return ALLOWED_STEPS.includes(step);
  }

  static isValidCategory(category) {
    return ALLOWED_CATEGORIES.includes(category);
  }

  static isValidStatus(status) {
    return ALLOWED_STATUSES.includes(status);
  }

  static canTransition(fromStep, toStep) {
    if (!fromStep) return ALLOWED_STEPS.includes(toStep);
    const allowed = ALLOWED_TRANSITIONS[fromStep] || [];
    return allowed.includes(toStep);
  }

  /**
   * Validates a sequence of baggage events for realistic order.
   *
   * @param {Array<Object>} events
   * @returns {{ isValid: boolean, error?: string }}
   */
  static validateSequence(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return { isValid: false, error: 'Event sequence must be a non-empty array' };
    }

    for (let i = 0; i < events.length; i++) {
      const current = events[i];
      if (!this.isValidStep(current.step)) {
        return { isValid: false, error: `Invalid step: "${current.step}" at index ${i}` };
      }
      if (!this.isValidCategory(current.category)) {
        return { isValid: false, error: `Invalid category: "${current.category}" at index ${i}` };
      }
      if (!this.isValidStatus(current.status)) {
        return { isValid: false, error: `Invalid status: "${current.status}" at index ${i}` };
      }

      if (i > 0) {
        const prev = events[i - 1];
        if (!this.canTransition(prev.step, current.step)) {
          return {
            isValid: false,
            error: `Invalid state transition from "${prev.step}" to "${current.step}" between index ${i - 1} and ${i}`
          };
        }
      }
    }

    return { isValid: true };
  }
}

/**
 * Sanitizes event for public passenger view (CONTRACT.md Section 5 & Requirement 9/10).
 * Strips internal diagnostic telemetry and internalNotes.
 *
 * @param {Object} event
 * @returns {Object|null}
 */
function sanitizeForPublic(event) {
  if (!event || event.visibility === 'INTERNAL_ONLY') {
    return null;
  }

  return {
    id: String(event.id),
    tagNumber: String(event.tagNumber),
    step: event.step,
    category: event.category,
    status: event.status,
    flightNumber: event.flightNumber ? String(event.flightNumber) : null,
    airportCode: String(event.airportCode),
    location: String(event.location),
    timestamp: String(event.timestamp),
    estimatedTimestamp: event.estimatedTimestamp ? String(event.estimatedTimestamp) : null,
    description: String(event.description),
    visibility: 'PASSENGER',
    internalNotes: null // Strictly null for passenger events
  };
}

/**
 * Merges DEMO_SCENARIOS and FIXTURE_SCENARIOS into a single lookup map.
 */
function getAllScenariosMap() {
  const merged = {};

  // Register DEMO_SCENARIOS (0123456789, 0987654321, 0111222333, 0555666777)
  Object.values(DEMO_SCENARIOS).forEach((s) => {
    merged[s.tagNumber] = s;
  });

  // Register FIXTURE_SCENARIOS (0055123456, 0055123457, 0055123458, 0055123459)
  Object.values(FIXTURE_SCENARIOS).forEach((s) => {
    merged[s.tagNumber] = s;
  });

  return merged;
}

/**
 * Single Active Simulation Session
 */
class SimulationSession {
  constructor(scenario, options = {}) {
    this.scenario = scenario;
    this.tagNumber = scenario.tagNumber;
    this.stepDelayMs =
      typeof options.stepDelayMs === 'number'
        ? options.stepDelayMs
        : Number(process.env.SIMULATION_STEP_DELAY_MS) || 1500;

    this.subscribers = new Set();
    this.timers = [];
    this.eventsEmitted = [];
    this.isCompleted = false;
    this.isStopped = false;
    this.lastEmittedEvent = null;

    // Filter to passenger-facing events
    this.publicEvents = scenario.events
      .map((e) => sanitizeForPublic(e))
      .filter(Boolean);
  }

  /**
   * Adds a subscriber callback, preventing duplicates.
   *
   * @param {Function} callback
   * @returns {boolean} True if added, false if duplicate
   */
  addSubscriber(callback) {
    if (typeof callback !== 'function') return false;
    if (this.subscribers.has(callback)) {
      return false; // Prevent duplicate subscriptions
    }
    this.subscribers.add(callback);
    return true;
  }

  /**
   * Removes a subscriber callback.
   *
   * @param {Function} callback
   * @returns {number} Remaining subscriber count
   */
  removeSubscriber(callback) {
    this.subscribers.delete(callback);
    return this.subscribers.size;
  }

  /**
   * Broadcasts a payload to all active subscribers.
   */
  broadcast(payload) {
    if (this.isStopped) return;
    for (const cb of this.subscribers) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[SimulationEngine] Error in subscriber callback for tag ${this.tagNumber}:`, err);
      }
    }
  }

  /**
   * Starts or resumes event execution timers.
   *
   * @param {string} [lastEventId] - ID of last event received for resumption
   */
  start(lastEventId) {
    if (this.isStopped) return;

    let startIndex = 0;
    if (lastEventId) {
      const foundIdx = this.publicEvents.findIndex((e) => e.id === lastEventId);
      if (foundIdx !== -1) {
        startIndex = foundIdx + 1;
      }
    }

    const eventsToSchedule = this.publicEvents.slice(startIndex);

    if (eventsToSchedule.length === 0) {
      this.isCompleted = true;
      this.broadcast({
        type: 'stream-complete',
        data: { status: 'FINISHED', tagNumber: this.tagNumber }
      });
      return;
    }

    eventsToSchedule.forEach((event, idx) => {
      const delay = (idx + 1) * this.stepDelayMs;
      const timer = setTimeout(() => {
        if (this.isStopped) return;

        this.lastEmittedEvent = event;
        this.eventsEmitted.push(event);

        // 1. Emit baggage event
        this.broadcast({
          type: 'baggage-event',
          id: event.id,
          data: event
        });

        // 2. Compute & emit risk alert
        if (this.scenario.riskConfig) {
          const riskAssessment = calculateRisk({
            bagMilestone: event.step,
            availableConnectionMinutes: this.scenario.riskConfig.availableConnectionMinutes,
            minimumConnectTimeMinutes: this.scenario.riskConfig.minimumConnectTimeMinutes,
            isTerminalTransfer: this.scenario.riskConfig.isTerminalTransfer
          });

          if (
            riskAssessment.riskLevel === 'HIGH' ||
            riskAssessment.riskLevel === 'CRITICAL' ||
            event.step === 'LOADED_CONNECTING_FLIGHT' ||
            event.step === 'TRANSFER_TIGHT_CONNECTION'
          ) {
            this.broadcast({
              type: 'risk-alert',
              data: riskAssessment
            });
          }
        }

        // 3. Emit stream-complete if last event
        if (idx === eventsToSchedule.length - 1) {
          const completionTimer = setTimeout(() => {
            if (this.isStopped) return;
            this.isCompleted = true;
            this.broadcast({
              type: 'stream-complete',
              data: { status: 'FINISHED', tagNumber: this.tagNumber }
            });
          }, Math.min(this.stepDelayMs, 500));
          this.timers.push(completionTimer);
        }
      }, delay);

      this.timers.push(timer);
    });
  }

  /**
   * Stops simulation, clears all active timers, and cleans up subscribers.
   */
  stop() {
    this.isStopped = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.subscribers.clear();
  }
}

/**
 * Main Simulation Engine Service
 */
class BaggageSimulationEngine {
  constructor(options = {}) {
    this.options = options;
    this.activeSessions = new Map(); // tagNumber -> SimulationSession
    this.scenariosMap = getAllScenariosMap();
  }

  /**
   * Returns a scenario by tag number.
   *
   * @param {string} tagNumber
   * @returns {Object|null}
   */
  getScenarioByTag(tagNumber) {
    const sanitized = String(tagNumber || '').trim();
    return this.scenariosMap[sanitized] || null;
  }

  /**
   * Subscribes to real-time events for a baggage tag.
   * Prevents duplicate subscriptions, manages timers, and returns unsubscribe function.
   *
   * @param {string} tagNumber
   * @param {Function} callback - Subscriber function receiving ({ type, id, data })
   * @param {Object} [subOptions={}]
   * @param {string} [subOptions.lastEventId] - Resumption event ID
   * @param {number} [subOptions.stepDelayMs] - Custom step delay override
   * @returns {{ success: boolean, errorCode?: string, errorMessage?: string, unsubscribe: Function }}
   */
  subscribe(tagNumber, callback, subOptions = {}) {
    const sanitizedTag = String(tagNumber || '').trim();
    const scenario = this.getScenarioByTag(sanitizedTag);

    if (!scenario) {
      return {
        success: false,
        errorCode: 'TAG_NOT_FOUND',
        errorMessage: `No simulation scenario found for tag number "${sanitizedTag}".`,
        unsubscribe: () => {}
      };
    }

    let session = this.activeSessions.get(sanitizedTag);

    if (!session || session.isStopped || session.isCompleted) {
      session = new SimulationSession(scenario, {
        stepDelayMs: subOptions.stepDelayMs ?? this.options.stepDelayMs
      });
      this.activeSessions.set(sanitizedTag, session);
      session.addSubscriber(callback);
      session.start(subOptions.lastEventId);
    } else {
      const added = session.addSubscriber(callback);
      // If session was already running and subscriber was added, send current snapshot / status
      if (added && session.lastEmittedEvent) {
        try {
          callback({
            type: 'baggage-event',
            id: session.lastEmittedEvent.id,
            data: session.lastEmittedEvent
          });
        } catch (err) {
          console.error(`[SimulationEngine] Error sending initial snapshot:`, err);
        }
      }
    }

    const unsubscribe = () => {
      const currentSession = this.activeSessions.get(sanitizedTag);
      if (currentSession) {
        const remaining = currentSession.removeSubscriber(callback);
        if (remaining === 0) {
          currentSession.stop();
          this.activeSessions.delete(sanitizedTag);
        }
      }
    };

    return {
      success: true,
      unsubscribe
    };
  }

  /**
   * Explicitly stops a simulation and cleans up its timers.
   *
   * @param {string} tagNumber
   * @returns {boolean} True if stopped, false if no active simulation found
   */
  stopSimulation(tagNumber) {
    const sanitizedTag = String(tagNumber || '').trim();
    const session = this.activeSessions.get(sanitizedTag);
    if (session) {
      session.stop();
      this.activeSessions.delete(sanitizedTag);
      return true;
    }
    return false;
  }

  /**
   * Stops all active simulations and cleans up all timers.
   */
  stopAllSimulations() {
    for (const [tag, session] of this.activeSessions.entries()) {
      session.stop();
    }
    this.activeSessions.clear();
  }

  /**
   * Gets current simulation session status for a tag.
   *
   * @param {string} tagNumber
   * @returns {Object|null}
   */
  getSimulationStatus(tagNumber) {
    const sanitizedTag = String(tagNumber || '').trim();
    const session = this.activeSessions.get(sanitizedTag);
    if (!session) return null;

    return {
      tagNumber: session.tagNumber,
      isActive: !session.isStopped && !session.isCompleted,
      isCompleted: session.isCompleted,
      subscriberCount: session.subscribers.size,
      eventsEmittedCount: session.eventsEmitted.length,
      totalEventsCount: session.publicEvents.length,
      lastStep: session.lastEmittedEvent ? session.lastEmittedEvent.step : null
    };
  }
}

// Global default singleton engine instance
const defaultEngine = new BaggageSimulationEngine();

module.exports = {
  ALLOWED_STEPS,
  ALLOWED_CATEGORIES,
  ALLOWED_STATUSES,
  ALLOWED_TRANSITIONS,
  BaggageStateMachine,
  sanitizeForPublic,
  getAllScenariosMap,
  SimulationSession,
  BaggageSimulationEngine,
  defaultEngine
};
