let namespaceRef = null;

function setNamespace(ns) {
  namespaceRef = ns;
}

function getIo() {
  return namespaceRef;
}

function emitEvent(eventName, room, payload) {
  if (!namespaceRef) return false;
  try {
    if (room) namespaceRef.to(room).emit(eventName, payload);
    else namespaceRef.emit(eventName, payload);
    return true;
  } catch (e) {
    console.error('realtimeEmitter emit failed', e && e.message);
    return false;
  }
}

module.exports = { setNamespace, getIo, emitEvent };
