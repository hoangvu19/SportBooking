const PostDAL = require('../DAL/Social/PostDAL');

/**
 * Debug controller: resolve shared_post ancestry for a given post id
 * Returns chain of post ids and the resolved booking-origin post (if any)
 */
async function resolveShared(req, res) {
  try {
    const raw = req.params.postId;
    const postId = parseInt(raw, 10);
    if (!postId || isNaN(postId)) return res.status(400).json({ success: false, message: 'Invalid postId' });

    // Resolve chain iteratively to avoid deep recursion
    const chain = [];
    let currentId = postId;
    const maxDepth = 10;
    let depth = 0;
    let bookingOrigin = null;

    while (currentId && depth < maxDepth) {
      const p = await PostDAL.getById(currentId, false);
      if (!p) break;
      chain.push({ id: currentId, isShare: !!p.IsShare, sharedFrom: p.SharedFromPostID || null, hasBooking: !!p.Booking });

      // Check for booking on this post
      if (p.Booking) {
        bookingOrigin = { id: currentId, booking: p.Booking };
        break;
      }

      if (!p.IsShare || !p.SharedFromPostID) break;
      currentId = p.SharedFromPostID;
      depth += 1;
    }

    return res.json({ success: true, postId, chain, bookingOrigin });
  } catch (err) {
    console.error('debug.resolveShared error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

module.exports = {
  resolveShared
};
