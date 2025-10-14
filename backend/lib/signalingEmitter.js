let namespaceRef = null;

function setNamespace(ns) {
  namespaceRef = ns;
}

function emitToRoom(room, payload) {
  if (!namespaceRef) return false;
  try {
    namespaceRef.to(room).emit('livestream-comment', payload);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { setNamespace, emitToRoom };
