/**
 * Deep compare two objects for equality
 * Uses JSON.stringify for simplicity and effectiveness with plain data objects
 */
function isEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Calculate the difference between two arrays of objects
 * Objects must have a unique 'id' property
 * @param {Array} original - The original array
 * @param {Array} current - The current array
 * @returns {Object} { added: [], updated: [], removed: [] } or null if no difference
 */
export function calculateDiff(original = [], current = []) {
    const added = [];
    const updated = [];
    const removedIdSet = new Set(original.map(item => item.id));
    const originalMap = new Map(original.map(item => [item.id, item]));

    // Find added and updated
    for (const item of current) {
        if (originalMap.has(item.id)) {
            // Exists in both, check for updates
            removedIdSet.delete(item.id); // It's not removed
            const originalItem = originalMap.get(item.id);
            if (!isEqual(originalItem, item)) {
                updated.push(item);
            }
        } else {
            // New item
            added.push(item);
        }
    }

    // Remaining in removedIdSet are removed
    const removed = Array.from(removedIdSet);

    if (added.length === 0 && updated.length === 0 && removed.length === 0) {
        return null;
    }

    return {
        added,
        updated,
        removed
    };
}
