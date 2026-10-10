/**
 * Abstract BaggageAdapter Interface
 * Reference: CONTRACT.md Section 10.1
 */

class BaggageAdapter {
  /**
   * Verify passenger identity for bag tracking.
   * @param {Object} params
   * @param {string} params.tagNumber
   * @param {string} params.surname
   * @param {string} params.pnr
   */
  async verifyPassenger({ tagNumber, surname, pnr }) {
    throw new Error('Method verifyPassenger() must be implemented.');
  }

  /**
   * Retrieve bag details for a tag number.
   * @param {string} tagNumber
   */
  async getBagDetails(tagNumber) {
    throw new Error('Method getBagDetails() must be implemented.');
  }

  /**
   * Retrieve full passenger-visible baggage timeline.
   * @param {string} tagNumber
   */
  async getTimeline(tagNumber) {
    throw new Error('Method getTimeline() must be implemented.');
  }

  /**
   * Calculate current risk assessment for the baggage journey.
   * @param {string} tagNumber
   */
  async calculateRisk(tagNumber) {
    throw new Error('Method calculateRisk() must be implemented.');
  }

  /**
   * Subscribe to real-time events for this baggage.
   * @param {string} tagNumber
   * @param {Function} onEventCallback
   * @param {string} [lastEventId] - Optional resumption event ID
   * @returns {Function} unsubscribe function
   */
  subscribeToUpdates(tagNumber, onEventCallback, lastEventId) {
    throw new Error('Method subscribeToUpdates() must be implemented.');
  }

  /**
   * Submit a delayed baggage claim report.
   * @param {Object} reportData
   */
  async submitDelayedReport(reportData) {
    throw new Error('Method submitDelayedReport() must be implemented.');
  }
}

module.exports = BaggageAdapter;
