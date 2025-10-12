function avatar(url) {
  return url || null;
}

function idToString(id) {
  return id == null ? null : id.toString();
}

function mapImageUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  return img.ImageUrl || img.url || img.image_url || null;
}

function truncate(text, max = 100) {
  if (!text) return '';
  return text.length <= max ? text : text.substring(0, max) + '...';
}

module.exports = {
  avatar,
  idToString,
  mapImageUrl,
  truncate
};
