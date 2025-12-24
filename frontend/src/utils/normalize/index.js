export { default as getPhone } from './phone';
export { getId } from './id';
export { getAvatar } from './avatar';
export { getField, getUsername, getRoles, getAddress, getAreaId, getAreaName, getTimestamps, getLastLogin, getDOB, getSocialLinks } from './fields';
export { default as normalizeUser } from './user';

export default {
  getPhone: (obj) => (obj ? obj.phone || obj.Phone || '' : ''),
};
