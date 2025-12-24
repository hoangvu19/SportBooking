const express = require('express');
const router = express.Router();
const {
  createPost,
  getFeedPosts,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost
} = require('../../controllers/Social/postController');
const { authenticateToken } = require('../../middleware/auth');
const { uploadPostMedia, uploadPostImages } = require('../../middleware/uploadPostMedia');

// Create new post (accept JSON or multipart/form-data with files under 'media' or 'images')
// We attach both upload handlers; only one will populate req.files depending on field name.
router.post('/', authenticateToken, (req, res, next) => {
  // run the multer handlers in sequence: try 'media' first, then 'images'
  uploadPostMedia(req, res, (err) => {
    if (err && err.code !== 'LIMIT_UNEXPECTED_FILE') return next(err);
    // if files already present or no error, continue
    if (req.files && req.files.length > 0) return next();
    // else try images field
    uploadPostImages(req, res, (err2) => {
      if (err2) return next(err2);
      return next();
    });
  });
}, createPost);

// Get feed posts
router.get('/feed', getFeedPosts);

// Get user posts
router.get('/user/:userId', getUserPosts);

// Get single post
router.get('/:postId', getPostById);

// Update post
router.put('/:postId', authenticateToken, updatePost);

// Delete post
router.delete('/:postId', authenticateToken, deletePost);

module.exports = router;
