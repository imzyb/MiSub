/**
 * Shared utility helpers used across frontend and backend.
 */

/**
 * Format a byte size into a human readable string.
 * @param {number} bytes - Byte size.
 * @param {number} decimals - Decimal places.
 * @returns {string} Formatted size string.
 */
export function formatBytes(bytes, decimals = 2) {
    if (!+bytes || bytes < 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
