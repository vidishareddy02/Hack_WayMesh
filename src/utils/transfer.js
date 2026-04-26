import { updatePriority, isWithinRadius } from "./message";

// Add message (no duplicates)
export function sendMessage(message, existingMessages) {
    const exists = existingMessages.some((m) => m.id === message.id);
    if (exists) return existingMessages;

    return [...existingMessages, message];
}

// Check duplicate
export function isDuplicate(message, messages) {
    return messages.some((m) => m.id === message.id);
}

// ✅ NEW — get missing messages
export function getMissingMessages(sender, receiver) {
    const receiverIds = new Set(receiver.map((m) => m.id));
    return sender.filter((m) => !receiverIds.has(m.id));
}

// ✅ SMART SYNC (UPDATED — location-aware)
export function forwardMessages(incomingMessages, existingMessages, deviceLocation) {
    let updated = [...existingMessages];

    // Filter incoming to only messages relevant to this device's location
    const nearby = deviceLocation
        ? incomingMessages.filter((m) => isWithinRadius(deviceLocation, m))
        : incomingMessages;

    const missing = getMissingMessages(nearby, existingMessages);

    missing
        .filter((msg) => msg.priority >= 2) // only important messages
        .forEach((msg) => {
            let newMsg = {
                ...msg,
                confidence: Math.min((msg.confidence || 0) + 0.1, 1),
                sharedCount: (msg.sharedCount || 0) + 1,
                lastShared: Date.now(),
            };

            // update priority after sharing
            newMsg = updatePriority(newMsg);

            updated.push(newMsg);
        });

    return updated;
}
export function negotiateSync(deviceA, deviceB) {
    const idsA = new Set(deviceA.map((m) => m.id));
    const idsB = new Set(deviceB.map((m) => m.id));

    const fromB = deviceB.filter((m) => !idsA.has(m.id));
    const fromA = deviceA.filter((m) => !idsB.has(m.id));

    return {
        updatedA: [...deviceA, ...fromB],
        updatedB: [...deviceB, ...fromA],
    };
}

// ✅ SYNC — merge incoming into local, no duplicates, location-aware
export function syncMessages(local, incoming, deviceLocation) {
    // Filter incoming to only messages within range of this device
    const relevant = deviceLocation
        ? incoming.filter((m) => isWithinRadius(deviceLocation, m))
        : incoming;

    const localIds = new Set(local.map((m) => m.id));
    const newMessages = relevant.filter((m) => !localIds.has(m.id));
    return [...local, ...newMessages];
}