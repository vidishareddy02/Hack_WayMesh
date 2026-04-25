const baseTTL = 10000;
const confidence = 1;

function createMessage(type, content, priority, location) {
  return {
    id: Date.now().toString() + Math.random().toString(36).substring(2),
    type,
    content,
    priority,
    timestamp: Date.now(),
    ttl: baseTTL * confidence,
    confidence: 1,
    location: { x: location.x, y: location.y },
  };
}

function increaseConfidence(message) {
  message.confidence = Math.min(message.confidence + 0.1, 1);
  
}

function decreaseConfidence(message) {
  message.confidence = Math.max(message.confidence - 0.05, 0);
}

function isExpired(message) {
  return Date.now() > message.timestamp + message.ttl;
}

function filterImportant(messages) {
  return messages.filter((m) => m.priority >= 4);
}

export {
  createMessage,
  increaseConfidence,
  decreaseConfidence,
  isExpired,
  filterImportant,
};