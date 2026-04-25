const STORAGE_KEY = "messages";

function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function getMessages() {
  const data = localStorage.getItem(STORAGE_KEY);
  const messages = data ? JSON.parse(data) : [];

  const now = Date.now();
  const filtered = messages.filter((m) => now <= m.timestamp + m.ttl);

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

export { saveMessages, getMessages, addMessage, removeExpiredMessages };