export function generateId(prefix = '') {
  let uuid;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else {
    // Fallback for non-secure contexts (e.g. HTTP LAN access)
    // crypto.randomUUID requires a Secure Context (HTTPS/Localhost)
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function generateNodeId() {
  return generateId('node');
}

export function generateProfileId() {
  return generateId();
}

export function generateSubscriptionId() {
  return generateId('sub');
}
