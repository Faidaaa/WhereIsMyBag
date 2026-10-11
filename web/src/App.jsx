import { useState, useRef } from "react";
import { verifyBag } from "./lib/api";
import BarcodeScanner from "./BarcodeScanner";
import BaggageTimeline from "./BaggageTimeline";
import MissingBagReport from "./MissingBagReport";
import heroImage from "./assets/hero_carousel_cinematic.jpg";
import "./index.css";

const DEMO_SCENARIOS = [
  {
    title: "Scenario 1: Happy Path",
    tag: "0055123456",
    surname: "OKAFOR",
    pnr: "NBFX01",
    badge: "HAPPY PATH"
  },
  {
    title: "Scenario 2: Tight Layover",
    tag: "0055123457",
    surname: "LINDQVIST",
    pnr: "NBFX02",
    badge: "TIGHT CONNECTION"
  },
  {
    title: "Scenario 3: Missed Connection",
    tag: "0055123458",
    surname: "FERREIRA",
    pnr: "NBFX03",
    badge: "MISSED CONNECTION"
  },
  {
    title: "Scenario 4: Standard Demo",
    tag: "0123456789",
    surname: "SMITH",
    pnr: "WIMB01",
    badge: "DEFAULT DEMO"
  }
];

export default function App() {
  const [tag, setTag] = useState("");
  const [surname, setSurname] = useState("");
  const [pnr, setPnr] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const tagInputRef = useRef(null);

  async function performVerification(tagVal, surnameVal, pnrVal) {
    setError("");
    const cleanTag = tagVal.trim();
    const cleanSurname = surnameVal.trim();
    const cleanPnr = pnrVal.trim().toUpperCase();

    if (!/^\d{10}$/.test(cleanTag)) {
      setError("Enter exactly 10 numeric digits for the demo tag number.");
      return;
    }

    if (!cleanSurname || !cleanPnr) {
      setError("Enter your passenger surname and booking reference (PNR).");
      return;
    }

    setLoading(true);

    try {
      const result = await verifyBag({
        tag: cleanTag,
        surname: cleanSurname,
        pnr: cleanPnr,
      });

      setVerified({ ...result, tag: cleanTag });

      // Scroll smoothly to timeline
      setTimeout(() => {
        const timelineEl = document.getElementById("timeline-results-section");
        if (timelineEl) {
          timelineEl.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);

    } catch (err) {
      setVerified(null);
      setError(err.message || "Verification failed. Please check surname and PNR.");
    } finally {
      setLoading(false);
    }
  }

  function handleVerifySubmit(event) {
    event.preventDefault();
    performVerification(tag, surname, pnr);
  }

  function handleSelectScenario(sc) {
    setTag(sc.tag);
    setSurname(sc.surname);
    setPnr(sc.pnr);
    performVerification(sc.tag, sc.surname, sc.pnr);
  }

  function handleScannedTag(scannedTag) {
    setTag(scannedTag);
    setVerified(null);
    setError("");
    setShowScanner(false);
  }

  function scrollToTracking() {
    const el = document.getElementById("tracking-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }
  }

  function handleWatchDemo() {
    handleSelectScenario(DEMO_SCENARIOS[0]);
  }

  return (
    <div className="app-container">
      {/* 1. Header Navigation */}
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="logo-link">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 20h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="12" x2="14" y2="12"></line>
              </svg>
            </div>
            <span>
              <span className="logo-text-white">Where is my </span>
              <span className="logo-text-cyan">Bag</span>
            </span>
          </a>

          <nav className="nav-menu">
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#about" className="nav-link">About</a>
            <button className="nav-btn" onClick={scrollToTracking}>
              Track My Bag
            </button>
          </nav>
        </div>
      </header>

      {/* 2. Cinematic Hero Section */}
      <section className="hero-section">
        <img
          src={heroImage}
          alt="Airport baggage carousel"
          className="hero-bg-media"
        />
        <div className="hero-overlay" />

        <div className="hero-inner">
          <div className="hero-content">
            <span className="hero-eyebrow">SMARTER BAGGAGE TRACKING</span>
            <h1 className="hero-headline">
              Your Bag’s Journey. <br />
              <span className="cyan-highlight">Tracked.</span>
            </h1>
            <p className="hero-subtext">
              Know where your baggage is and follow its journey with simulated real-time tracking updates.
            </p>

            <div className="hero-actions">
              <button className="btn-primary" onClick={scrollToTracking}>
                Track My Bag
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>

              <button className="btn-secondary" onClick={handleWatchDemo}>
                <span className="play-icon-circle">▶</span>
                Watch Demo
              </button>
            </div>
          </div>

          {/* Luggage Tag Barcode Graphic Overlay */}
          <div className="hero-graphic">
            <div className="luggage-tag-overlay">
              <div className="tag-header">
                <span className="tag-airline">NIMBUS AIRWAYS</span>
                <span className="tag-flight">NB 201</span>
              </div>
              <div className="tag-route">LHR ➔ JFK</div>
              <div className="tag-barcode">
                <svg className="barcode-svg" viewBox="0 0 200 40">
                  <rect x="10" y="0" width="3" height="40" fill="#000"/>
                  <rect x="16" y="0" width="1" height="40" fill="#000"/>
                  <rect x="20" y="0" width="4" height="40" fill="#000"/>
                  <rect x="27" y="0" width="2" height="40" fill="#000"/>
                  <rect x="32" y="0" width="5" height="40" fill="#000"/>
                  <rect x="40" y="0" width="2" height="40" fill="#000"/>
                  <rect x="45" y="0" width="3" height="40" fill="#000"/>
                  <rect x="52" y="0" width="1" height="40" fill="#000"/>
                  <rect x="56" y="0" width="6" height="40" fill="#000"/>
                  <rect x="65" y="0" width="2" height="40" fill="#000"/>
                  <rect x="70" y="0" width="4" height="40" fill="#000"/>
                  <rect x="77" y="0" width="2" height="40" fill="#000"/>
                  <rect x="82" y="0" width="5" height="40" fill="#000"/>
                  <rect x="90" y="0" width="2" height="40" fill="#000"/>
                  <rect x="95" y="0" width="3" height="40" fill="#000"/>
                  <rect x="102" y="0" width="1" height="40" fill="#000"/>
                  <rect x="106" y="0" width="5" height="40" fill="#000"/>
                  <rect x="115" y="0" width="2" height="40" fill="#000"/>
                  <rect x="120" y="0" width="4" height="40" fill="#000"/>
                  <rect x="127" y="0" width="2" height="40" fill="#000"/>
                  <rect x="132" y="0" width="5" height="40" fill="#000"/>
                  <rect x="140" y="0" width="3" height="40" fill="#000"/>
                  <rect x="146" y="0" width="2" height="40" fill="#000"/>
                  <rect x="152" y="0" width="4" height="40" fill="#000"/>
                  <rect x="160" y="0" width="1" height="40" fill="#000"/>
                  <rect x="165" y="0" width="5" height="40" fill="#000"/>
                  <rect x="173" y="0" width="2" height="40" fill="#000"/>
                  <rect x="180" y="0" width="4" height="40" fill="#000"/>
                </svg>
                <div className="tag-number-text">{tag || "0055123456"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-header">
          <span className="section-eyebrow">SIMPLE STEPS</span>
          <h2 className="section-title">How It Works.</h2>
          <p className="section-subtext">Get your bag’s journey in 3 simple steps.</p>
        </div>

        <div className="steps-grid">
          {/* Step 1 */}
          <div className="step-card">
            <div className="step-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                <line x1="7" y1="8" x2="7" y2="16"></line>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="17" y1="8" x2="17" y2="16"></line>
              </svg>
              <span className="step-badge">1</span>
            </div>
            <h3 className="step-title">Scan or Enter Tag</h3>
            <p className="step-desc">Scan your baggage tag barcode or enter the 10-digit tag number.</p>
          </div>

          <div className="step-arrow">➔</div>

          {/* Step 2 */}
          <div className="step-card">
            <div className="step-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="step-badge">2</span>
            </div>
            <h3 className="step-title">Verify Your Details</h3>
            <p className="step-desc">Confirm your surname and PNR to keep your information secure.</p>
          </div>

          <div className="step-arrow">➔</div>

          {/* Step 3 */}
          <div className="step-card">
            <div className="step-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span className="step-badge">3</span>
            </div>
            <h3 className="step-title">Track Your Bag</h3>
            <p className="step-desc">Follow your bag’s progress through the available tracking updates.</p>
          </div>
        </div>

        {/* Demo Disclaimer */}
        <div className="demo-disclaimer-wrapper">
          <div className="demo-disclaimer">
            <span className="disclaimer-icon">🛡️</span>
            <span>This is a demo. We use simulated baggage data for this demonstration.</span>
          </div>
        </div>
      </section>

      {/* 4. Tracking Section */}
      <main className="main-content" id="tracking-section">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Track Your Baggage</h2>
            <p className="panel-desc">Enter your 10-digit bag tag and passenger credentials to start tracking.</p>
          </div>

          {/* Scenario Chips for Quick Demo Loading */}
          <div className="scenarios-chips">
            <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center" }}>Quick Demos:</span>
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.tag}
                type="button"
                className={`chip-btn ${tag === sc.tag ? "active" : ""}`}
                onClick={() => handleSelectScenario(sc)}
              >
                {sc.title} ({sc.surname})
              </button>
            ))}
          </div>

          <form onSubmit={handleVerifySubmit}>
            <button
              type="button"
              className="scan-camera-btn"
              onClick={() => {
                setError("");
                setShowScanner(true);
              }}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Scan Bag Tag Barcode with Camera
            </button>

            {showScanner && (
              <BarcodeScanner
                onDetected={handleScannedTag}
                onClose={() => setShowScanner(false)}
              />
            )}

            <div className="form-group">
              <label htmlFor="tag">10-Digit Bag Tag Number</label>
              <input
                id="tag"
                ref={tagInputRef}
                className="dark-input"
                value={tag}
                onChange={(event) => {
                  setTag(event.target.value.replace(/\D/g, "").slice(0, 10));
                  setVerified(null);
                  setError("");
                }}
                placeholder="e.g. 0055123456"
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="surname">Passenger Surname</label>
              <input
                id="surname"
                className="dark-input"
                value={surname}
                onChange={(event) => setSurname(event.target.value)}
                placeholder="e.g. OKAFOR"
                autoComplete="family-name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="pnr">Booking Reference (PNR)</label>
              <input
                id="pnr"
                className="dark-input"
                value={pnr}
                onChange={(event) => setPnr(event.target.value.toUpperCase())}
                placeholder="e.g. NBFX01"
                autoComplete="off"
                required
              />
            </div>

            {error && (
              <div className="error-banner" role="alert">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="form-submit-btn" disabled={loading}>
              {loading ? "Verifying Credentials..." : "Track My Bag →"}
            </button>
          </form>
        </section>

        {/* 5. Verified Baggage Tracking Results */}
        {verified && (
          <div id="timeline-results-section">
            <div className="verification-success-banner">
              <div className="success-icon-badge">✓</div>
              <div className="success-info">
                <h3>Passenger Verification Successful</h3>
                <p>Bag Tag: <strong>{verified.tag}</strong> · Verified for passenger {surname.toUpperCase()}</p>
              </div>
            </div>

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
                surname={surname}
                pnr={pnr}
              />
            </section>
          </div>
        )}
      </main>

      {/* 6. About Section */}
      <section id="about" className="about-section">
        <div className="about-inner">
          <div className="section-header">
            <span className="section-eyebrow">ABOUT THE PLATFORM</span>
            <h2 className="section-title">WhereIsMyBag Architecture</h2>
            <p className="section-subtext">
              Demonstrating automated IATA baggage event handling and real-time Server-Sent Events (SSE) tracking.
            </p>
          </div>

          <div className="about-grid">
            <div className="about-card">
              <h3>IATA BSM Integration</h3>
              <p>Simulates Baggage Source Messages (BSM), BSI, and BSN streams generated across check-in, sorting, screening, and aircraft loading gates.</p>
            </div>
            <div className="about-card">
              <h3>Tag-Scoped Tokens</h3>
              <p>Issues short-lived HMAC-SHA256 access tokens scoped exclusively to verified baggage tags for secure end-to-end data privacy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <span>WhereIsMyBag © 2026 · Fictional Hackathon Prototype</span>
          </div>
          <div className="status-badge">
            <span className="status-dot"></span>
            Simulator API Operational
          </div>
        </div>
      </footer>
    </div>
  );
}
