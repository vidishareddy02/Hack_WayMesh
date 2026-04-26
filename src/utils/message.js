const baseTTL = 86400000; // 24 hours (was 10s — caused messages to vanish)
export const CATEGORIES = [
  "medical",
  "shelter",
  "transport",
  "danger",
  "food",
  "general"
];
export function getCategoryFromContent(content) {
  const text = content.toLowerCase();

  const medical = ["doctor", "hospital", "injury", "injured", "wound", "bleeding", "medicine", "medical", "ambulance", "first aid", "emergency", "patient", "nurse", "clinic", "health"];
  const danger = ["fire", "explosion", "danger", "accident", "collapse", "flood", "earthquake", "gas leak", "short circuit", "blast", "unsafe", "hazard", "tornado", "landslide", "trapped"];
  const shelter = ["shelter", "stay", "safe place", "refuge", "camp", "home", "house", "protection", "safe zone", "tent", "evacuation center"];
  const food = ["food", "water", "hungry", "starving", "supplies", "ration", "drinking water", "meals", "food camp", "thirsty", "provisions"];
  const transport = ["bus", "car", "ride", "vehicle", "transport", "evacuation", "pickup", "drop", "travel", "route", "truck", "train", "helicopter"];

  if (medical.some((k) => text.includes(k))) return "medical";
  if (danger.some((k) => text.includes(k))) return "danger";
  if (shelter.some((k) => text.includes(k))) return "shelter";
  if (food.some((k) => text.includes(k))) return "food";
  if (transport.some((k) => text.includes(k))) return "transport";

  return "general";
}
function autoPriority(text) {
  const t = text.toLowerCase();

  // HIGH PRIORITY (5)
  if (
    t.includes("fire") ||
    t.includes("explosion") ||
    t.includes("injury") ||
    t.includes("accident") ||
    t.includes("emergency") ||
    t.includes("bleeding") ||
    t.includes("collapse") ||
    t.includes("trapped") ||
    t.includes("earthquake")
  ) return 5;

  // MEDIUM-HIGH PRIORITY (4)
  if (
    t.includes("danger") ||
    t.includes("flood") ||
    t.includes("gas leak") ||
    t.includes("unsafe") ||
    t.includes("hazard")
  ) return 4;

  // MEDIUM PRIORITY (3)
  if (
    t.includes("doctor") ||
    t.includes("hospital") ||
    t.includes("shelter") ||
    t.includes("food") ||
    t.includes("water") ||
    t.includes("help") ||
    t.includes("medicine") ||
    t.includes("ambulance")
  ) return 3;

  // LOW-MEDIUM PRIORITY (2)
  if (
    t.includes("transport") ||
    t.includes("bus") ||
    t.includes("route") ||
    t.includes("supplies")
  ) return 2;

  // LOW PRIORITY
  return 1;
}

function createMessage(type, content, priority, location, category = "general") {
  const finalLocation = location
    ? { x: location.x, y: location.y }
    : {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };

  return {
    id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 9),
    type,
    content,
    priority,
    location: finalLocation,
    confidence: 0.5,
    ttl: baseTTL,
    category: getCategoryFromContent(content),
    timestamp: Date.now(),
    lastShared: Date.now(),
    radius: 2,
  };
}

function increaseConfidence(message) {
  message.confidence = Math.min(message.confidence + 0.1, 1);
}

function decreaseConfidence(message) {
  message.confidence = Math.max(message.confidence - 0.05, 0);
}


function updatePriority(message) {
  const age = Date.now() - message.timestamp;

  // decrease if old
  let newPriority = message.priority - age / 20000;

  // increase if shared
  newPriority += (message.sharedCount || 0) * 0.5;

  return {
    ...message,
    priority: Math.max(1, Math.min(5, newPriority))
  };
}

function isExpired(message) {
  return Date.now() > message.timestamp + message.ttl;
}

function filterImportant(messages) {
  return messages.filter((m) => m.priority >= 3);
}
function filterByCategory(messages, category) {
  return messages.filter((m) => m.category === category);
}
function decayMessage(message) {
  const age = Date.now() - message.timestamp;

  return {
    ...message,
    confidence: Math.max(0.1, message.confidence - age / 100000),
    ttl: Math.max(0, message.ttl - age),
  };
}
function getMessagesAtLocation(messages, x, y) {
  return messages.filter(
    (m) => m.location.x === x && m.location.y === y
  );
}
function getDangerZones(messages) {
  return messages.filter((m) => m.category === "danger");
}
function isNearby(message, userX, userY) {
  return (
    Math.abs(message.location.x - userX) <= 1 &&
    Math.abs(message.location.y - userY) <= 1
  );
}
function getNearbyMessages(messages, userX, userY) {
  return messages.filter((m) => isNearby(m, userX, userY));
}

// 🔥 LOCATION-BASED ALERT — check if device is within message radius (for propagation)
function isWithinRadius(device, message) {
  const dx = device.x - message.location.x;
  const dy = device.y - message.location.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= (message.radius || 2);
}

// 🔥 VIEW RANGE — single source of truth for map + card visibility
// Uses box distance (matches GridMap viewport logic)
function isInViewRange(user, message, viewRadius = 5) {
  if (!message?.location) return false;
  const dx = message.location.x - user.x;
  const dy = message.location.y - user.y;
  return Math.abs(dx) <= viewRadius && Math.abs(dy) <= viewRadius;
}

export {
  createMessage,
  autoPriority,
  increaseConfidence,
  decreaseConfidence,
  updatePriority,
  isExpired,
  filterImportant,
  filterByCategory,
  decayMessage,
  getMessagesAtLocation,
  getDangerZones,
  isNearby,
  getNearbyMessages,
  isWithinRadius,
  isInViewRange
};