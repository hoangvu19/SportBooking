const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Dev-only: list uploaded comment images
router.get('/comments', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'comments');
    if (!fs.existsSync(uploadsDir)) return res.status(200).json({ success: true, files: [] });

    const files = fs.readdirSync(uploadsDir)
      .filter(f => !!f)
      .map(f => ({ filename: f, url: `/uploads/comments/${f}` }));

    return res.json({ success: true, files });
  } catch (error) {
    console.error('Debug upload list error:', error);
    return res.status(500).json({ success: false, message: 'Could not list uploads', error: error.message });
  }
});

module.exports = router;
