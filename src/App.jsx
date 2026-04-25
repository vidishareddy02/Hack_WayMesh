import { useEffect, useState } from "react";
import { createMessage } from "./utils/message";
import { addMessage, getMessages } from "./utils/storage";

function App() {
  const [messages, setMessages] = useState([]);

useEffect(() => {
  setMessages(getMessages());

  const interval = setInterval(() => {
    let updated = getMessages().map((m) => {
      return {
        ...m,
        confidence: Math.max(m.confidence - 0.02, 0),
      };
    });

    localStorage.setItem("messages", JSON.stringify(updated));
    setMessages(updated);
  }, 3000);

  return () => clearInterval(interval);
}, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>🚨 WayMesh Messages</h1>

      <button
 onClick={() => {
  const msg = createMessage("alert", "New Alert 🚨", 5, { x: 1, y: 1 });

  addMessage(msg);

  const all = getMessages();
  console.log("Stored messages:", all);  // ✅ ADD THIS

  setMessages(all);
}}
>
  ➕ Add Message
</button>

<button
  onClick={() => {
    localStorage.clear();
    setMessages([]);
  }}
>
  🧹 Clear All
</button>

  <button
  onClick={() => {
    const filtered = getMessages().filter((m) => m.priority >= 3);
    setMessages(filtered);
  }}
>
  ⚡ Show Important Only
</button>

  <button
  onClick={() => {
    setMessages(getMessages());
  }}
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


      {messages.map((m) => (
  <div
    key={m.id}
    style={{
      border: "1px solid gray",
      padding: "10px",
      margin: "10px",
      backgroundColor:
        m.confidence > 0.7
          ? "#ffcccc"
          : m.confidence > 0.4
          ? "#fff3cd"
          : "#eeeeee",
    }}
  >
          <p><b>Type:</b> {m.type}</p>
          <p><b>Content:</b> {m.content}</p>
          <p><b>Priority:</b> {m.priority}</p>
          <p><b>Confidence:</b> {m.confidence.toFixed(2)}</p>

          <button
  onClick={() => {
  m.confidence = Math.min(m.confidence + 0.1, 1);

  const baseTTL = 10000;
  m.ttl = baseTTL * m.confidence;   // 🔥 update TTL dynamically

  setMessages([...messages]);
}}
>
  🔁 Share (Increase Confidence)
</button>
        </div>
      ))}
    </div>
  );
}

export default App;