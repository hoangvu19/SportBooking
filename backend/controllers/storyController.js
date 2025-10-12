/**
 * Story Controller
 * Handles all story-related operations
 */
const StoryDAL = require('../DAL/StoryDAL');
const StoryViewDAL = require('../DAL/StoryViewDAL');
const path = require('path');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized
} = require('../utils/responseHelper');
const {
  isBlank,
  getAccountId,
  ensurePositiveInteger
} = require('../utils/requestUtils');
const { toAbsoluteUrl } = require('../utils/requestUtils');

/**
 * Create a new story
 */
async function createStory(req, res) {
  try {
    const { content, backgroundColor } = req.body || {};
    const file = req.file; // From multer middleware

    // Validate: must have content or file
    if (isBlank(content) && !file) {
      return sendValidationError(res, 'Story phải có nội dung hoặc media');
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res, 'Không xác định được người dùng');
    }

    // Determine media type and URL from uploaded file
    let mediaUrl = null;
    let mediaType = 'text';
    
    if (file) {
      // Save relative path from uploads folder
      mediaUrl = `/uploads/stories/${file.filename}`;
      
      // Determine media type from mimetype
      if (file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      }
    }

    const story = await StoryDAL.create({
      AccountID: accountId,
      Content: content?.trim() || null,
      MediaUrl: mediaUrl,
      MediaType: mediaType,
      BackgroundColor: backgroundColor || '#4f46e5'
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const formatted = story.toFrontendFormat();
    
    // Convert media URL to absolute if needed
    if (formatted.media_url) {
      formatted.media_url = toAbsoluteUrl(baseUrl, formatted.media_url);
    }

    return sendCreated(res, formatted, 'Tạo story thành công');
  } catch (error) {
    console.error('Create story error:', error);
    return sendError(res, 'Lỗi server khi tạo story', 500, { error });
  }
}

/**
 * Get all active stories
 */
async function getActiveStories(req, res) {
  try {
    const stories = await StoryDAL.getActiveStories();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const formattedStories = stories.map((story) => {
      const formatted = story.toFrontendFormat();
      if (formatted.media_url) {
        formatted.media_url = toAbsoluteUrl(baseUrl, formatted.media_url);
      }
      return formatted;
    });

    return sendSuccess(res, { stories: formattedStories });
  } catch (error) {
    console.error('Get active stories error:', error);
    return sendError(res, 'Lỗi server khi lấy stories', 500, { error });
  }
}

/**
 * Get stories by user ID
 */
async function getUserStories(req, res) {
  try {
    const { userId } = req.params;
    const idCheck = ensurePositiveInteger(userId, 'userId');

    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const stories = await StoryDAL.getByUserId(idCheck.value);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const formattedStories = stories.map((story) => {
      const formatted = story.toFrontendFormat();
      if (formatted.media_url) {
        formatted.media_url = toAbsoluteUrl(baseUrl, formatted.media_url);
      }
      return formatted;
    });

    return sendSuccess(res, { stories: formattedStories });
  } catch (error) {
    console.error('Get user stories error:', error);
    return sendError(res, 'Lỗi server khi lấy stories của người dùng', 500, { error });
  }
}

/**
 * Delete story
 */
async function deleteStory(req, res) {
  try {
    const { storyId } = req.params;
    const idCheck = ensurePositiveInteger(storyId, 'storyId');
    
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const story = await StoryDAL.getById(idCheck.value);
    if (!story) {
      return sendNotFound(res, 'Story không tồn tại');
    }

    if (parseInt(story.AccountID, 10) !== parseInt(accountId, 10)) {
      return sendUnauthorized(res, 'Bạn không có quyền xóa story này');
    }

    await StoryDAL.delete(idCheck.value);

    return sendSuccess(res, null, 'Xóa story thành công');
  } catch (error) {
    console.error('Delete story error:', error);
    return sendError(res, 'Lỗi server khi xóa story', 500, { error });
  }
}

/**
 * Record a story view (track who viewed)
 */
async function viewStory(req, res) {
  try {
    const { storyId } = req.params;
    const idCheck = ensurePositiveInteger(storyId, 'storyId');
    
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res, 'Phải đăng nhập để xem story');
    }

    // Record the view in StoryView table
    await StoryViewDAL.recordView(idCheck.value, accountId);

    return sendSuccess(res, null, 'View recorded');
  } catch (error) {
    console.error('View story error:', error);
    return sendError(res, 'Lỗi server khi ghi nhận lượt xem', 500, { error });
  }
}

/**
 * Get list of viewers for a story (who viewed this story)
 */
async function getStoryViewers(req, res) {
  try {
    const { storyId } = req.params;
    const idCheck = ensurePositiveInteger(storyId, 'storyId');
    
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    // Check if story exists and belongs to the user
    const story = await StoryDAL.getById(idCheck.value);
    if (!story) {
      return sendNotFound(res, 'Story không tồn tại');
    }

    if (parseInt(story.AccountID, 10) !== parseInt(accountId, 10)) {
      return sendUnauthorized(res, 'Chỉ chủ story mới xem được danh sách người xem');
    }

    // Get viewers
    const viewers = await StoryViewDAL.getStoryViewers(idCheck.value);
    const formattedViewers = viewers.map(viewer => viewer.toFrontendFormat());

    return sendSuccess(res, {
      viewers: formattedViewers,
      count: formattedViewers.length
    });
  } catch (error) {
    console.error('Get story viewers error:', error);
    return sendError(res, 'Lỗi server khi lấy danh sách người xem', 500, { error });
  }
}

/**
 * Get view count for a story
 */
async function getStoryViewCount(req, res) {
  try {
    const { storyId } = req.params;
    const idCheck = ensurePositiveInteger(storyId, 'storyId');
    
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const count = await StoryViewDAL.getViewCount(idCheck.value);

    return sendSuccess(res, { view_count: count });
  } catch (error) {
    console.error('Get story view count error:', error);
    return sendError(res, 'Lỗi server khi lấy số lượt xem', 500, { error });
  }
}

module.exports = {
  createStory,
  getActiveStories,
  getUserStories,
  deleteStory,
  viewStory,
  getStoryViewers,
  getStoryViewCount
};
