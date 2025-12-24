function avatar(url) {
  return url || null;
}

function idToString(id) {
  return id == null ? null : id.toString();
}

function mapImageUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  // Support unified MediaAsset rows (URL or Data), legacy shapes, and different casings
  return img.URL || img.url || img.ImageUrl || img.image_url || img.Data || img.ImageData || null;
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
