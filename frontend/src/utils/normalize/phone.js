// Helpers for phone-related normalization
export function getPhone(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return (
    obj.phone ||
    obj.Phone ||
    obj.phoneNumber ||
    obj.PhoneNumber ||
    obj.mobile ||
    obj.Mobile ||
    obj.telephone ||
    obj.telephoneNumber ||
    obj.tel ||
    obj.msisdn ||
    ''
  );
}

export default getPhone;
