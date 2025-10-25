// pendingRegisterCache stub: activation flow removed
// Keep API surface to avoid requiring changes elsewhere; functions are no-ops.

const setPendingRegistration = async () => true;
const getAndDeletePendingRegistration = async () => null;
const getTokenByEmail = async () => null;
const deletePendingByEmail = async () => true;

module.exports = {
  setPendingRegistration,
  getAndDeletePendingRegistration,
  getTokenByEmail,
  deletePendingByEmail
};
