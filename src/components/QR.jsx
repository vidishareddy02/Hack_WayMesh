import { QRCodeCanvas } from "qrcode.react";
import { getMessages } from "../utils/storage";

// ── Privacy Filter Helpers ──

function isWithinRadius(alert, user, radius = 3) {
  const dx = (alert.location?.x || 0) - user.x;
  const dy = (alert.location?.y || 0) - user.y;
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

function isRecent(alert, maxAgeMs = 60 * 60 * 1000) {
  if (!alert.timestamp) return true; // include if no timestamp
  return Date.now() - alert.timestamp <= maxAgeMs;
}

function isImportant(alert) {
  return (alert.priority || 0) >= 3;
}

function QR({ userLocation = { x: 3, y: 3 }, emergencyMode = false }) {
  const allMessages = getMessages() || [];

  // Apply privacy filter pipeline (or bypass in emergency)
  const filtered = emergencyMode
    ? allMessages
    : allMessages
        .filter((m) => isWithinRadius(m, userLocation, 3))
        .filter((m) => isRecent(m))
        .filter((m) => isImportant(m));

  // Compact format — short keys for QR density
  const compactMessages = filtered.map((m) => ({
    id: m.id,
    c: m.content,
    p: m.priority,
    x: m.location?.x || 0,
    y: m.location?.y || 0,
    cat: m.category || "other",
  }));

  const qrPayload = {
    type: "WAYMESH_BUNDLE",
    data: compactMessages,
  };

  const qrValue = "WAYMESH:" + JSON.stringify(qrPayload);

  return (
    <div
      style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        display: "inline-block",
      }}
    >
      <h3 style={{ color: "black", margin: "0 0 10px" }}>
        📤 Share Your Alerts (QR)
      </h3>
      <QRCodeCanvas
        value={qrValue}
        size={300}
        level="L"
        includeMargin={true}
      />
      <p style={{ color: "#666", fontSize: "12px", margin: "8px 0 0" }}>
        {filtered.length} of {allMessages.length} alert{allMessages.length !== 1 ? "s" : ""} in bundle
      </p>
      {/* Privacy indicator */}
      <p
        style={{
          margin: "6px 0 0",
          fontSize: "11px",
          padding: "4px 10px",
          borderRadius: "6px",
          background: emergencyMode ? "#fef2f2" : "#f0fdf4",
          color: emergencyMode ? "#dc2626" : "#16a34a",
          fontWeight: 600,
        }}
      >
        {emergencyMode
          ? "🚨 Emergency Mode: Sharing ALL Alerts"
          : "🔒 Sharing: Nearby + Recent + Priority ≥3 Only"}
      </p>
    </div>
  );
}

export default QR;