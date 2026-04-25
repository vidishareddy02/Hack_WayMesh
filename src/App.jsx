import { Html5QrcodeScanner } from "html5-qrcode";
import { useState, useEffect } from "react";
import { sendMessage, forwardMessages } from "./utils/transfer";
import { createMessage } from "./utils/message";
import { addMessage, getMessages } from "./utils/storage";
import CapsuleCard from "./components/CapsuleCard";
import QR from "./components/QR";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState(0);

  const groupedMessages = messages.reduce((acc, msg) => {
    const category = msg.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(msg);
    return acc;
  }, {});

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [emergencyMode, setEmergencyMode] = useState(false);

  let filteredMessages = selectedCategory
  ? groupedMessages[selectedCategory] || []
  : messages;

// 🚨 Emergency mode override
if (emergencyMode) {
  filteredMessages = filteredMessages.filter((m) => m.priority >= 4);
}


  const btnStyle = {
    margin: "5px",
    padding: "10px 15px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#3b82f6",
    color: "white",
    fontWeight: "bold",
  };

  useEffect(() => {
    const stored = getMessages();
    setMessages(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      let updated = getMessages().map((m) => ({
        ...m,
        confidence: Math.max(m.confidence - 0.005, 0),
      }));

      localStorage.setItem("messages", JSON.stringify(updated));
      setMessages(updated);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: 250,
    });

    scanner.render((decodedText) => {
      try {
        const message = JSON.parse(decodedText);
        const updated = sendMessage(message, messages);
        setMessages(updated);
      } catch (err) {
        console.log("Invalid QR");
      }
    });

    return () => {
      scanner.clear();
    };
  }, [messages]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ width: "90%", maxWidth: "700px", textAlign: "center" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>
          WayMesh 🚀
        </h1>

        <div style={{ marginBottom: "20px" }}>

          {/* Medical */}
          <button onClick={() => {
            const msg = {
              ...createMessage("alert", "Need Doctor 🚑", 5, { x: 2, y: 2 }),
              category: "medical",
            };
            addMessage(msg);
            setMessages(getMessages());
          }}>
            ➕ Medical
          </button>

          {/* Danger */}
          <button onClick={() => {
            const msg = {
              ...createMessage("alert", "Fire Alert 🔥", 5, { x: 3, y: 3 }),
              category: "danger",
            };
            addMessage(msg);
            setMessages(getMessages());
          }}>
            ➕ Danger
          </button>

          {/* Shelter */}
          <button onClick={() => {
            const msg = {
              ...createMessage("alert", "Shelter Available 🏠", 3, { x: 4, y: 4 }),
              category: "shelter",
            };
            addMessage(msg);
            setMessages(getMessages());
          }}>
            ➕ Shelter
          </button>

          {/* Transport */}
          <button onClick={() => {
            const msg = {
              ...createMessage("alert", "Transport Available 🚗", 3, { x: 5, y: 5 }),
              category: "transport",
            };
            addMessage(msg);
            setMessages(getMessages());
          }}>
            ➕ Transport
          </button>

          {/* EXISTING BUTTONS */}
          <button
            onClick={() => {
              const updated = forwardMessages([...messages], messages);
              setMessages(updated);
            }}
            style={btnStyle}
          >
            📡 Send Nearby
          </button>

          <button
            onClick={() => {
              const filtered = getMessages().filter((m) => m.priority >= 3);
              setMessages(filtered);
            }}
            style={btnStyle}
          >
            ⚡ Important Only
          </button>

          <button
            onClick={() => {
              setMessages(getMessages());
            }}
            style={btnStyle}
          >
            🔄 Show All
          </button>

          <button
  onClick={() => setEmergencyMode(!emergencyMode)}
  style={{
    margin: "5px",
    padding: "10px 15px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: emergencyMode ? "#ef4444" : "#1e293b",
    color: "white",
    fontWeight: "bold",
  }}
>
  🚨 Emergency Mode {emergencyMode ? "ON" : "OFF"}
</button>

          <button
            onClick={() => {
              const msg = createMessage("alert", "Low Priority", 1, { x: 1, y: 1 });
              addMessage(msg);
              setMessages(getMessages());
            }}
          >
            ➕ Add LOW Priority
          </button>

          <button
            onClick={() => {
              const msg = createMessage("alert", "High Priority", 5, { x: 2, y: 2 });
              addMessage(msg);
              setMessages(getMessages());
            }}
          >
            ➕ Add HIGH Priority
          </button>

          <button
            onClick={() => {
              localStorage.clear();
              setMessages([]);
            }}
            style={{ ...btnStyle, backgroundColor: "#ef4444" }}
          >
            🧹 Clear
          </button>
        </div>

        {/* Show All */}
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            marginBottom: "15px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#1e293b",
            color: "white",
            cursor: "pointer",
          }}
        >
          Show All
        </button>

        <div style={{ marginBottom: "20px" }}>
  <span style={{ marginRight: "10px" }}>Filter:</span>

  <button
  onClick={() => setPriorityFilter(0)}
  style={{
    background: priorityFilter === 0 ? "#3b82f6" : "#1e293b",
    color: "white",
    margin: "5px",
    padding: "8px 12px",
    borderRadius: "8px",
  }}
>
  All
</button>

<button
  onClick={() => setPriorityFilter(3)}
  style={{
    background: priorityFilter === 3 ? "#3b82f6" : "#1e293b",
    color: "white",
    margin: "5px",
    padding: "8px 12px",
    borderRadius: "8px",
  }}
>
  Priority ≥ 3
</button>

<button
  onClick={() => setPriorityFilter(5)}
  style={{
    background: priorityFilter === 5 ? "#3b82f6" : "#1e293b",
    color: "white",
    margin: "5px",
    padding: "8px 12px",
    borderRadius: "8px",
  }}
>
  Priority ≥ 5
</button>

{emergencyMode && (
  <p style={{ color: "#ef4444", fontWeight: "bold" }}>
    Showing only high priority alerts 🚨
  </p>
)}
</div>

        {/* Capsules */}
        <div
          style={{
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          {Object.entries(groupedMessages).map(([category, msgs]) => (
            <CapsuleCard
  key={category}
  category={category}
  messages={msgs}
  onClick={(cat) => setSelectedCategory(cat)}
  isSelected={selectedCategory === category}
/>
          ))}
        </div>

        <h3>Messages</h3>

        {filteredMessages.length === 0 && (
          <p style={{ opacity: 0.6 }}>No messages yet</p>
        )}

        {filteredMessages.map((m) => (
  // ⬇️ REPLACE THIS WHOLE DIV ONLY
  <div
    key={m.id}
    style={{
      background: "#1e293b",
      padding: "15px",
      borderRadius: "12px",
      marginBottom: "12px",
      textAlign: "left",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    }}
  >
    <b>{m.content}</b>

    {/* 🔥 PRIORITY BADGE */}
    <div
      style={{
        display: "inline-block",
        marginTop: "8px",
        padding: "4px 10px",
        borderRadius: "20px",
        background:
          m.priority >= 5
            ? "#ef4444"
            : m.priority >= 3
            ? "#f59e0b"
            : "#22c55e",
        fontSize: "12px",
      }}
    >
      Priority {m.priority}
    </div>

    {/* 🔥 CONFIDENCE BAR */}
    <div style={{ marginTop: "10px" }}>
      <div
        style={{
          height: "6px",
          borderRadius: "5px",
          background: "#334155",
        }}
      >
        <div
          style={{
            width: `${m.confidence * 100}%`,
            height: "100%",
            borderRadius: "5px",
            background:
              m.confidence > 0.7
                ? "#22c55e"
                : m.confidence > 0.4
                ? "#f59e0b"
                : "#ef4444",
          }}
        ></div>
      </div>

      <p style={{ fontSize: "12px", marginTop: "5px" }}>
        Confidence: {m.confidence.toFixed(2)}
      </p>
    </div>

    <div style={{ fontSize: "12px", opacity: 0.7 }}>
      Location: ({m.location.x}, {m.location.y})
    </div>

    <button
      onClick={() => {
        const updated = messages.map((msg) =>
          msg.id === m.id
            ? {
                ...msg,
                confidence: Math.min(msg.confidence + 0.1, 1),
                ttl: 10000 * Math.min(msg.confidence + 0.1, 1),
              }
            : msg
        );

        setMessages(updated);
      }}
      style={{
        marginTop: "10px",
        padding: "6px 10px",
        borderRadius: "6px",
        border: "none",
        cursor: "pointer",
      }}
    >
      🔁 Share (Boost Confidence)
    </button>
  </div>
))}

        <div style={{ marginTop: "20px" }}>
          {messages.length > 0 && (
            <QR message={messages[messages.length - 1]} />
          )}
        </div>

        <div
          id="reader"
          style={{
            marginTop: "20px",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        ></div>
      </div>
    </div>
  );
}

export default App;