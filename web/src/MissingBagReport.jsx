
import { useState } from "react";
import { submitReport } from "./lib/api";

export default function MissingBagReport({ tag, token }) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!description.trim()) {
      setError("Please describe the missing-baggage issue.");
      return;
    }

    setSubmitting(true);

    try {
      await submitReport(
        {
          tag,
          type: "MISSING_BAGGAGE",
          description: description.trim(),
        },
        token
      );

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
        <h2>✓ Your report has been logged.</h2>
        <p>
          Baggage services will take the necessary actions as early as
          possible and let you know.
        </p>
      </section>
    );
  }

  return (
    <section className="panel missing-report">
      <h2>Need help with your bag?</h2>
      <p>
        If your baggage hasn't arrived, submit a missing-baggage
        report to baggage services.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="missing-bag-tag">Bag tag</label>
        <input
          id="missing-bag-tag"
          value={tag}
          readOnly
        />

        <label htmlFor="missing-description">
          Describe your issue
        </label>
        <textarea
          id="missing-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setError("");
          }}
          placeholder="My bag has not arrived at the baggage carousel..."
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
