export function getAvatar(obj) {
  if (!obj) return '';
  return (
    obj.avatar ||
    obj.avatarUrl ||
    obj.avatarURL ||
    obj.AvatarUrl ||
    obj.profile_picture ||
    obj.profilePicture ||
    obj.profileImage ||
    obj.ProfilePictureURL ||
    obj.ProfileUrl ||
    obj.picture ||
    ''
  );
}

export default getAvatar;
