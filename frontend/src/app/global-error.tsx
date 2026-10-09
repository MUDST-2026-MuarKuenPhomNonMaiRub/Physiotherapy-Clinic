"use client";

import { useEffect } from "react";

/**
 * The last boundary standing: it replaces the root layout, so it cannot lean on
 * anything the app renders — fonts, theme and shell are all gone by the time
 * this shows. Reached only when the root layout itself throws; everything under
 * the app shell is caught by the boundary beside it instead.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The application failed to render:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>LA BALANCE could not start</p>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            {error.message || "Something went wrong."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
