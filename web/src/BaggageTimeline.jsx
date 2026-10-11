
import { useEffect, useState } from "react";
import "./BaggageTimeline.css";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : "")
).replace(/\/$/, "");

const STAGES = [
  { id: "CHECKED_IN", label: "Checked in" },
  { id: "CHECK_IN", label: "Checked in" },
  { id: "SECURITY_SCREENED", label: "Security screening" },
  { id: "SECURITY", label: "Security screening" },
  { id: "SORTED_TO_CONTAINER", label: "Sorting facility" },
  { id: "SORTING", label: "Sorting facility" },
  { id: "LOADED_AIRCRAFT", label: "Loaded onto aircraft" },
  { id: "AIRCRAFT_LOAD", label: "Loaded onto aircraft" },
  { id: "CONTAINER_LOAD", label: "Container loading" },
  { id: "UNLOADED_AIRCRAFT", label: "Arrived at destination" },
  { id: "ARRIVED", label: "Arrived at destination" },
  { id: "ON_CAROUSEL", label: "On baggage belt" },
  { id: "ON_BELT", label: "On baggage belt" },
  { id: "CLAIMED", label: "Baggage claimed" },
  { id: "TRANSFER_TIGHT_CONNECTION", label: "Baggage transfer in progress" },
  { id: "LOADED_CONNECTING_FLIGHT", label: "Loaded onto connecting flight" },
  { id: "TRANSFER", label: "Baggage transfer" },
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

function normalizeEvent(evt) {
  if (!evt) return null;
  const stageId = evt.step || evt.stage || evt.category || "UNKNOWN";
  return {
    ...evt,
    stage: stageId,
    timestamp: evt.timestamp || new Date().toISOString()
  };
}

function eventKey(event) {
  const stageVal = event.step || event.stage || event.category || "EVENT";
  return [
    stageVal,
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

    // 1. Instantly fetch initial REST timeline snapshot
    fetch(`${API_BASE}/api/bags/${encodeURIComponent(tag)}/timeline`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && data.data && Array.isArray(data.data.timeline)) {
          const parsedList = data.data.timeline
            .map(normalizeEvent)
            .filter((e) => e && (!e.visibility || e.visibility === "PASSENGER"));
          if (parsedList.length > 0) {
            setEvents((previous) => {
              const map = new Map();
              previous.concat(parsedList).forEach((item) => {
                map.set(eventKey(item), item);
              });
              return Array.from(map.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            });
          }
        }
      })
      .catch(() => {});

    // 2. Open live SSE stream for real-time updates
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
          const raw = JSON.parse(message.data);

          // Never display internal-only baggage events to passengers.
          if (raw.visibility && raw.visibility !== "PASSENGER") {
            return;
          }

          const event = normalizeEvent(raw);

          if (!event || !event.timestamp) {
            console.warn("Ignoring incomplete baggage event", raw);
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
