import getPhone from './phone';
import { getField, getUsername, getRoles, getAddress, getAreaId, getAreaName, getTimestamps, getLastLogin, getDOB, getSocialLinks } from './fields';
import getId from './id';
import getAvatar from './avatar';

export function normalizeUser(raw) {
  if (!raw) return null;
  const user = typeof raw === 'object' ? raw : { raw };

  const id = getId(user) || getField(user, 'Id', 'ID');
  const username = getUsername(user) || getField(user, 'user_name', 'User_Name');
  const fullName = getField(user, 'fullName', 'FullName', 'Full_Name', 'name', 'Name') || username;
  const email = getField(user, 'email', 'Email', 'userEmail', 'UserEmail');
  const phone = getPhone(user) || getField(user, 'phone', 'Phone');
  const avatar = getAvatar(user);
  const gender = getField(user, 'gender', 'Gender', 'sex');
  const status = getField(user, 'status', 'Status', 'state');
  const roles = getRoles(user);
  const address = getAddress(user);
  const areaId = getAreaId(user);
  const areaName = getAreaName(user);
  const { createdAt, updatedAt } = getTimestamps(user);
  const lastLogin = getLastLogin(user);
  const dob = getDOB(user);
  const social = getSocialLinks(user);

  return {
    id,
    username,
    fullName,
    email,
    phone,
    avatar,
    gender,
    status,
    roles,
    address,
    areaId,
    areaName,
    createdAt,
    updatedAt,
    lastLogin,
    dob,
    social,
    raw
  };
}

export default normalizeUser;
