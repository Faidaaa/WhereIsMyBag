
import { useEffect, useState } from "react";
import "./BaggageTimeline.css";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).replace(/\/$/, "");

const STAGES = [
  { id: "CHECK_IN", label: "Checked in" },
  { id: "SCREENING", label: "Security screening" },
  { id: "SORTING", label: "Sorting facility" },
  { id: "CONTAINER_LOAD", label: "Container loading" },
  { id: "AIRCRAFT_LOAD", label: "Loaded onto aircraft" },
  { id: "TRANSFER", label: "Baggage transfer" },
  { id: "ARRIVED", label: "Arrived at destination" },
  { id: "ON_BELT", label: "On baggage belt" },
  { id: "MISSED_CONNECTION", label: "Missed connection" },
];

function formatTime(timestamp) {
  if (!timestamp) return "Time unavailable";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function eventKey(event) {
  return [
    event.stage,
    event.status,
    event.timestamp,
    event.location || "",
  ].join("|");
}

export default function BaggageTimeline({ tag, token }) {
  const [events, setEvents] = useState([]);
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tag || !token) {
      setEvents([]);
      setConnection("idle");
      setError("Verify your passenger details to view baggage updates.");
      return;
    }

    let active = true;
    let stream;

    setEvents([]);
    setError("");
    setConnection("connecting");

    const url = new URL(
      `${API_BASE}/api/bag/${encodeURIComponent(tag)}/stream`
    );
    url.searchParams.set("token", token);

    try {
      stream = new EventSource(url.toString());

      stream.onopen = () => {
        if (!active) return;
        setConnection("connected");
        setError("");
      };

      const handleBaggageEvent = (message) => {
        if (!active) return;

        try {
          const event = JSON.parse(message.data);

          // Never display internal-only baggage events to passengers.
          if (event.visibility && event.visibility !== "PASSENGER") {
            return;
          }

          if (!event.stage || !event.timestamp) {
            console.warn("Ignoring incomplete baggage event", event);
            return;
          }

          setEvents((previous) => {
            const key = eventKey(event);

            if (previous.some((item) => eventKey(item) === key)) {
              return previous;
            }

            return [...previous, event].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            );
          });
        } catch {
          console.error("Could not parse baggage SSE event.");
        }
      };

      stream.onmessage = handleBaggageEvent;
      stream.addEventListener("baggage-event", handleBaggageEvent);
      stream.addEventListener("connected", () => {
        if (!active) return;
        setConnection("connected");
        setError("");
      });
      stream.addEventListener("stream-complete", () => {
        if (!active) return;
        setConnection("connected");
      });

      stream.onerror = () => {
        if (!active) return;

        // EventSource reconnects automatically when possible.
        setConnection("reconnecting");
        setError("Connection interrupted. Trying to reconnect…");
      };
    } catch {
      setConnection("error");
      setError("Could not start the live baggage connection.");
    }

    return () => {
      active = false;
      stream?.close();
    };
  }, [tag, token]);

  const latestEvent = events[events.length - 1];

  const latestStage = latestEvent
    ? STAGES.find((stage) => stage.id === latestEvent.stage)
    : null;

  return (
    <section className="baggage-timeline">
      <div className="timeline-header">
        <div>
          <p className="timeline-eyebrow">BAGGAGE TRACKING</p>
          <h2>Your bag’s journey</h2>
          <p className="timeline-tag">Tag: {tag || "Not selected"}</p>
        </div>

        <span className={`connection-pill ${connection}`}>
          <span className="connection-dot" />
          {connection === "connected"
            ? "Live"
            : connection === "connecting"
              ? "Connecting"
              : connection === "reconnecting"
                ? "Reconnecting"
                : connection === "idle"
                  ? "Waiting"
                  : "Unavailable"}
        </span>
      </div>

      {error && (
        <p className="timeline-message" role="status">
          {error}
        </p>
      )}

      {!error && events.length === 0 && (
        <div className="timeline-empty">
          <span className="timeline-spinner" />
          <p>Waiting for the first baggage update…</p>
          <small>
            Updates will appear when the server sends baggage events.
          </small>
        </div>
      )}

      {events.length > 0 && (
        <>
          <div className="current-stage">
            <span className="current-stage-label">LATEST UPDATE</span>
            <h3>{latestStage?.label || latestEvent.stage}</h3>
            <p>
              {latestEvent.location || "Location not provided"} ·{" "}
              {formatTime(latestEvent.timestamp)}
            </p>
            {latestEvent.status && (
              <span className="event-status">
                {latestEvent.status.replaceAll("_", " ")}
              </span>
            )}
          </div>

          <div className="timeline-list">
            {events.map((event, index) => {
              const stage = STAGES.find(
                (item) => item.id === event.stage
              );

              const completed = event.status === "COMPLETED";
              const exception = event.status === "EXCEPTION";

              return (
                <article
                  className="timeline-event"
                  key={eventKey(event)}
                >
                  <div className="timeline-rail">
                    <span
                      className={`timeline-marker ${
                        exception ? "exception" : completed ? "completed" : ""
                      }`}
                    >
                      {completed ? "✓" : exception ? "!" : index + 1}
                    </span>

                    {index < events.length - 1 && (
                      <span className="timeline-line" />
                    )}
                  </div>

                  <div className="timeline-event-content">
                    <div className="timeline-event-title">
                      <h4>{stage?.label || event.stage}</h4>
                      <span className="event-status">
                        {(event.status || "PENDING").replaceAll("_", " ")}
                      </span>
                    </div>

                    <p>{event.location || "Location unavailable"}</p>
                    <time>{formatTime(event.timestamp)}</time>

                    {exception && (
                      <p className="event-warning">
                        An exception was reported for this stage.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
