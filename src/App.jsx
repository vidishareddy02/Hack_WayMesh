import { Html5QrcodeScanner } from "html5-qrcode";
import { useState, useEffect } from "react";
import { sendMessage, forwardMessages } from "./utils/transfer";
import { createMessage } from "./utils/message";
import { addMessage, getMessages } from "./utils/storage";
import QR from "./components/QR";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);

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

  // 🔹 Load messages initially
  useEffect(() => {
    const stored = getMessages();
    setMessages(stored);
  }, []);

  // 🔹 Save messages whenever updated
  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  // 🔹 Confidence decay over time
  useEffect(() => {
    const interval = setInterval(() => {
      let updated = getMessages().map((m) => ({
        ...m,
        confidence: Math.max(m.confidence - 0.02, 0),
      }));

      localStorage.setItem("messages", JSON.stringify(updated));
      setMessages(updated);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 🔹 QR Scanner setup
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
      <div style={{ width: "90%", maxWidth: "500px", textAlign: "center" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>
          WayMesh 🚀
        </h1>

        {/* 🔹 Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => {
              const msg = createMessage(
                "alert",
                "New Alert 🚨",
                5,
                { x: 1, y: 1 }
              );

              addMessage(msg);
              setMessages(getMessages());
            }}
            style={btnStyle}
          >
            ➕ Add Message
          </button>

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

        {/* 🔹 Messages */}
        <h3>Messages</h3>

        {messages.length === 0 && (
          <p style={{ opacity: 0.6 }}>No messages yet</p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              background: "#1e293b",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "10px",
              textAlign: "left",
            }}
          >
            <b>{m.content}</b>

            <div
              style={{
                color:
                  m.confidence > 0.7
                    ? "#22c55e"
                    : m.confidence > 0.4
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            >
              Confidence: {m.confidence.toFixed(2)}
            </div>

            <div style={{ fontSize: "12px", opacity: 0.7 }}>
              Priority: {m.priority}
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
              style={{ marginTop: "10px" }}
            >
              🔁 Share (Boost Confidence)
            </button>
          </div>
        ))}

        {/* 🔹 QR Generator */}
        <div style={{ marginTop: "20px" }}>
          {messages.length > 0 && (
            <QR message={messages[messages.length - 1]} />
          )}
        </div>

        {/* 🔹 QR Scanner */}
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


