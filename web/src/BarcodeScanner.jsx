
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import "./BarcodeScanner.css";

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [message, setMessage] = useState(
    "Preparing camera…"
  );

  const detectedRef = useRef(false);
  const callbackRef = useRef(onDetected);

  useEffect(() => {
    callbackRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let controls;
    const reader = new BrowserMultiFormatReader();

    async function startCamera() {
      try {
        const result = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
            },
          },
          videoRef.current,
          (barcode, error) => {
            if (cancelled || detectedRef.current || !barcode) {
              return;
            }

            const value = barcode.getText().trim();

            if (!/^\d{10}$/.test(value)) {
              setMessage(
                "Barcode found, but its value is not a 10-digit bag tag. Try another barcode."
              );
              return;
            }

            detectedRef.current = true;
            setMessage("Bag tag scanned successfully!");

            result.stop();
            callbackRef.current(value);
          }
        );

        controls = result;

        if (cancelled) {
          result.stop();
        } else {
          setMessage(
            "Point your rear camera at the barcode on your bag tag."
          );
        }
      } catch (error) {
        console.error("Camera startup failed:", error);

        if (!cancelled) {
          setMessage(
            "Camera unavailable. Allow camera access and open this app over HTTPS or localhost."
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <section className="scanner-panel">
      <div className="scanner-heading">
        <div>
          <h3>Scan your bag tag</h3>
          <p>Keep the barcode steady and inside the camera view.</p>
        </div>

        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <video
        ref={videoRef}
        className="scanner-video"
        autoPlay
        muted
        playsInline
      />

      <p className="scanner-message" role="status">
        {message}
      </p>

      <small>
        You can also enter the tag number manually.
      </small>
    </section>
  );
}
