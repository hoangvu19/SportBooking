/**
 * Vietnam timezone helpers (Asia/Ho_Chi_Minh)
 * Provides VN-local ISO timestamps and date strings without adding new dependencies.
 */
function toVnIso(date = new Date()) {
  try {
    const opts = {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    // sv-SE formatting produces YYYY-MM-DD HH:mm:ss which is convenient
    const formatted = new Intl.DateTimeFormat('sv-SE', opts).format(date); // 'YYYY-MM-DD HH:mm:ss'
    return formatted.replace(' ', 'T') + '+07:00';
  } catch (e) {
    // Fallback to UTC ISO but marked with +07:00
    const d = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D}T${hh}:${mm}:${ss}+07:00`;
  }
}

function toVnDateString(date = new Date()) {
  try {
    const opts = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatted = new Intl.DateTimeFormat('sv-SE', opts).format(date); // 'YYYY-MM-DD'
    return formatted.split(' ')[0];
  } catch (e) {
    const d = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    return `${Y}-${M}-${D}`;
  }
}

module.exports = {
  toVnIso,
  toVnDateString
};
