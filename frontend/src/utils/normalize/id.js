export function getId(obj) {
  if (!obj) return '';
  return (
    obj.id || obj._id || obj.ID || obj.userId || obj.UserId || obj.IDUser || ''
  );
}

export default getId;
