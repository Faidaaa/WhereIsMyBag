/**
 * SimulatorBaggageAdapter Implementation
 * Reference: CONTRACT.md Section 5, 8, 9, 10
 */

const BaggageAdapter = require('./baggageAdapter');
const { DEMO_SCENARIOS } = require('../data/scenarios');
const { calculateRisk } = require('../services/riskService');
const {
  getAllScenariosMap,
  defaultEngine,
  sanitizeForPublic
} = require('../services/simulationEngine');

class SimulatorBaggageAdapter extends BaggageAdapter {
  constructor() {
    super();
    this.scenariosMap = getAllScenariosMap();
    this.demoScenarios = DEMO_SCENARIOS;
    this.reports = new Map(); // referenceNumber -> reportData
  }

  /**
   * Finds a scenario by tag number across all scenario sources.
   * @param {string} tagNumber
   * @returns {Object|null}
   */
  _findScenarioByTag(tagNumber) {
    const sanitized = String(tagNumber || '').trim();
    return this.scenariosMap[sanitized] || null;
  }

  /**
   * Sanitizes an event for passenger view (CONTRACT.md Section 5).
   * Delegate to simulationEngine's sanitizeForPublic.
   *
   * @param {Object} event
   * @returns {Object|null} Sanitized event or null if internal-only
   */
  _sanitizeForPassenger(event) {
    return sanitizeForPublic(event);
  }

  /**
   * Verify passenger credentials.
   */
  async verifyPassenger({ tagNumber, surname, pnr }) {
    const scenario = this._findScenarioByTag(tagNumber);
    if (!scenario) {
      return {
        success: false,
        errorCode: 'TAG_NOT_FOUND',
        errorMessage: 'Bag tag number does not exist in the airline system.'
      };
    }

    const surnameMatches =
      scenario.surname.toUpperCase() === String(surname).trim().toUpperCase();
    const pnrMatches =
      scenario.pnr.toUpperCase() === String(pnr).trim().toUpperCase();

    if (!surnameMatches || !pnrMatches) {
      return {
        success: false,
        errorCode: 'VERIFICATION_FAILED',
        errorMessage: 'Surname or PNR does not match records for this bag tag.'
      };
    }

    return {
      success: true,
      bag: {
        tagNumber: scenario.tagNumber,
        pnr: scenario.pnr,
        passengerSurname: scenario.surname,
        passengerFullName: scenario.passengerFullName,
        origin: scenario.origin,
        destination: scenario.destination,
        currentFlight: scenario.currentFlight,
        scenario: scenario.id.toUpperCase()
      }
    };
  }

  /**
   * Retrieve bag summary details.
   */
  async getBagDetails(tagNumber) {
    const scenario = this._findScenarioByTag(tagNumber);
    if (!scenario) return null;

    return {
      tagNumber: scenario.tagNumber,
      pnr: scenario.pnr,
      passengerSurname: scenario.surname,
      passengerFullName: scenario.passengerFullName,
      origin: scenario.origin,
      destination: scenario.destination,
      currentFlight: scenario.currentFlight
    };
  }

  /**
   * Retrieve complete timeline filtered for passenger view.
   */
  async getTimeline(tagNumber) {
    const scenario = this._findScenarioByTag(tagNumber);
    if (!scenario) {
      return {
        success: false,
        errorCode: 'TAG_NOT_FOUND',
        errorMessage: 'Bag tag number not recognized.'
      };
    }

    const passengerEvents = scenario.events
      .map((evt) => this._sanitizeForPassenger(evt))
      .filter(Boolean);

    const lastEvent = passengerEvents[passengerEvents.length - 1];
    const currentStep = lastEvent ? lastEvent.step : 'CHECKED_IN';

    const riskAssessment = calculateRisk({
      bagMilestone: currentStep,
      availableConnectionMinutes: scenario.riskConfig.availableConnectionMinutes,
      minimumConnectTimeMinutes: scenario.riskConfig.minimumConnectTimeMinutes,
      isTerminalTransfer: scenario.riskConfig.isTerminalTransfer
    });

    return {
      success: true,
      data: {
        tagNumber: scenario.tagNumber,
        currentStep,
        riskAssessment,
        events: passengerEvents
      }
    };
  }

  /**
   * Calculate current risk assessment for the baggage.
   */
  async calculateRisk(tagNumber) {
    const scenario = this._findScenarioByTag(tagNumber);
    if (!scenario) return null;

    const passengerEvents = scenario.events
      .map((evt) => this._sanitizeForPassenger(evt))
      .filter(Boolean);
    const lastEvent = passengerEvents[passengerEvents.length - 1];
    const currentStep = lastEvent ? lastEvent.step : 'CHECKED_IN';

    return calculateRisk({
      bagMilestone: currentStep,
      availableConnectionMinutes: scenario.riskConfig.availableConnectionMinutes,
      minimumConnectTimeMinutes: scenario.riskConfig.minimumConnectTimeMinutes,
      isTerminalTransfer: scenario.riskConfig.isTerminalTransfer
    });
  }

  /**
   * Subscribes a client to simulation updates.
   * Delegates to BaggageSimulationEngine.
   *
   * @param {string} tagNumber
   * @param {Function} onMessage - callback({ type, id, data })
   * @param {string} [lastEventId] - ID of last received event for reconnection
   * @returns {Function} Unsubscribe function
   */
  subscribeToUpdates(tagNumber, onMessage, lastEventId) {
    const result = defaultEngine.subscribe(tagNumber, onMessage, { lastEventId });
    return result.unsubscribe;
  }

  /**
   * Submit a delayed baggage report.
   * Generates a reference number: WIMB-DEL-<YYYYMMDD>-<4_DIGIT_RANDOM> (CONTRACT.md Section 10.2).
   */
  async submitDelayedReport(reportData) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const random4 = Math.floor(1000 + Math.random() * 9000);

    const referenceNumber = `WIMB-DEL-${yyyy}${mm}${dd}-${random4}`;

    const submittedReport = {
      referenceNumber,
      tagNumber: reportData.tagNumber,
      pnr: reportData.pnr,
      passengerSurname: reportData.passengerSurname,
      deliveryAddress: reportData.deliveryAddress,
      contactPhone: reportData.contactPhone,
      contactEmail: reportData.contactEmail,
      bagDescription: reportData.bagDescription,
      notes: reportData.notes || null,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      estimatedResolutionHours: 24,
      message:
        'Your report has been logged. Airline baggage services will arrange delivery to your specified address once your bag arrives.'
    };

    this.reports.set(referenceNumber, submittedReport);

    return submittedReport;
  }

  /**
   * Returns list of demo scenarios for meta-endpoint (Section 3.5).
   */
  getScenariosList() {
    return Object.values(this.demoScenarios).map((s) => ({
      id: s.id,
      title: s.title,
      tagNumber: s.tagNumber,
      surname: s.surname,
      pnr: s.pnr,
      description: s.description
    }));
  }
}

module.exports = SimulatorBaggageAdapter;
