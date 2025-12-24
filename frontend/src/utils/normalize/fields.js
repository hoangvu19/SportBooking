// Generic field helpers and small related getters
export function getField(obj, ...keys) {
  if (!obj) return '';
  if (typeof obj === 'string' && keys.length === 0) return obj;
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return '';
}

export function getUsername(obj) {
  return getField(obj, 'username', 'userName', 'UserName', 'user', 'name');
}

export function getRoles(obj) {
  if (!obj) return [];
  const r = obj.roles || obj.Roles || obj.role || obj.Role || '';
  if (Array.isArray(r)) return r;
  if (typeof r === 'string') return r.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

export function getAddress(obj) {
  return getField(obj, 'address', 'Address', 'location', 'Location');
}

export function getAreaId(obj) {
  return getField(obj, 'areaId', 'AreaID', 'AreaId', 'area_id', 'area');
}

export function getAreaName(obj) {
  return getField(obj, 'areaName', 'AreaName', 'areaName', 'area_name');
}

export function getTimestamps(obj) {
  if (!obj) return { createdAt: '', updatedAt: '' };
  return {
    createdAt: getField(obj, 'createdAt', 'CreatedAt', 'created_at', 'Created_at', 'created'),
    updatedAt: getField(obj, 'updatedAt', 'UpdatedAt', 'updated_at', 'Updated_at', 'modified')
  };
}

export function getLastLogin(obj) {
  return getField(obj, 'lastLogin', 'last_login', 'LastLogin', 'Last_login', 'last_seen');
}

export function getDOB(obj) {
  return getField(obj, 'dob', 'DOB', 'dateOfBirth', 'date_of_birth');
}

export function getSocialLinks(obj) {
  if (!obj) return {};
  return {
    facebook: getField(obj, 'facebook', 'fb', 'facebookUrl', 'facebook_url'),
    instagram: getField(obj, 'instagram', 'insta', 'instagramUrl', 'instagram_url'),
    zalo: getField(obj, 'zalo') || getField(obj, 'Zalo')
  };
}

export default {
  getField,
  getUsername,
  getRoles,
  getAddress,
  getAreaId,
  getAreaName,
  getTimestamps,
  getLastLogin,
  getDOB,
  getSocialLinks
};
