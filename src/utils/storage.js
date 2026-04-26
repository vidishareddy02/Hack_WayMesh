const STORAGE_KEY = "messages";

function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function getMessages() {
  const data = localStorage.getItem(STORAGE_KEY);
  const messages = data ? JSON.parse(data) : [];

  const now = Date.now();

  const filtered = messages.filter(
    (m) => now <= m.timestamp + m.ttl
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

  return filtered;
}

function addMessage(message) {
  const messages = getMessages();

  const exists = messages.some((m) => m.id === message.id);

  if (!exists) {
    messages.push(message);
    saveMessages(messages);
  }
}

function removeExpiredMessages(messages) {
  const now = Date.now();
  return messages.filter((m) => now <= m.timestamp + m.ttl);
}

// 🔥 SMART DECAY — confidence-aware removal
// High confidence (>=0.8) → 2x lifetime, Medium (>=0.7) → standard, Low + stale → removed
function removeStaleMessages(baseThreshold = 60000) {
  const now = Date.now();
  const messages = getMessages() || [];
  const active = messages.filter((m) => {
    const age = now - (m.lastShared || m.timestamp);
    const conf = m.confidence || 0.5;

    // Dynamic threshold: high-confidence messages live longer
    let threshold = baseThreshold;
    if (conf >= 0.8) threshold = baseThreshold * 2;   // 120s for well-validated
    else if (conf >= 0.7) threshold = baseThreshold;   // 60s standard

    // Only remove if BOTH stale AND low confidence
    if (age > threshold && conf < 0.7) return false;
    // High-confidence messages only removed if past their extended threshold
    if (age > threshold) return false;

    return true;
  });
  saveMessages(active);
  return active;
}

export { saveMessages, getMessages, addMessage, removeExpiredMessages, removeStaleMessages };