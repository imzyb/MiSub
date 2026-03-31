/**
 * Apply diff patches to an array of items
 * @param {Array} originalItems - The original array
 * @param {Object} diff - The diff object { added: [], updated: [], removed: [] }
 * @returns {Array} The new array with patches applied
 */
export function applyPatch(originalItems = [], diff = {}) {
    if (!diff) return originalItems;

    const { added = [], updated = [], removed = [] } = diff;
    let newItems = [...originalItems];

    // 1. Remove items
    if (removed.length > 0) {
        const removedIds = new Set(removed);
        newItems = newItems.filter(item => !removedIds.has(item.id));
    }

    // 2. Update items
    if (updated.length > 0) {
        // Create a map for faster lookup
        const updatesMap = new Map(updated.map(item => [item.id, item]));
        newItems = newItems.map(item => {
            if (updatesMap.has(item.id)) {
                // Merge existing item with updates
                // Note: This assumes 'updated' contains the FULL item or partial updates?
                // Usually safe to assume full item replacement for 'updated' based on frontend logic, 
                // but let's do a merge to be safe if only partial fields sent.
                return { ...item, ...updatesMap.get(item.id) };
            }
            return item;
        });
    }

    // 3. Add items
    if (added.length > 0) {
        // Filter out any that might already exist to prevent duplicates if ID conflict
        const existingIds = new Set(newItems.map(i => i.id));
        const validAdds = added.filter(item => !existingIds.has(item.id));
        newItems = [...newItems, ...validAdds];
    }

    return newItems;
}
