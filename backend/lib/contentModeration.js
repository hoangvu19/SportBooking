/**
 * AI Content Moderation Service
 * Kiểm tra và lọc spam/nội dung nhạy cảm
 */

class ContentModerationService {
  constructor() {
    // Danh sách từ khóa nhạy cảm (tiếng Việt)
    this.sensitiveKeywords = [
      'lừa đảo', 'scam', 'lua dao',
      'sex', 'porn', 'khiêu dâm', 
      'chửi thề', 'dm', 'dcm', 'vl', 'cl',
      'cờ bạc', 'casino', 'gambling',
      'ma túy', 'ma tuy', 'drugs',
      'chính trị', 'chinh tri',
      'bạo lực', 'bao luc', 'violence'
    ];

    // Pattern spam
    this.spamPatterns = [
      /(.)\1{4,}/gi, // Lặp ký tự 5 lần trở lên (ví dụ: aaaaaa)
      /(https?:\/\/[^\s]+){3,}/gi, // 3 link trở lên
      /(\d{10,})/g, // Số điện thoại
      /(inbox|zalo|telegram|whatsapp)/gi, // Từ khóa liên hệ ngoài
      /(mua|bán|sale|giảm giá|khuyến mãi).{0,20}(inbox|liên hệ|hotline)/gi
    ];

    // Confidence thresholds
    this.thresholds = {
      spam: 0.6,
      sensitive: 0.7,
      auto_reject: 0.9
    };
  }

  /**
   * Kiểm tra nội dung
   * @returns {Object} { isClean, confidence, reason, needsReview }
   */
  async moderateContent(content, images = []) {
    const results = {
      isClean: true,
      confidence: 1.0,
      reason: null,
      needsReview: false,
      flags: []
    };

    if (!content || content.trim().length === 0) {
      if (images.length === 0) {
        results.isClean = false;
        results.reason = 'Empty content';
        return results;
      }
      return results; // Only images present - allow for now
    }

    // 1. Kiểm tra từ khóa nhạy cảm
    const sensitiveCheck = this.checkSensitiveContent(content);
    if (sensitiveCheck.found) {
      results.flags.push('sensitive_keywords');
      results.confidence -= 0.3;
      
      if (sensitiveCheck.confidence >= this.thresholds.auto_reject) {
        results.isClean = false;
        results.reason = 'Content contains sensitive keywords';
        return results;
      }
      
      if (sensitiveCheck.confidence >= this.thresholds.sensitive) {
        results.needsReview = true;
        results.reason = 'Suspected sensitive content, requires admin review';
      }
    }

    // 2. Kiểm tra spam
    const spamCheck = this.checkSpamPattern(content);
    if (spamCheck.isSpam) {
      results.flags.push('spam_pattern');
      results.confidence -= 0.4;
      
      if (spamCheck.confidence >= this.thresholds.auto_reject) {
        results.isClean = false;
        results.reason = 'Content appears to be spam';
        return results;
      }
      
      if (spamCheck.confidence >= this.thresholds.spam) {
        results.needsReview = true;
        results.reason = results.reason || 'Suspected spam, requires admin review';
      }
    }

    // 3. Kiểm tra độ dài bất thường
    if (content.length > 2000) {
      results.flags.push('too_long');
      results.needsReview = true;
  results.reason = results.reason || 'Content too long, requires admin review';
    }

    // 4. Kiểm tra ALL CAPS
    const capsRatio = this.checkCapsRatio(content);
    if (capsRatio > 0.7) {
      results.flags.push('excessive_caps');
      results.confidence -= 0.1;
    }

    // 5. Kiểm tra emoji spam
    const emojiRatio = this.checkEmojiRatio(content);
    if (emojiRatio > 0.5) {
      results.flags.push('emoji_spam');
      results.confidence -= 0.1;
    }

    // Final decision
    if (results.confidence < this.thresholds.sensitive) {
      results.needsReview = true;
      if (!results.reason) {
        results.reason = 'Content suspected, requires admin review';
      }
    }

    if (results.confidence < 0.5) {
      results.isClean = false;
      results.reason = 'Content violates multiple rules';
    }

    return results;
  }

  /**
   * Kiểm tra từ khóa nhạy cảm
   */
  checkSensitiveContent(content) {
    const lowerContent = content.toLowerCase();
    const foundKeywords = [];
    
    for (const keyword of this.sensitiveKeywords) {
      if (lowerContent.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    return {
      found: foundKeywords.length > 0,
      keywords: foundKeywords,
      confidence: Math.min(0.3 * foundKeywords.length, 1.0)
    };
  }

  /**
   * Kiểm tra pattern spam
   */
  checkSpamPattern(content) {
    let spamScore = 0;
    const matchedPatterns = [];

    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        spamScore += 0.25;
        matchedPatterns.push(pattern.toString());
      }
    }

    return {
      isSpam: spamScore > 0,
      patterns: matchedPatterns,
      confidence: Math.min(spamScore, 1.0)
    };
  }

  /**
   * Kiểm tra tỷ lệ chữ hoa
   */
  checkCapsRatio(content) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;
    
    const upperCount = (content.match(/[A-Z]/g) || []).length;
    return upperCount / letters.length;
  }

  /**
   * Kiểm tra tỷ lệ emoji
   */
  checkEmojiRatio(content) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojis = content.match(emojiRegex) || [];
    const totalChars = content.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 0;
    return emojis.length / totalChars;
  }

  /**
   * Kiểm tra hình ảnh (placeholder - cần tích hợp API thực tế)
   */
  async moderateImage(imageUrl) {
    // TODO: Tích hợp với service như Google Cloud Vision API, 
    // AWS Rekognition, hoặc Azure Content Moderator
    
    // Placeholder response
    return {
      isClean: true,
      confidence: 1.0,
      labels: [],
      needsReview: false
    };
  }

  /**
   * Kiểm tra toàn bộ bài đăng (nội dung + ảnh)
   */
  async moderatePost(content, imageUrls = []) {
    // Kiểm tra nội dung text
    const contentResult = await this.moderateContent(content, imageUrls);

    // Nếu nội dung text đã bị reject thì không cần kiểm tra ảnh
    if (!contentResult.isClean && !contentResult.needsReview) {
      return contentResult;
    }

    // Kiểm tra từng ảnh (nếu có)
    if (imageUrls && imageUrls.length > 0) {
      const imageResults = await Promise.all(
        imageUrls.map(url => this.moderateImage(url))
      );

      const flaggedImages = imageResults.filter(r => !r.isClean);
      if (flaggedImages.length > 0) {
        contentResult.flags.push('flagged_images');
        contentResult.needsReview = true;
        contentResult.reason = 'Image flagged, requires admin review';
      }
    }

    return contentResult;
  }

  /**
   * Thêm từ khóa nhạy cảm
   */
  addSensitiveKeyword(keyword) {
    if (!this.sensitiveKeywords.includes(keyword.toLowerCase())) {
      this.sensitiveKeywords.push(keyword.toLowerCase());
      return true;
    }
    return false;
  }

  /**
   * Xóa từ khóa nhạy cảm
   */
  removeSensitiveKeyword(keyword) {
    const index = this.sensitiveKeywords.indexOf(keyword.toLowerCase());
    if (index > -1) {
      this.sensitiveKeywords.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Lấy danh sách từ khóa nhạy cảm
   */
  getSensitiveKeywords() {
    return [...this.sensitiveKeywords];
  }
}

// Singleton instance
const moderationService = new ContentModerationService();

module.exports = moderationService;
