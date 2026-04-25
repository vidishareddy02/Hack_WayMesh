import { Html5QrcodeScanner } from "html5-qrcode";
import { useState, useEffect } from "react"
import { sendMessage, forwardMessages } from "./utils/transfer"
import './App.css'
import QR from "./components/QR"

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
    fontWeight: "bold"
  };
  // Save messages
  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  // Load messages
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("messages"));
    if (stored) setMessages(stored);
  }, []);



  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: 250,
    });

    scanner.render((decodedText) => {
      try {
        const message = JSON.parse(decodedText);

        setMessages(prev => sendMessage(message, prev));
      } catch (err) {
        console.log("Invalid QR");
      }
    });

    return () => {
      scanner.clear();
    };
  }, []);


  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0f172a",
      color: "white",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <div style={{
        width: "90%",
        maxWidth: "500px",
        textAlign: "center"
      }}>

        <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>
          WayMesh 🚀
        </h1>

        {/* Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <button onClick={() => {
            const newMessage = {
              id: Date.now(),
              type: "alert",
              content: "Danger here!",
              priority: "high",
              timestamp: Date.now(),
              ttl: 10000,
              confidence: 0.5,
              location: { x: 2, y: 3 }
            };

            const updated = sendMessage(newMessage, messages);
            setMessages(updated);
          }} style={btnStyle}>
            Create Message
          </button>

          <button onClick={() => {
            const updated = forwardMessages([...messages], messages);
            setMessages(updated);
          }} style={btnStyle}>
            Send Nearby
          </button>

          <button onClick={() => {
            setMessages([]);
            localStorage.removeItem("messages");
          }} style={{ ...btnStyle, backgroundColor: "#ef4444" }}>
            Clear
          </button>
        </div>

        {/* Messages */}
        <h3 style={{ marginBottom: "10px" }}>Messages</h3>

        {messages.length === 0 && (
          <p style={{ opacity: 0.6 }}>No messages yet</p>
        )}

        <div>
          {messages.map(msg => (
            <div key={msg.id} style={{
              background: "#1e293b",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "10px",
              textAlign: "left"
            }}>
              <b>{msg.content}</b>

              <div style={{
                marginTop: "5px",
                color:
                  msg.confidence > 0.7 ? "#22c55e" :
                    msg.confidence > 0.4 ? "#f59e0b" : "#ef4444"
              }}>
                Confidence: {msg.confidence}
              </div>

              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                Priority: {msg.priority}
              </div>

              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                Location: ({msg.location.x}, {msg.location.y})
              </div>
            </div>
          ))}
        </div>

        {/* QR */}
        <div style={{ marginTop: "20px" }}>
          <QR message={messages[messages.length - 1]} />
        </div>

        {/* Scanner */}
        <div id="reader" style={{
          marginTop: "20px",
          borderRadius: "10px",
          overflow: "hidden"
        }}></div>

      </div>
    </div>
  );

}

export default App
