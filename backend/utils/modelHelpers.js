/**
 * Small helpers for model -> frontend formatting to reduce duplication
 */
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200";

function avatar(url) {
  return url || DEFAULT_AVATAR;
}

function idToString(id) {
  return id == null ? null : id.toString();
}

function mapImageUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  // support different property names used across models
  return img.ImageUrl || img.url || img.image_url || null;
}

function truncate(text, max = 100) {
  if (!text) return '';
  return text.length <= max ? text : text.substring(0, max) + '...';
}

module.exports = {
  DEFAULT_AVATAR,
  avatar,
  idToString,
  mapImageUrl,
  truncate
};
