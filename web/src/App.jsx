
import { useState } from "react";
import { verifyBag } from "./lib/api";
import BarcodeScanner from "./BarcodeScanner";
import BaggageTimeline from "./BaggageTimeline";
import "./index.css";
import MissingBagReport from "./MissingBagReport";
export default function App() {
  const [tag, setTag] = useState("");
  const [surname, setSurname] = useState("");
  const [pnr, setPnr] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  async function handleVerify(event) {
    event.preventDefault();
    setError("");

    if (!/^\d{10}$/.test(tag)) {
      setError("Enter exactly 10 digits for the demo tag.");
      return;
    }

    if (!surname.trim() || !pnr.trim()) {
      setError("Enter your surname and booking reference.");
      return;
    }

    setLoading(true);

    try {
      const result = await verifyBag({
        tag,
        surname: surname.trim(),
        pnr: pnr.trim().toUpperCase(),
      });

      setVerified({ ...result, tag });
    } catch (err) {
      setVerified(null);
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleScannedTag(scannedTag) {
    setTag(scannedTag);
    setVerified(null);
    setError("");
    setShowScanner(false);
  }

  return (
    <main className="app">
      <header className="header">
        <h1>WhereIsMyBag</h1>
        <p>Your baggage journey, in one place.</p>
      </header>

      <section className="panel">
        <h2>Track your baggage</h2>
        <p>Enter your bag tag and booking details to continue.</p>

        <form onSubmit={handleVerify}>
          <button
            type="button"
            onClick={() => {
              setError("");
              setShowScanner(true);
            }}
            disabled={loading}
          >
            Scan Bag Tag with Camera
          </button>

          {showScanner && (
            <BarcodeScanner
              onDetected={handleScannedTag}
              onClose={() => setShowScanner(false)}
            />
          )}

          <label htmlFor="tag">10-digit bag tag</label>
          <input
            id="tag"
            value={tag}
            onChange={(event) => {
              setTag(
                event.target.value.replace(/\D/g, "").slice(0, 10)
              );
              setVerified(null);
              setError("");
            }}
            placeholder="0055123456"
            inputMode="numeric"
            autoComplete="off"
            required
          />

          <label htmlFor="surname">Passenger surname</label>
          <input
            id="surname"
            value={surname}
            onChange={(event) => setSurname(event.target.value)}
            placeholder="Enter surname"
            autoComplete="family-name"
            required
          />

          <label htmlFor="pnr">Booking reference (PNR)</label>
          <input
            id="pnr"
            value={pnr}
            onChange={(event) => setPnr(event.target.value)}
            placeholder="AB12CD"
            autoComplete="off"
            required
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Track My Bag"}
          </button>
        </form>
      </section>

      {verified && (
        <>
          <section className="panel success">
            <h2>Verification successful</h2>
            <p>Bag tag: {verified.tag}</p>
            <p>Your booking details have been verified.</p>
          </section>

          <section className="panel">
            <BaggageTimeline
              tag={verified.tag}
              token={verified.token}
            />
          </section>
          <section className="panel">
  <MissingBagReport
    tag={verified.tag}
    token={verified.token}
  />
</section>
        </>
      )}
    </main>
  );
}
