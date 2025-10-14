const Post = require('../models/Social/Post');
const { toAbsoluteUrl } = require('./requestUtils');

const VALID_REACTIONS = ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry'];
const REACTION_TYPE_MAP = VALID_REACTIONS.reduce((acc, type) => {
  acc[type.toLowerCase()] = type;
  return acc;
}, {});

function buildBaseUrl(req) {
  if (!req || typeof req.get !== 'function') {
    return '';
  }

  return `${req.protocol}://${req.get('host')}`;
}

function buildPaginationMeta(count, limit, page) {
  return {
    page,
    limit,
    hasMore: count === limit
  };
}

function formatPostForResponse(post, baseUrl) {
  if (!post) {
    return null;
  }

  const formatted = post instanceof Post ? post.toFrontendFormat() : post;

  if (Array.isArray(formatted.image_urls)) {
    formatted.image_urls = formatted.image_urls.map((url) => toAbsoluteUrl(baseUrl, url));
  }

  if (formatted?.user?.profile_picture) {
    formatted.user.profile_picture = toAbsoluteUrl(baseUrl, formatted.user.profile_picture);
  }

  if (formatted.shared_post && formatted.shared_post !== formatted) {
    formatted.shared_post = formatPostForResponse(formatted.shared_post, baseUrl);
  }

  return formatted;
}

function formatCommentForResponse(comment, baseUrl) {
  if (!comment) {
    return null;
  }

  const formatted = typeof comment.toFrontendFormat === 'function'
    ? comment.toFrontendFormat()
    : comment;

  if (Array.isArray(formatted.images)) {
    formatted.images = formatted.images.map((url) => toAbsoluteUrl(baseUrl, url));
  }

  if (formatted?.user?.profile_picture) {
    formatted.user.profile_picture = toAbsoluteUrl(baseUrl, formatted.user.profile_picture);
  }

  return formatted;
}

function normalizeReactionType(reactionType) {
  if (!reactionType || typeof reactionType !== 'string') {
    return null;
  }

  const normalized = reactionType.trim().toLowerCase();
  return REACTION_TYPE_MAP[normalized] || null;
}

module.exports = {
  buildBaseUrl,
  buildPaginationMeta,
  formatPostForResponse,
  formatCommentForResponse,
  normalizeReactionType
};
