// Utilities to normalize and detect availability/maintenance/unavailable tokens
export function normalizeToken(s) {
  if (!s && s !== 0) return '';
  return String(s).toString().trim().toLowerCase();
}

export function isUnavailableToken(s) {
  const v = normalizeToken(s);
  if (!v) return false;
  return v === 'unavailable' || v.includes('unavail') || v.includes('không') || v.includes('not available');
}

export function isMaintenanceToken(s) {
  const v = normalizeToken(s);
  if (!v) return false;
  return v === 'maintenance' || v.includes('maintenance') || v.includes('bảo trì') || v.includes('maintain');
}

export function isAvailableToken(s) {
  const v = normalizeToken(s);
  // treat empty/zero as available in some legacy payloads
  if (v === '' || v === '0' || v === 'trong') return true;
  if (isUnavailableToken(v) || isMaintenanceToken(v)) return false;
  return v === 'available' || /\bavailable\b/.test(v) || v.includes('còn trống') || v.includes('free');
}

// Determine canonical status for a single sport field object
export function determineFieldStatus(sf) {
  if (!sf) return 'available';
  const s = sf.Status || sf.TrangThai || sf.StatusName || sf.TrangThaiName || sf.status || sf;
  if (isAvailableToken(s)) return 'available';
  if (isMaintenanceToken(s)) return 'maintenance';
  if (isUnavailableToken(s)) return 'unavailable';
  return 'available';
}

// Determine facility-level status code from an array of sportFields
export function determineStatusCodeFromFields(sfs, fallback) {
  try {
    if (!Array.isArray(sfs) || sfs.length === 0) return normalizeToken(fallback || 'available') || 'available';
    const normalized = sfs.map(sf => normalizeToken(sf.Status || sf.TrangThai || sf.StatusName || sf.TrangThaiName || sf.status || ''));
    // If any area is explicitly available -> facility is available
    if (normalized.some(s => isAvailableToken(s))) return 'available';
    if (normalized.some(s => isMaintenanceToken(s))) return 'maintenance';
    if (normalized.some(s => isUnavailableToken(s))) return 'unavailable';
  } catch { /* ignore */ }
  return normalizeToken(fallback || 'available') || 'available';
}

export default {
  normalizeToken,
  isAvailableToken,
  isMaintenanceToken,
  isUnavailableToken,
  determineFieldStatus,
  determineStatusCodeFromFields
};
