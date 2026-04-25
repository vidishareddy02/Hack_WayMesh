// Add message (no duplicates)
export function sendMessage(message, existingMessages) {
    const exists = existingMessages.some(m => m.id === message.id);

    if (exists) return existingMessages;

    return [...existingMessages, message];
}

// Check duplicate
export function isDuplicate(message, messages) {
    return messages.some(m => m.id === message.id);
}

// Forward messages (A → B → C)
export function forwardMessages(incomingMessages, existingMessages) {
    let updated = [...existingMessages];

    incomingMessages.forEach(msg => {
        const index = updated.findIndex(m => m.id === msg.id);

        if (index !== -1) {
            // message exists → increase confidence
            updated[index] = {
                ...updated[index],
                confidence: Math.min(updated[index].confidence + 0.1, 1)
            };
        } else {
            // new message → add it
            updated.push({
                ...msg,
                confidence: Math.min(Number(((msg.confidence || 0) + 0.1).toFixed(2)), 1)
            });
        }
    });

    return updated;
}
