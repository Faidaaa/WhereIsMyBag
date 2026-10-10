/**
 * Risk Calculation Engine for Baggage Connection Monitoring
 * Reference: CONTRACT.md Section 9
 */

/**
 * Calculates risk level, score, factors, and recommendations for a baggage journey.
 *
 * @param {Object} params
 * @param {string} params.bagMilestone - Current baggage event step (e.g. 'MISSED_CONNECTION', 'LOADED_CONNECTING_FLIGHT')
 * @param {number} [params.availableConnectionMinutes] - Connection window in minutes
 * @param {Date|string} [params.scheduledDepartureTime] - Connecting flight departure time
 * @param {Date|string} [params.inboundArrivalTime] - Inbound flight arrival time
 * @param {number} [params.minimumConnectTimeMinutes=60] - Airport standard MCT (default: 60)
 * @param {boolean} [params.isTerminalTransfer=false] - Whether transfer crosses terminals (+15 min penalty)
 * @returns {Object} Risk assessment object matching CONTRACT.md schema
 */
function calculateRisk({
  bagMilestone,
  availableConnectionMinutes,
  scheduledDepartureTime,
  inboundArrivalTime,
  minimumConnectTimeMinutes = 60,
  isTerminalTransfer = false
}) {
  // If dates are provided, calculate availableConnectionMinutes
  let connectionMinutes = availableConnectionMinutes;
  if (connectionMinutes === undefined || connectionMinutes === null) {
    if (scheduledDepartureTime && inboundArrivalTime) {
      const dep = new Date(scheduledDepartureTime).getTime();
      const arr = new Date(inboundArrivalTime).getTime();
      connectionMinutes = Math.round((dep - arr) / (1000 * 60));
    } else {
      // Default to ample time if not a transfer flight
      connectionMinutes = 120;
    }
  }

  const effectiveMCT = minimumConnectTimeMinutes + (isTerminalTransfer ? 15 : 0);
  const bufferMinutes = connectionMinutes - effectiveMCT;

  // 1. Critical: Bag missed connection
  if (bagMilestone === 'MISSED_CONNECTION') {
    return {
      riskLevel: 'CRITICAL',
      score: 1.0,
      factors: [
        {
          code: 'MISSED_CONNECTION',
          message: 'Connecting flight departed while baggage was in transfer transit.'
        }
      ],
      recommendation: 'Bag did not make connecting flight. Please file a delayed baggage claim.',
      eligibleForDelayedReport: true
    };
  }

  // 2. High: Negative buffer and not yet loaded on connecting flight
  if (bufferMinutes < 0 && bagMilestone !== 'LOADED_CONNECTING_FLIGHT') {
    return {
      riskLevel: 'HIGH',
      score: 0.85,
      factors: [
        {
          code: 'SHORT_LAYOVER',
          message: `Layover window of ${connectionMinutes} min is below required transfer time (${effectiveMCT} min).`
        }
      ],
      recommendation: 'Bag transfer expedited by airport handlers. Proceed to gate.',
      eligibleForDelayedReport: false
    };
  }

  // 3. Medium: Buffer under 20 minutes and not yet loaded
  if (bufferMinutes < 20 && bagMilestone !== 'LOADED_CONNECTING_FLIGHT') {
    return {
      riskLevel: 'MEDIUM',
      score: 0.50,
      factors: [
        {
          code: 'TIGHT_CONNECTION',
          message: `Tight connection buffer (${bufferMinutes} min remaining). Transfer is actively monitored.`
        }
      ],
      recommendation: 'Transfer active. Monitor baggage status as boarding approaches.',
      eligibleForDelayedReport: false
    };
  }

  // 4. Low: Sufficient buffer or successfully loaded onto connecting flight
  return {
    riskLevel: 'LOW',
    score: 0.10,
    factors: [],
    recommendation: 'Baggage transfer and handling on schedule.',
    eligibleForDelayedReport: false
  };
}

module.exports = {
  calculateRisk
};
