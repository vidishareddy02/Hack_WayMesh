import { useState, useRef, useCallback, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { getMessages, addMessage, saveMessages } from "../utils/storage";
import { sendMessage } from "../utils/transfer";

// ── ICE config — STUN required for cross-device connectivity ──
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ── Connection timeout (ms) ──
const CONNECT_TIMEOUT = 15000;

// ── Status constants ──
const STATUS = {
  DISCONNECTED: "Disconnected",
  GATHERING: "Gathering ICE…",
  OFFER_READY: "Offer Ready",
  ANSWER_READY: "Answer Ready",
  CONNECTING: "Connecting…",
  CONNECTED: "Connected ✅",
  TIMEOUT: "Connection timeout ❌",
  FAILED: "Connection failed ❌",
  ERROR: "Error ❌",
};

function WebRTCSync({ setMessages, onClose }) {
  // ── State ──
  const [status, setStatus] = useState(STATUS.DISCONNECTED);
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [remoteOffer, setRemoteOffer] = useState("");
  const [remoteAnswer, setRemoteAnswer] = useState("");
  const [syncLog, setSyncLog] = useState([]);
  const [copied, setCopied] = useState("");
  const [activeTab, setActiveTab] = useState("create"); // create | join | complete

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const timeoutRef = useRef(null);

  // ── Logging helper ──
  const log = useCallback((msg) => {
    setSyncLog((prev) => [...prev.slice(-29), { text: msg, time: Date.now() }]);
    console.log("[WebRTCSync]", msg);
  }, []);

  // ── Clear connection timeout ──
  const clearConnectTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ── Start connection timeout ──
  const startConnectTimeout = useCallback(() => {
    clearConnectTimeout();
    timeoutRef.current = setTimeout(() => {
      const pc = pcRef.current;
      if (pc && pc.connectionState !== "connected") {
        setStatus(STATUS.TIMEOUT);
        log("⏰ Connection timeout — peer did not respond in time");
      }
    }, CONNECT_TIMEOUT);
  }, [clearConnectTimeout, log]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      clearConnectTimeout();
      try {
        channelRef.current?.close();
        pcRef.current?.close();
      } catch (_) { /* ignore */ }
    };
  }, [clearConnectTimeout]);

  // ── Copy to clipboard ──
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    }
  };

  // ═══════════════════════════════════════════
  // ATTACH CONNECTION STATE LISTENERS
  // ═══════════════════════════════════════════
  const attachPeerListeners = useCallback((pc) => {
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("ICE State:", state);
      log(`🧊 ICE: ${state}`);

      if (state === "connected" || state === "completed") {
        clearConnectTimeout();
        setStatus(STATUS.CONNECTED);
      } else if (state === "failed") {
        clearConnectTimeout();
        setStatus(STATUS.FAILED);
        log("❌ ICE connection failed");
      } else if (state === "disconnected") {
        log("⚠️ ICE disconnected — may reconnect…");
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("Connection State:", state);
      log(`🔗 Peer: ${state}`);

      if (state === "connected") {
        clearConnectTimeout();
        setStatus(STATUS.CONNECTED);
      } else if (state === "failed") {
        clearConnectTimeout();
        setStatus(STATUS.FAILED);
        log("❌ Peer connection failed");
      } else if (state === "disconnected") {
        setStatus(STATUS.DISCONNECTED);
        log("🔌 Peer disconnected");
      }
    };

    pc.onsignalingstatechange = () => {
      console.log("Signaling State:", pc.signalingState);
    };
  }, [clearConnectTimeout, log]);

  // ═══════════════════════════════════════════
  // WAIT FOR ICE GATHERING TO COMPLETE
  // ═══════════════════════════════════════════
  const waitForIceGathering = useCallback((pc) => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        // Resolve when gathering completes
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          }
        };
        pc.onicegatheringstatechange = checkState;
        // Also listen for individual candidates — resolve when null (end)
        pc.onicecandidate = (event) => {
          if (event.candidate === null) {
            resolve();
          }
        };
        // Hard timeout fallback (10s)
        setTimeout(resolve, 10000);
      }
    });
  }, []);

  // ═══════════════════════════════════════════
  // DATA CHANNEL SETUP
  // ═══════════════════════════════════════════
  const setupChannel = useCallback((channel) => {
    channel.onopen = () => {
      clearConnectTimeout();
      setStatus(STATUS.CONNECTED);
      log("✅ DataChannel open — syncing…");

      // Send local message IDs
      try {
        const msgs = getMessages() || [];
        const ids = msgs.map((m) => m.id);
        channel.send(JSON.stringify({ type: "IDS", ids }));
        log(`📤 Sent ${ids.length} message ID(s)`);
      } catch (err) {
        log("⚠️ Failed to send IDs: " + err.message);
      }
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "IDS") {
          log(`📥 Received ${data.ids?.length || 0} remote ID(s)`);
          const local = getMessages() || [];
          const remoteIdSet = new Set(data.ids || []);

          // Find messages the remote doesn't have
          const missing = local.filter((m) => !remoteIdSet.has(m.id));
          if (missing.length > 0) {
            channel.send(JSON.stringify({ type: "WAYMESH_SYNC", messages: missing }));
            log(`📤 Sent ${missing.length} missing message(s)`);
          } else {
            log("✓ Remote has all our messages");
          }
        }

        if (data.type === "WAYMESH_SYNC") {
          log(`📥 Received ${data.messages?.length || 0} message(s)`);
          let updated = getMessages() || [];
          let added = 0;

          (data.messages || []).forEach((msg) => {
            // Prevent duplicates
            const exists = updated.some((m) => m.id === msg.id);
            if (!exists) {
              updated = sendMessage(msg, updated);
              added++;
            }
          });

          if (added > 0) {
            saveMessages(updated);
            setMessages(updated);
            log(`✅ Added ${added} new message(s)`);
          } else {
            log("✓ No new messages to add");
          }
        }
      } catch (err) {
        log("⚠️ Invalid data received");
      }
    };

    channel.onclose = () => {
      log("🔌 DataChannel closed");
      setStatus(STATUS.DISCONNECTED);
    };

    channel.onerror = (e) => {
      console.error("Channel error", e);
      log("❌ DataChannel error");
      setStatus(STATUS.FAILED);
    };
  }, [clearConnectTimeout, log, setMessages]);

  // ═══════════════════════════════════════════
  // DEVICE A — CREATE OFFER
  // ═══════════════════════════════════════════
  const createOffer = async () => {
    try {
      // Cleanup previous connection
      clearConnectTimeout();
      try { channelRef.current?.close(); } catch (_) {}
      try { pcRef.current?.close(); } catch (_) {}

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      attachPeerListeners(pc);

      // Create data channel (Device A creates it)
      const channel = pc.createDataChannel("waymesh");
      channelRef.current = channel;
      setupChannel(channel);

      setStatus(STATUS.GATHERING);
      log("⏳ Creating offer & gathering ICE candidates…");

      const offerDesc = await pc.createOffer();
      await pc.setLocalDescription(offerDesc);

      // Wait for ALL ICE candidates to be gathered
      await waitForIceGathering(pc);

      // Export the FULL local description (SDP + all ICE candidates)
      const fullOffer = JSON.stringify(pc.localDescription);
      setOffer(fullOffer);
      setStatus(STATUS.OFFER_READY);
      log("📋 Offer ready (with ICE) — share with Device B");
      setActiveTab("create");
    } catch (err) {
      setStatus(STATUS.ERROR);
      log("❌ Offer failed: " + err.message);
    }
  };

  // ═══════════════════════════════════════════
  // DEVICE B — JOIN WITH OFFER → CREATE ANSWER
  // ═══════════════════════════════════════════
  const createAnswer = async () => {
    try {
      if (!remoteOffer.trim()) {
        log("⚠️ Paste the offer first");
        return;
      }

      // Cleanup previous connection
      clearConnectTimeout();
      try { channelRef.current?.close(); } catch (_) {}
      try { pcRef.current?.close(); } catch (_) {}

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      attachPeerListeners(pc);

      // Device B listens for data channel
      pc.ondatachannel = (event) => {
        const ch = event.channel;
        channelRef.current = ch;
        setupChannel(ch);
        log("📡 DataChannel received from Device A");
      };

      setStatus(STATUS.GATHERING);
      log("⏳ Processing offer & generating answer…");

      const offerDesc = JSON.parse(remoteOffer);
      await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);

      // Wait for ALL ICE candidates to be gathered
      await waitForIceGathering(pc);

      // Export the FULL local description (SDP + all ICE candidates)
      const fullAnswer = JSON.stringify(pc.localDescription);
      setAnswer(fullAnswer);
      setStatus(STATUS.ANSWER_READY);
      log("📋 Answer ready (with ICE) — share with Device A");
    } catch (err) {
      setStatus(STATUS.ERROR);
      log("❌ Answer failed: " + err.message);
    }
  };

  // ═══════════════════════════════════════════
  // DEVICE A — COMPLETE CONNECTION
  // ═══════════════════════════════════════════
  const completeConnection = async () => {
    try {
      if (!remoteAnswer.trim()) {
        log("⚠️ Paste the answer first");
        return;
      }

      const pc = pcRef.current;
      if (!pc) {
        log("⚠️ Create an offer first");
        return;
      }

      // Guard: prevent duplicate or wrong-state calls
      if (pc.signalingState !== "have-local-offer") {
        log(`⚠️ Wrong signaling state: ${pc.signalingState} (expected have-local-offer)`);
        return;
      }

      setStatus(STATUS.CONNECTING);
      log("⏳ Completing connection…");

      // Start timeout countdown
      startConnectTimeout();

      const answerDesc = JSON.parse(remoteAnswer);
      await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));

      log("🔗 Remote description set — waiting for DataChannel to open…");
    } catch (err) {
      clearConnectTimeout();
      setStatus(STATUS.ERROR);
      log("❌ Connection failed: " + err.message);
    }
  };

  // ═══════════════════════════════════════════
  // STATUS INDICATOR
  // ═══════════════════════════════════════════
  const statusColor =
    status === STATUS.CONNECTED ? "#22c55e" :
    status === STATUS.ERROR || status === STATUS.FAILED || status === STATUS.TIMEOUT ? "#ef4444" :
    status.includes("…") ? "#f59e0b" :
    status.includes("Ready") ? "#3b82f6" :
    "#64748b";

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>📶 Nearby Device Sync</h2>
            <p style={styles.subtitle}>WebRTC direct connection · No server needed</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Status Bar ── */}
        <div style={styles.statusBar}>
          <div style={{ ...styles.statusDot, background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          <span style={{ ...styles.statusText, color: statusColor }}>{status}</span>
        </div>

        {/* ── Tab Navigation ── */}
        <div style={styles.tabRow}>
          <button
            style={{ ...styles.tab, ...(activeTab === "create" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("create")}
          >
            1. Create
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "join" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("join")}
          >
            2. Join
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "complete" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("complete")}
          >
            3. Complete
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div style={styles.content}>

          {/* ── TAB 1: CREATE OFFER ── */}
          {activeTab === "create" && (
            <div>
              <p style={styles.sectionLabel}>Device A — Create Connection</p>
              <button style={styles.actionBtn} onClick={createOffer}>
                🔗 Create Offer
              </button>

              {offer && (
                <div style={styles.outputBlock}>
                  <div style={styles.outputHeader}>
                    <span style={styles.outputLabel}>Generated Offer</span>
                    <button
                      style={styles.copyBtn}
                      onClick={() => copyToClipboard(offer, "offer")}
                    >
                      {copied === "offer" ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                  <textarea
                    style={styles.textarea}
                    value={offer}
                    readOnly
                    rows={3}
                  />
                  <div style={styles.qrContainer}>
                    <QRCodeCanvas
                      value={offer}
                      size={180}
                      level="L"
                      bgColor="#0f172a"
                      fgColor="#e2e8f0"
                      includeMargin={true}
                      style={{ borderRadius: 8 }}
                    />
                    <p style={styles.qrHint}>Scan with Device B</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: JOIN (DEVICE B) ── */}
          {activeTab === "join" && (
            <div>
              <p style={styles.sectionLabel}>Device B — Join Connection</p>
              <textarea
                style={styles.textarea}
                placeholder='Paste the offer from Device A here…'
                value={remoteOffer}
                onChange={(e) => setRemoteOffer(e.target.value)}
                rows={3}
              />
              <button style={styles.actionBtn} onClick={createAnswer}>
                ⚡ Generate Answer
              </button>

              {answer && (
                <div style={styles.outputBlock}>
                  <div style={styles.outputHeader}>
                    <span style={styles.outputLabel}>Generated Answer</span>
                    <button
                      style={styles.copyBtn}
                      onClick={() => copyToClipboard(answer, "answer")}
                    >
                      {copied === "answer" ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                  <textarea
                    style={styles.textarea}
                    value={answer}
                    readOnly
                    rows={3}
                  />
                  <div style={styles.qrContainer}>
                    <QRCodeCanvas
                      value={answer}
                      size={180}
                      level="L"
                      bgColor="#0f172a"
                      fgColor="#e2e8f0"
                      includeMargin={true}
                      style={{ borderRadius: 8 }}
                    />
                    <p style={styles.qrHint}>Scan with Device A</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: COMPLETE CONNECTION ── */}
          {activeTab === "complete" && (
            <div>
              <p style={styles.sectionLabel}>Device A — Complete Connection</p>
              <textarea
                style={styles.textarea}
                placeholder='Paste the answer from Device B here…'
                value={remoteAnswer}
                onChange={(e) => setRemoteAnswer(e.target.value)}
                rows={3}
              />
              <button style={styles.actionBtn} onClick={completeConnection}>
                🚀 Connect
              </button>
            </div>
          )}
        </div>

        {/* ── Sync Log ── */}
        <div style={styles.logContainer}>
          <p style={styles.logTitle}>📋 Activity Log</p>
          <div style={styles.logScroll}>
            {syncLog.length === 0 && (
              <p style={styles.logEmpty}>No activity yet</p>
            )}
            {syncLog.map((entry, i) => (
              <div key={i} style={styles.logEntry}>
                <span style={styles.logTime}>
                  {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Info Footer ── */}
        <div style={styles.footer}>
          <p>⚠️ Both devices must be on the <strong>same local network</strong></p>
          <p>Manual signaling via QR code or copy-paste · No backend required</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES (inline — self-contained component)
// ═══════════════════════════════════════════════════
const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    animation: "fadeIn 0.2s ease",
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90dvh",
    overflowY: "auto",
    background: "linear-gradient(180deg, rgba(15, 23, 42, 0.97) 0%, rgba(10, 15, 30, 0.98) 100%)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 0,
    boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 24px 0",
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#f1f5f9",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#64748b",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    color: "#94a3b8",
    fontSize: 16,
    padding: "6px 10px",
    cursor: "pointer",
    transition: "0.2s",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    margin: "12px 24px 0",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.05)",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
    transition: "0.3s",
  },
  statusText: {
    fontSize: 13,
    fontWeight: 600,
    transition: "color 0.3s",
  },
  tabRow: {
    display: "flex",
    gap: 4,
    padding: "16px 24px 0",
  },
  tab: {
    flex: 1,
    padding: "10px 8px",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "0.2s",
    textAlign: "center",
  },
  tabActive: {
    background: "rgba(59, 130, 246, 0.12)",
    color: "#60a5fa",
    borderColor: "rgba(59, 130, 246, 0.25)",
  },
  content: {
    padding: "16px 24px",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 12,
    marginTop: 0,
  },
  actionBtn: {
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "0.2s",
    marginBottom: 16,
    boxShadow: "0 4px 16px rgba(59, 130, 246, 0.25)",
  },
  outputBlock: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  outputHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  outputLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  copyBtn: {
    padding: "4px 10px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    background: "rgba(255,255,255,0.05)",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "0.2s",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    background: "rgba(10, 15, 30, 0.8)",
    color: "#e2e8f0",
    fontFamily: "'Menlo', 'Consolas', monospace",
    fontSize: 11,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
    transition: "border-color 0.2s",
  },
  qrContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: 12,
  },
  qrHint: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 8,
    marginBottom: 0,
  },
  logContainer: {
    margin: "0 24px 16px",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: "12px 14px",
  },
  logTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    margin: "0 0 8px",
  },
  logScroll: {
    maxHeight: 120,
    overflowY: "auto",
  },
  logEmpty: {
    fontSize: 12,
    color: "#475569",
    margin: 0,
    fontStyle: "italic",
  },
  logEntry: {
    display: "flex",
    gap: 8,
    fontSize: 12,
    color: "#94a3b8",
    padding: "3px 0",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  logTime: {
    color: "#475569",
    fontFamily: "monospace",
    fontSize: 10,
    flexShrink: 0,
    marginTop: 2,
  },
  footer: {
    padding: "0 24px 20px",
    textAlign: "center",
    fontSize: 11,
    color: "#475569",
    lineHeight: 1.6,
  },
};

export default WebRTCSync;