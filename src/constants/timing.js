/**
 * Timing-related constants shared across the app.
 */

export const TIMING = {
    SECOND_IN_MS: 1000,
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
    REQUEST_TIMEOUT_MS: 30 * 1000, // 30 seconds
    AUTO_UPDATE_INTERVAL_MS: 30 * 60 * 1000, // 30 minutes
    TOAST_DURATION_MS: 3000, // 3 seconds (fallback default)
    TOAST_DURATION_SUCCESS: 2500,
    TOAST_DURATION_ERROR: 5000,
    TOAST_DURATION_WARNING: 4000,
    TOAST_MAX_VISIBLE: 3, // max simultaneous toasts
    PWA_CHECK_INTERVAL_MS: 30 * 1000 // 30 seconds (reserved)
};
