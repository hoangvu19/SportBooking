/**
 * Text Analysis Utilities
 * Phân tích văn bản cho moderation và recommendation
 */

class TextAnalyzer {
  /**
   * Tính tỷ lệ chữ hoa (ALL CAPS detection)
   */
  static getCapsRatio(text) {
    const letters = text.replace(/[^a-zA-ZÀ-ỹ]/g, '');
    if (letters.length === 0) return 0;
    
    const upperCount = (text.match(/[A-ZÀ-Ý]/g) || []).length;
    return upperCount / letters.length;
  }

  /**
   * Tính tỷ lệ emoji
   */
  static getEmojiRatio(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojis = text.match(emojiRegex) || [];
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 0;
    return emojis.length / totalChars;
  }

  /**
   * Đếm số lượng URLs trong text
   */
  static countUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex) || [];
    return matches.length;
  }

  /**
   * Đếm số lượng số điện thoại
   */
  static countPhoneNumbers(text) {
    const phoneRegex = /(\+84|0)[0-9]{9,10}/g;
    const matches = text.match(phoneRegex) || [];
    return matches.length;
  }

  /**
   * Phát hiện ký tự lặp lại quá nhiều
   */
  static hasExcessiveRepetition(text, minRepeat = 5) {
    const regex = new RegExp(`(.)\\1{${minRepeat},}`, 'gi');
    return regex.test(text);
  }

  /**
   * Tính điểm chất lượng văn bản (0-1)
   */
  static getTextQualityScore(text) {
    if (!text || text.trim().length === 0) return 0;

    let score = 1.0;
    const trimmed = text.trim();

    // Độ dài văn bản
    if (trimmed.length < 10) {
      score -= 0.2; // Quá ngắn
    } else if (trimmed.length > 2000) {
      score -= 0.1; // Quá dài
    }

    // Caps ratio
    const capsRatio = this.getCapsRatio(trimmed);
    if (capsRatio > 0.7) {
      score -= 0.2; // Quá nhiều chữ hoa
    }

    // Emoji ratio
    const emojiRatio = this.getEmojiRatio(trimmed);
    if (emojiRatio > 0.3) {
      score -= 0.15; // Quá nhiều emoji
    }

    // URL spam
    const urlCount = this.countUrls(trimmed);
    if (urlCount >= 3) {
      score -= 0.3;
    } else if (urlCount >= 2) {
      score -= 0.15;
    }

    // Phone numbers
    const phoneCount = this.countPhoneNumbers(trimmed);
    if (phoneCount > 0) {
      score -= 0.1 * phoneCount;
    }

    // Excessive repetition
    if (this.hasExcessiveRepetition(trimmed, 5)) {
      score -= 0.2;
    }

    // Tỷ lệ khoảng trắng
    const whitespaceRatio = (trimmed.match(/\s/g) || []).length / trimmed.length;
    if (whitespaceRatio > 0.4) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Trích xuất từ khóa chính từ text
   */
  static extractKeywords(text, topN = 5) {
    // Remove stopwords và tính tần suất
    const stopwords = new Set([
      'và', 'của', 'là', 'có', 'được', 'một', 'các', 'cho', 'với', 'để',
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were'
    ]);

    const words = text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));

    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);
  }

  /**
   * Tính độ tương đồng giữa 2 text (Jaccard similarity)
   */
  static getSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Normalize văn bản (loại bỏ dấu, lowercase)
   */
  static normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
      .trim();
  }

  /**
   * Loại bỏ khoảng trắng và ký tự đặc biệt giữa các chữ cái
   * VD: "c á i  l ồ n" -> "cailon"
   *     "đ.ụ m_ẹ" -> "đụmẹ"
   */
  static removeSpacesAndSpecialChars(text) {
    // Loại bỏ mọi ký tự không phải chữ cái (giữ lại cả tiếng Việt có dấu)
    return text.replace(/[^\p{L}]/gu, '').toLowerCase();
  }

  /**
   * Tạo nhiều biến thể của text để detect spam bypass
   * Bao gồm: text gốc, không dấu, không space, kết hợp
   */
  static generateVariants(text) {
    const variants = new Set();
    
    // 1. Text gốc
    variants.add(text.toLowerCase());
    
    // 2. Loại bỏ khoảng trắng
    variants.add(text.replace(/\s+/g, '').toLowerCase());
    
    // 3. Loại bỏ tất cả ký tự đặc biệt
    variants.add(this.removeSpacesAndSpecialChars(text));
    
    // 4. Loại bỏ dấu (normalize NFD)
    const noDiacritics = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    variants.add(noDiacritics);
    
    // 5. Loại bỏ dấu + không space
    variants.add(noDiacritics.replace(/\s+/g, ''));
    
    // 6. Loại bỏ dấu + không ký tự đặc biệt
    variants.add(this.removeSpacesAndSpecialChars(noDiacritics));
    
    return Array.from(variants);
  }

  /**
   * Kiểm tra xem text có chứa keyword với các biến thể bypass không
   */
  static containsKeywordVariant(text, keyword) {
    const textVariants = this.generateVariants(text);
    const keywordVariants = this.generateVariants(keyword);
    
    // Check từng biến thể của text với từng biến thể của keyword
    for (const textVariant of textVariants) {
      for (const keywordVariant of keywordVariants) {
        if (textVariant.includes(keywordVariant)) {
          return true;
        }
      }
    }
    
    return false;
  }
}

module.exports = TextAnalyzer;
