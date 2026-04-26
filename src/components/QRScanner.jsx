import { useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { getMessages, saveMessages } from "../utils/storage";

// 🔑 Content+location key — catches identical alerts across different devices
function getMessageKey(msg) {
  const content = (msg.content || "").trim().toLowerCase();
  const x = msg.location?.x || 0;
  const y = msg.location?.y || 0;
  return `${content}-${x}-${y}`;
}

function QRScanner({ setMessages, onSyncComplete }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("");
  const [scannedData, setScannedData] = useState(null);
  const [mergeResult, setMergeResult] = useState(null);
  const scannerRef = useRef(null);

  // 🔥 Handle a successful QR scan
  function handleScan(decodedText) {
    try {
      if (!decodedText.startsWith("WAYMESH:")) return;

      const clean = decodedText.replace("WAYMESH:", "");
      const data = JSON.parse(clean);

      if (data.type !== "WAYMESH_BUNDLE") return;

      // Store scanned data temporarily
      setScannedData(data);
      setMergeResult(null);
      setStatus(
        "✅ Device bundle scanned — contains " +
          (data.data || []).length +
          " alert(s)"
      );

      // Stop scanner after successful read
      stopScanner();
    } catch (err) {
      console.log("Invalid QR:", err);
    }
  }

  // 🔥 MERGE — content+location dedup (works across different devices)
  function handleMerge() {
    if (!scannedData || !scannedData.data || scannedData.data.length === 0) {
      setStatus("⚠️ No alerts to merge");
      return;
    }

    // Rebuild full message objects from compact QR format
    const incoming = scannedData.data.map((m) => ({
      id: m.id || Date.now().toString() + Math.random().toString(36).substring(2),
      type: "alert",
      content: m.c || "Unknown",
      priority: m.p || 3,
      timestamp: Date.now(),
      ttl: 86400000,
      confidence: 0.5,
      location: { x: m.x || 0, y: m.y || 0 },
      category: m.cat || "other",
      lastShared: Date.now(),
      radius: 2,
    }));

    // Load fresh from storage — single source of truth
    let existing = getMessages() || [];

    // Build key set from EXISTING messages (content + location)
    const existingKeys = new Set(existing.map((m) => getMessageKey(m)));

    let newCount = 0;
    let skippedCount = 0;

    incoming.forEach((msg) => {
      const key = getMessageKey(msg);

      if (!existingKeys.has(key)) {
        // TRULY NEW — different content or location
        existing.push(msg);
        existingKeys.add(key); // prevent intra-batch dupes
        newCount++;
      } else {
        // DUPLICATE — same content + location → boost confidence
        existing = existing.map((m) =>
          getMessageKey(m) === key
            ? {
                ...m,
                confidence: Math.min((m.confidence || 0.5) + 0.1, 1),
                lastShared: Date.now(),
                sharedCount: (m.sharedCount || 0) + 1,
              }
            : m
        );
        skippedCount++;
      }
    });

    // Persist and update UI
    saveMessages(existing);
    setMessages(existing);

    console.log(`Added ${newCount}, skipped ${skippedCount}`);

    // Set merge result for feedback
    setMergeResult({ added: newCount, skipped: skippedCount });
    setScannedData(null);

    // Show appropriate feedback
    if (newCount > 0) {
      setStatus(`📥 Added ${newCount} new alert(s)${skippedCount > 0 ? ` · ${skippedCount} already had` : ""}`);
    } else {
      setStatus("✓ No new alerts — you already have everything");
    }

    // Auto-redirect to dashboard after delay
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (onSyncComplete) onSyncComplete();
    }, 1000);
  }

  // 🔥 Start scanner
  function startScanner() {
    setStatus("Starting camera...");
    setScannedData(null);
    setMergeResult(null);

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    // Delay — critical for iOS Safari camera init
    setTimeout(async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          handleScan
        );
        setScanning(true);
        setStatus("📷 Scanning (back camera)...");
      } catch {
        try {
          await html5QrCode.start(
            { facingMode: "user" },
            config,
            handleScan
          );
          setScanning(true);
          setStatus("📷 Scanning (front camera)...");
        } catch (err) {
          setScanning(false);
          setStatus("❌ Camera error: " + err);
        }
      }
    }, 500);
  }

  // 🔥 Stop scanner safely
  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  const alertCount = scannedData?.data?.length || 0;

  return (
    <div style={{ marginTop: "20px", textAlign: "center" }}>
      {/* Start / Stop button */}
      <button
        onClick={scanning ? stopScanner : startScanner}
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          backgroundColor: scanning ? "#ef4444" : "#22c55e",
          color: "white",
          fontWeight: "bold",
          fontSize: "16px",
          marginBottom: "10px",
        }}
      >
        {scanning ? "⏹ Stop Scanner" : " Start Scanner"}
      </button>

      {/* Status text */}
      {status && (
        <p
          style={{
            fontSize: "14px",
            margin: "8px 0",
            padding: "8px 14px",
            borderRadius: "8px",
            background: mergeResult
              ? mergeResult.added > 0
                ? "rgba(34, 197, 94, 0.12)"
                : "rgba(234, 179, 8, 0.12)"
              : "rgba(255, 255, 255, 0.04)",
            color: mergeResult
              ? mergeResult.added > 0
                ? "#22c55e"
                : "#eab308"
              : "inherit",
            border: mergeResult
              ? `1px solid ${mergeResult.added > 0 ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.2)"}`
              : "1px solid transparent",
          }}
        >
          {status}
        </p>
      )}

      {/* Fixed-size scanner container */}
      <div
        id="reader"
        style={{
          width: "300px",
          height: "300px",
          margin: "10px auto",
          overflow: "hidden",
          position: "relative",
          borderRadius: "12px",
          background: scanning ? "black" : "#1e293b",
        }}
      ></div>

      {/* 🔥 Merge card — shown after valid scan */}
      {scannedData && (
        <div
          style={{
            marginTop: "15px",
            padding: "20px",
            background: "#1e293b",
            borderRadius: "12px",
            border: "1px solid #334155",
            maxWidth: "340px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <h3 style={{ margin: "0 0 5px", fontSize: "18px" }}>
            📱 Device Bundle Detected
          </h3>
          <p style={{ margin: "0 0 15px", fontSize: "14px", opacity: 0.7 }}>
            Contains {alertCount} alert{alertCount !== 1 ? "s" : ""} from
            another device
          </p>

          {/* Merge button */}
          <button
            onClick={handleMerge}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              backgroundColor: "#3b82f6",
              color: "white",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            📥 Merge Alerts ({alertCount})
          </button>
        </div>
      )}
    </div>
  );
}

export default QRScanner;