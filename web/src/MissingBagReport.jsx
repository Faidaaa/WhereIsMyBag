
import { useState } from "react";
import { submitReport } from "./lib/api";

export default function MissingBagReport({ tag, token, surname = "SMITH", pnr = "WIMB01" }) {
  const [description, setDescription] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("123 Terminal Way, Suite 100");
  const [contactPhone, setContactPhone] = useState("+1 (555) 019-2834");
  const [contactEmail, setContactEmail] = useState("passenger@example.com");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reportRef, setReportRef] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!description.trim()) {
      setError("Please describe the missing-baggage issue.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await submitReport(
        {
          tagNumber: tag,
          tag,
          pnr,
          passengerSurname: surname,
          deliveryAddress: deliveryAddress.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          bagDescription: description.trim(),
          description: description.trim(),
        },
        token
      );

      const refNum = response.data?.referenceNumber || response.referenceNumber || "Submitted";
      setReportRef(refNum);
      setSubmitted(true);
    } catch (err) {
      setError(
        err.message || "Your report could not be submitted. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="panel report-success" role="status">
        <h2>✓ Your delayed baggage report has been logged</h2>
        {reportRef && <p className="report-ref">Reference: <strong>{reportRef}</strong></p>}
        <p>
          Baggage services will arrange delivery once your bag arrives at the destination.
        </p>
      </section>
    );
  }

  return (
    <section className="panel missing-report">
      <h2>Need help with your bag?</h2>
      <p>
        If your baggage hasn't arrived, submit a delayed baggage
        report to baggage services.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="missing-bag-tag">Bag tag</label>
        <input
          id="missing-bag-tag"
          value={tag}
          readOnly
        />

        <label htmlFor="delivery-address">Delivery Address</label>
        <input
          id="delivery-address"
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          placeholder="456 Sunset Blvd, Los Angeles, CA 90028"
          required
        />

        <label htmlFor="contact-phone">Contact Phone</label>
        <input
          id="contact-phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+1 (555) 019-2834"
          required
        />

        <label htmlFor="contact-email">Contact Email</label>
        <input
          id="contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="passenger@example.com"
          required
        />

        <label htmlFor="missing-description">
          Bag & Issue Description
        </label>
        <textarea
          id="missing-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setError("");
          }}
          placeholder="Navy blue soft-sided Samsonite upright suitcase with red identifier strap"
          rows={4}
          maxLength={1000}
          required
        />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting report..." : "Report Missing Baggage"}
        </button>
      </form>
    </section>
  );
}
