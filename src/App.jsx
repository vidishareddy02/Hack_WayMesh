import { useState, useEffect } from "react";
import { createMessage, autoPriority, isInViewRange } from "./utils/message";
import { addMessage, getMessages, saveMessages, removeStaleMessages } from "./utils/storage";
import QR from "./components/QR";
import QRScanner from "./components/QRScanner";
import GridMap from "./components/GridMap";
import "./App.css";


// ── Category config ──
const CATEGORY_META = {
  medical:   { emoji: "🚑", color: "#3b82f6", label: "Medical" },
  danger:    { emoji: "🔥", color: "#ef4444", label: "Danger" },
  shelter:   { emoji: "🏠", color: "#22c55e", label: "Shelter" },
  food:      { emoji: "🍞", color: "#f59e0b", label: "Food" },
  transport: { emoji: "🚗", color: "#8b5cf6", label: "Transport" },
  other:     { emoji: "📦", color: "#64748b", label: "Other" },
};

function App() {
  // ── State ──
  const [messages, setMessages] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createInput, setCreateInput] = useState("");
  const [currentPage, setCurrentPage] = useState("home");
  const [showMiniMap, setShowMiniMap] = useState(false);


  // ── Device location (hardcoded for stable demo) ──
  const deviceLocation = { x: 3, y: 3 };

  // ── Auto-categorize ──
  function autoCategorize(text) {
    const t = text.toLowerCase();
    const medical = ["doctor", "hospital", "injury", "injured", "wound", "bleeding", "medicine", "medical", "ambulance", "first aid", "emergency", "patient", "nurse", "clinic", "health"];
    const danger = ["fire", "explosion", "danger", "accident", "collapse", "flood", "earthquake", "gas leak", "short circuit", "blast", "unsafe", "hazard", "tornado", "landslide", "trapped"];
    const shelter = ["shelter", "stay", "safe place", "refuge", "camp", "home", "house", "protection", "safe zone", "tent", "evacuation center"];
    const food = ["food", "water", "hungry", "starving", "supplies", "ration", "drinking water", "meals", "food camp", "thirsty", "provisions"];
    const transport = ["bus", "car", "ride", "vehicle", "transport", "evacuation", "pickup", "drop", "travel", "route", "truck", "train", "helicopter"];
    if (medical.some((k) => t.includes(k))) return "medical";
    if (danger.some((k) => t.includes(k))) return "danger";
    if (shelter.some((k) => t.includes(k))) return "shelter";
    if (food.some((k) => t.includes(k))) return "food";
    if (transport.some((k) => t.includes(k))) return "transport";
    return "other";
  }

  // ── Grouping ──
  const groupedMessages = messages.reduce((acc, msg) => {
    const category = msg.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(msg);
    return acc;
  }, {});

  // ── Filtering (display only — never overwrites data) ──
  let filteredMessages = selectedCategory
    ? groupedMessages[selectedCategory] || []
    : messages;
  filteredMessages = filteredMessages.filter((m) => m.priority >= priorityFilter);
  if (emergencyMode) {
    filteredMessages = filteredMessages.filter((m) => m.priority >= 4);
  }

  // ── Load from storage ──
  useEffect(() => {
    let stored = getMessages() || [];
    if (stored.length === 0) {
      const samples = [
        createMessage("alert", "Need Doctor 🚑", 5, { x: 2, y: 4 }),
        createMessage("alert", "Fire Alert 🔥", 5, { x: 3, y: 6 }),
        createMessage("alert", "Shelter Available 🏠", 3, { x: 3, y: 2 }),
        createMessage("alert", "Transport Available 🚗", 3, { x: 5, y: 3 }),
      ];
      samples.forEach((msg) => {
        msg.category = autoCategorize(msg.content);
        addMessage(msg);
      });
      stored = getMessages() || [];
    }
    setMessages(stored);
  }, []);

  // ── Decay system ──
  useEffect(() => {
    const interval = setInterval(() => {
      const active = removeStaleMessages(60000);
      setMessages(active);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Navigate ──
  function nav(page) {
    setCurrentPage(page);
  }

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════
  return (
    <div className="app-shell">

      {/* ── Navigation Bar ── */}
      <nav className="nav-bar">
        <button className={`nav-tab ${currentPage === "home" ? "active" : ""}`} onClick={() => nav("home")}>
          🏠 Dashboard
        </button>
        <button className={`nav-tab ${currentPage === "map" ? "active" : ""}`} onClick={() => nav("map")}>
          🗺️ Map
        </button>
        <button className={`nav-tab ${currentPage === "qr" ? "active" : ""}`} onClick={() => nav("qr")}>
          📤 QR Share
        </button>
      </nav>

      {/* ── Page Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 40px" }} className="page-enter" key={currentPage}>

        {/* ═══════════════════════════════════════════
            HOME PAGE
        ═══════════════════════════════════════════ */}
        {currentPage === "home" && (
          <>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h1 className="brand-title" style={{ margin: "0 0 4px" }}>
                WayMesh
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                📍 Device at ({deviceLocation.x}, {deviceLocation.y}) · Offline Emergency Mesh
              </p>
            </div>

            {/* Action buttons */}
            <div className="action-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
              <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
                {showCreateForm ? "✕ Cancel" : "＋ Create"}
              </button>
              <button className="btn btn-ghost" onClick={() => {
                nav("qr");
                setTimeout(() => {
                  document.getElementById("qr-section")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}>
                📤 Share Alerts
              </button>
              <button className="btn btn-ghost" onClick={() => {
                setPriorityFilter(0);
                setSelectedCategory(null);
                setEmergencyMode(false);
              }}>
                ↻ Show All
              </button>
              <button className={emergencyMode ? "btn btn-emergency-on" : "btn btn-emergency-off"} onClick={() => setEmergencyMode(!emergencyMode)}>
                🚨 {emergencyMode ? "Emergency ON" : "Emergency"}
              </button>
              <button className="btn btn-ghost" onClick={() => {
                localStorage.clear();
                setMessages([]);
              }} style={{ color: "#ef4444" }}>
                🗑 Clear
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="glass-card" style={{ maxWidth: 400, margin: "0 auto 20px", textAlign: "left" }}>
                <p className="section-title" style={{ textAlign: "center" }}>📝 New Message</p>
                <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>Message</label>
                <input
                  className="input"
                  type="text"
                  value={createInput}
                  onChange={(e) => setCreateInput(e.target.value)}
                  placeholder='e.g. "Need doctor urgently"'
                  style={{ marginBottom: 10 }}
                />
                {createInput.trim() && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
                    Category: <strong style={{ color: CATEGORY_META[autoCategorize(createInput)]?.color || "#94a3b8" }}>
                      {autoCategorize(createInput)}
                    </strong>
                  </p>
                )}
                <button className="btn btn-success" style={{ width: "100%", justifyContent: "center" }} onClick={() => {
                  if (!createInput.trim()) return;
                  const priority = autoPriority(createInput.trim());
                  const msg = createMessage("alert", createInput.trim(), priority, deviceLocation);
                  msg.category = autoCategorize(msg.content);
                  addMessage(msg);
                  setMessages(getMessages() || []);
                  console.log("ALL MESSAGES:", getMessages());
                  setCreateInput("");
                  setShowCreateForm(false);
                }}>
                  ✓ Submit Message
                </button>
              </div>
            )}

            {/* Category capsules */}
            <div className="capsule-grid" style={{ marginBottom: 20 }}>
              {Object.entries(groupedMessages).map(([category, msgs]) => {
                const meta = CATEGORY_META[category] || CATEGORY_META.other;
                const isSelected = selectedCategory === category;
                return (
                  <div
                    key={category}
                    className={`capsule capsule-${category} ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedCategory(isSelected ? null : category);
                      if (!isSelected) setShowMiniMap(true);
                    }}
                    style={{ background: "var(--bg-card)" }}
                  >
                    <div className="capsule-emoji">{meta.emoji}</div>
                    <div className="capsule-label">{meta.label}</div>
                    <div className="capsule-count">{msgs.length}</div>
                  </div>
                );
              })}
            </div>

            {/* Quick map toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p className="section-title" style={{ margin: 0 }}>
                Messages {filteredMessages.length > 0 && <span style={{ opacity: 0.5 }}>({filteredMessages.length})</span>}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                {selectedCategory && (
                  <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => setShowMiniMap(!showMiniMap)}>
                    {showMiniMap ? "Hide Map" : "Show Map"}
                  </button>
                )}
                <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => nav("map")}>
                  Open Full Map →
                </button>
              </div>
            </div>

            {/* Mini map (contextual) */}
            {showMiniMap && selectedCategory && (
              <div style={{ marginBottom: 16 }}>
                <GridMap
                  messages={filteredMessages}
                  userLocation={deviceLocation}
                  selectedCategory={selectedCategory}
                />
              </div>
            )}

            {/* Empty state */}
            {filteredMessages.length === 0 && (
              <div className="glass-card" style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No alerts detected yet</p>
              </div>
            )}

            {/* Message list */}
            {filteredMessages.map((m) => {
              const meta = CATEGORY_META[m.category] || CATEGORY_META.other;
              const conf = m.confidence || 0.5;
              const inView = isInViewRange(deviceLocation, m);
              return (
                <div key={m.id} className="msg-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="msg-title">{m.content}</div>
                    <span className="priority-badge" style={{
                      background: m.priority >= 5 ? "rgba(239,68,68,0.15)" : m.priority >= 3 ? "rgba(234,179,8,0.15)" : "rgba(148,163,184,0.1)",
                      color: m.priority >= 5 ? "#ef4444" : m.priority >= 3 ? "#eab308" : "#94a3b8",
                    }}>
                      P{m.priority}
                    </span>
                  </div>

                  <div className="msg-meta" style={{ marginTop: 6 }}>
                    <span style={{ color: meta.color }}>{meta.emoji} {meta.label}</span>
                    <span>📍 ({m.location?.x || 0}, {m.location?.y || 0})</span>
                    {inView
                      ? <span style={{ color: "#22c55e" }}>✓ In view</span>
                      : <span style={{ color: "#ef4444" }}>✕ Out of area</span>
                    }
                  </div>

                  <div className="confidence-bar" style={{ marginTop: 8 }}>
                    <div className="confidence-fill" style={{
                      width: `${(conf * 100).toFixed(0)}%`,
                      background: conf >= 0.8 ? "#22c55e" : conf >= 0.5 ? "#eab308" : "#ef4444",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Confidence: {conf.toFixed(2)}
                  </div>

                  <button className="btn btn-indigo" style={{ marginTop: 8, padding: "6px 12px", fontSize: 11 }}
                    onClick={() => {
                      const all = getMessages() || [];
                      const updated = all.map((msg) =>
                        msg.id === m.id
                          ? { ...msg, confidence: Math.min((msg.confidence || 0.5) + 0.1, 1), lastShared: Date.now(), sharedCount: (msg.sharedCount || 0) + 1 }
                          : msg
                      );
                      saveMessages(updated);
                      setMessages(updated);
                    }}
                  >
                    🔁 Confirm / Share
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ═══════════════════════════════════════════
            MAP PAGE
        ═══════════════════════════════════════════ */}
        {currentPage === "map" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button className="btn btn-ghost" onClick={() => nav("home")} style={{ padding: "6px 12px", fontSize: 12 }}>
                ← Back
              </button>
              <p className="section-title" style={{ margin: 0, flex: 1 }}>Full Emergency Map</p>
            </div>

            {/* Filter buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              <button className={`btn ${!selectedCategory ? "btn-primary" : "btn-ghost"}`} style={{ padding: "6px 12px", fontSize: 11 }}
                onClick={() => setSelectedCategory(null)}>
                All
              </button>
              {Object.entries(CATEGORY_META).filter(([k]) => k !== "other").map(([cat, meta]) => (
                <button key={cat}
                  className={`btn ${selectedCategory === cat ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "6px 12px", fontSize: 11, ...(selectedCategory === cat ? { background: meta.color } : {}) }}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  {meta.emoji} {meta.label}
                </button>
              ))}
            </div>

            <GridMap
              messages={filteredMessages}
              userLocation={deviceLocation}
              selectedCategory={selectedCategory}
            />
          </>
        )}

        {/* ═══════════════════════════════════════════
            QR NODE PAGE
        ═══════════════════════════════════════════ */}
        {currentPage === "qr" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button className="btn btn-ghost" onClick={() => nav("home")} style={{ padding: "6px 12px", fontSize: 12 }}>
                ← Back
              </button>
              <p className="section-title" style={{ margin: 0, flex: 1 }}>Share Your Alerts</p>
            </div>

            <div id="qr-section" className="glass-card" style={{ textAlign: "center", marginBottom: 20 }}>
              <QR userLocation={deviceLocation} emergencyMode={emergencyMode} />
            </div>

            <div className="glass-card" style={{ marginBottom: 20 }}>
              <p className="section-title" style={{ textAlign: "center" }}>📷 Scan Another Device</p>
              <QRScanner setMessages={setMessages} onSyncComplete={() => nav("home")} />
            </div>
          </>
        )}

      </div>

    </div>
  );
}

export default App;