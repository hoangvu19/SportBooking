// VN timezone helpers for client-side date formatting
// Use Intl with Asia/Ho_Chi_Minh timezone when available.
export function getVnIsoDate(d = new Date()) {
  try {
    // format as YYYY-MM-DD in VN timezone
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value || String(d.getFullYear());
    const month = parts.find(p => p.type === 'month')?.value || String(d.getMonth() + 1).padStart(2, '0');
    const day = parts.find(p => p.type === 'day')?.value || String(d.getDate()).padStart(2, '0');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch {
    // Fallback: compute using timezone offset for Ho Chi Minh (UTC+7)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const vn = new Date(utc + 7 * 60 * 60000);
    const y = vn.getFullYear();
    const m = String(vn.getMonth() + 1).padStart(2, '0');
    const day = String(vn.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

export function formatVnDate(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  } catch {
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const vn = new Date(utc + 7 * 60 * 60000);
    return vn.toLocaleDateString('vi-VN');
  }
}

export function formatVnDateTime(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  } catch {
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const vn = new Date(utc + 7 * 60 * 60000);
    return vn.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
}

export function formatVnTime(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const vn = new Date(utc + 7 * 60 * 60000);
    return vn.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
}

// Parse a server-provided datetime string and interpret it as VN-local when no offset is present.
// If the string already contains a timezone offset or 'Z', return new Date(raw). Otherwise append +07:00.
export function parseServerDatetime(raw) {
  if (!raw) return null;
  try {
    const s = String(raw).trim();
    if (s.endsWith('Z') || /[+-]\d\d:\d\d$/.test(s)) {
      return new Date(s);
    }
    // Append +07:00 so the Date constructor treats it as VN-local time
    return new Date(s + '+07:00');
  } catch {
    return new Date(raw);
  }
}

export default { getVnIsoDate, formatVnDate, formatVnDateTime, formatVnTime };
