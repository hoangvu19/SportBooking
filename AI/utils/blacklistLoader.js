/**
 * Blacklist Loader
 * Module để load và parse file blacklist.txt
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class BlacklistLoader {
  constructor() {
    this.blacklist = {
      highSeverity: [],
      mediumSeverity: [],
      lowSeverity: [],
      patterns: [],
      phonePatterns: [],
      urlPatterns: [],
      allKeywords: new Set()
    };
    
    this.whitelist = new Set();
    
    this.loaded = false;
    this.loadAttempts = 0;
    this.maxLoadAttempts = 3;
  }

  /**
   * Load blacklist từ file
   */
  async load(filePath) {
    if (this.loaded) {
      return this.blacklist;
    }

    this.loadAttempts++;
    
    try {
      // Load blacklist
      const fullPath = path.resolve(filePath);
      
      if (!fs.existsSync(fullPath)) {
        logger.warn(`Blacklist file not found: ${fullPath}`);
        return this.loadFallback();
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      this.parse(content);
      
      // Load whitelist
      const whitelistPath = fullPath.replace('blacklist.txt', 'whitelist.txt');
      if (fs.existsSync(whitelistPath)) {
        const whitelistContent = fs.readFileSync(whitelistPath, 'utf-8');
        this.parseWhitelist(whitelistContent);
      }
      
      this.loaded = true;
      
      return this.blacklist;
      
    } catch (error) {
      logger.error(`Error loading blacklist (attempt ${this.loadAttempts}/${this.maxLoadAttempts}):`, error);
      
      if (this.loadAttempts < this.maxLoadAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.load(filePath);
      } else {
        logger.warn('Max load attempts reached, using fallback keywords');
        return this.loadFallback();
      }
    }
  }

  /**
   * Parse whitelist file
   */
  parseWhitelist(content) {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines và comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // Add to whitelist
      this.whitelist.add(trimmed.toLowerCase());
    }
  }

  /**
   * Parse nội dung file blacklist
   */
  parse(content) {
    const lines = content.split('\n');
    let currentGroup = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines và comments
      if (!trimmed || trimmed.startsWith('#')) {
        // Detect nhóm từ comment
        if (trimmed.includes('Nhóm') && trimmed.includes(':')) {
          currentGroup = this.detectGroup(trimmed);
        }
        continue;
      }
      
      // Thêm keyword vào danh sách
      this.addKeyword(trimmed, currentGroup);
    }
  }

  /**
   * Detect nhóm từ comment line
   */
  detectGroup(commentLine) {
    const lower = commentLine.toLowerCase();
    
    // High severity groups
    if (lower.includes('tục tĩu') ||
        lower.includes('tục tệu') || 
        lower.includes('vulgar') ||
        lower.includes('tình dục') ||
        lower.includes('sexual') ||
        lower.includes('khiêu dâm') ||
        lower.includes('ma túy') ||
        lower.includes('chất cấm') ||
        lower.includes('vũ khí') ||
        lower.includes('bạo lực') ||
        lower.includes('violence')) {
      return 'high';
    }
    
    // Medium severity groups
    if (lower.includes('xúc phạm') ||
        lower.includes('gia đình') ||
        lower.includes('cờ bạc') ||
        lower.includes('casino') ||
        lower.includes('vay tiền') ||
        lower.includes('lừa đảo') ||
        lower.includes('scam') ||
        lower.includes('mlm') ||
        lower.includes('đa cấp')) {
      return 'medium';
    }
    
    // Patterns
    if (lower.includes('pattern') ||
        lower.includes('số điện thoại') ||
        lower.includes('phone') ||
        lower.includes('url')) {
      return 'pattern';
    }
    
    // Default: low severity
    return 'low';
  }

  /**
   * Add keyword vào blacklist
   */
  addKeyword(keyword, group) {
    // Skip nếu keyword quá ngắn (dưới 3 ký tự) TRỪ KHI là từ tục tĩu rõ ràng
    if (keyword.length < 3) {
      const explicitVulgar = ['dm', 'vl', 'cc', 'cl', 'cu', 'đm', 'đéo', 'đụ', 'địt', 'sex', 'xxx'];
      if (!explicitVulgar.includes(keyword.toLowerCase())) {
        return;
      }
    }
    
    const lower = keyword.toLowerCase();
    
    // Skip nếu từ này trong whitelist
    if (this.whitelist.has(lower)) {
      return;
    }
    
    // Thêm vào allKeywords
    this.blacklist.allKeywords.add(lower);
    
    // Phone pattern
    if (/^0\d{2,3}$/.test(keyword) || /^\d{9,11}$/.test(keyword)) {
      this.blacklist.phonePatterns.push(keyword);
      return;
    }
    
    // URL pattern
    if (keyword.includes('http') || 
        keyword.includes('www.') || 
        keyword.includes('.com') ||
        keyword.includes('.vn') ||
        keyword.includes('bit.ly')) {
      this.blacklist.urlPatterns.push(keyword);
      return;
    }
    
    // Emoji pattern
    if (/[\u{1F300}-\u{1F9FF}]/u.test(keyword)) {
      this.blacklist.patterns.push(keyword);
      return;
    }
    
    // Classify by severity
    if (group === 'high') {
      this.blacklist.highSeverity.push(lower);
    } else if (group === 'medium') {
      this.blacklist.mediumSeverity.push(lower);
    } else if (group === 'pattern') {
      this.blacklist.patterns.push(lower);
    } else {
      this.blacklist.lowSeverity.push(lower);
    }
  }

  /**
   * Load fallback keywords nếu file không tải được
   */
  loadFallback() {
    logger.warn('Loading fallback keywords');
    
    const config = require('../config');
    this.blacklist.highSeverity = config.moderation.keywords.highSeverity || [];
    this.blacklist.mediumSeverity = config.moderation.keywords.mediumSeverity || [];
    this.blacklist.lowSeverity = config.moderation.keywords.lowSeverity || [];
    
    // Add all to allKeywords set
    [...this.blacklist.highSeverity, 
     ...this.blacklist.mediumSeverity, 
     ...this.blacklist.lowSeverity].forEach(kw => {
      this.blacklist.allKeywords.add(kw.toLowerCase());
    });
    
    this.loaded = true;
    
    return this.blacklist;
  }

  /**
   * Check nếu text chứa keyword từ blacklist
   */
  containsKeyword(text, severity = null) {
    if (!text) return false;
    
    const lower = text.toLowerCase();
    
    if (severity === 'high') {
      return this.blacklist.highSeverity.some(kw => lower.includes(kw));
    } else if (severity === 'medium') {
      return this.blacklist.mediumSeverity.some(kw => lower.includes(kw));
    } else if (severity === 'low') {
      return this.blacklist.lowSeverity.some(kw => lower.includes(kw));
    }
    
    // Check all keywords
    for (const keyword of this.blacklist.allKeywords) {
      if (lower.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Tìm tất cả keywords trong text
   */
  findKeywords(text) {
    if (!text) return [];
    
    const TextAnalyzer = require('./textAnalyzer');
    const lower = text.toLowerCase();
    const found = [];
    const foundSet = new Set(); // Track unique keywords
    
    // Tạo các biến thể của text để detect bypass (remove spaces + special chars)
    const noSpaces = text.replace(/\s+/g, '').toLowerCase();
    const noSpecialChars = TextAnalyzer.removeSpacesAndSpecialChars(text);
    
    // Ưu tiên check cụm từ dài trước (nhiều từ hơn)
    const sortedKeywords = Array.from(this.blacklist.allKeywords).sort((a, b) => {
      const aWords = a.split(/\s+/).length;
      const bWords = b.split(/\s+/).length;
      return bWords - aWords; // Sort descending
    });
    
    for (const keyword of sortedKeywords) {
      // Skip nếu đã tìm thấy keyword này rồi
      if (foundSet.has(keyword)) continue;
      
      // Skip từ quá ngắn (< 3 ký tự) trừ khi là từ tục tĩu rất rõ ràng
      const explicitShort = ['dm', 'vl', 'cc', 'cl', 'cu', 'đm', 'sex', 'xxx'];
      if (keyword.length < 3 && !explicitShort.includes(keyword)) {
        continue;
      }
      
      let matched = false;
      
      // 1. Check bypass variants (cách chữ, ký tự đặc biệt)
      const keywordNoSpaces = keyword.replace(/\s+/g, '');
      const keywordNoSpecial = TextAnalyzer.removeSpacesAndSpecialChars(keyword);
      
      // Bypass check cho từ >= 3 ký tự (không quá ngắn để tránh false positive)
      if (keywordNoSpaces.length >= 3 && noSpaces.includes(keywordNoSpaces)) {
        matched = true;
      } else if (keywordNoSpecial.length >= 3 && noSpecialChars.includes(keywordNoSpecial)) {
        matched = true;
      }
      
      // 2. Check exact match với word boundary (chỉ từ đơn)
      if (!matched && keyword.split(/\s+/).length === 1 && keyword.length >= 4) {
        // Chỉ match word boundary cho từ đơn >= 4 ký tự
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
        if (regex.test(lower)) {
          matched = true;
        }
      }
      
      // 3. Check cụm từ hoàn chỉnh (nhiều từ)
      if (!matched && keyword.split(/\s+/).length > 1) {
        if (lower.includes(keyword)) {
          matched = true;
        }
      }
      
      if (matched) {
        // Skip nếu keyword này nằm trong whitelist (exact)
        if (this.whitelist.has(keyword.toLowerCase())) {
          continue;
        }

        // Additional guard: if the matched keyword is low/medium severity and the text
        // contains any strong whitelisted sport/location terms (e.g. 'sân bóng', 'bóng đá'),
        // treat it as a likely false-positive and skip it. This helps avoid blocking booking posts.
        const severity = this.getKeywordSeverity(keyword);
        if ((severity === 'low' || severity === 'medium') && this.whitelist.size > 0) {
          // Check whether any whitelist term appears in the text (lower)
          let hasWhitelistContext = false;
          for (const w of this.whitelist) {
            if (!w || w.length < 2) continue;
            if (lower.includes(w)) {
              hasWhitelistContext = true;
              break;
            }
          }

          if (hasWhitelistContext) {
            // Skip this keyword as it's likely a contextual false positive
            continue;
          }
        }
        
        foundSet.add(keyword);
        found.push({
          keyword,
          severity: this.getKeywordSeverity(keyword)
        });
      }
    }
    
    return found;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Lấy mức độ nghiêm trọng của keyword
   */
  getKeywordSeverity(keyword) {
    if (this.blacklist.highSeverity.includes(keyword)) return 'high';
    if (this.blacklist.mediumSeverity.includes(keyword)) return 'medium';
    if (this.blacklist.lowSeverity.includes(keyword)) return 'low';
    return 'unknown';
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      loaded: this.loaded,
      totalKeywords: this.blacklist.allKeywords.size,
      whitelistedTerms: this.whitelist.size,
      highSeverity: this.blacklist.highSeverity.length,
      mediumSeverity: this.blacklist.mediumSeverity.length,
      lowSeverity: this.blacklist.lowSeverity.length,
      patterns: this.blacklist.patterns.length,
      phonePatterns: this.blacklist.phonePatterns.length,
      urlPatterns: this.blacklist.urlPatterns.length
    };
  }

  /**
   * Reload blacklist
   */
  async reload(filePath) {
    this.loaded = false;
    this.loadAttempts = 0;
    this.blacklist = {
      highSeverity: [],
      mediumSeverity: [],
      lowSeverity: [],
      patterns: [],
      phonePatterns: [],
      urlPatterns: [],
      allKeywords: new Set()
    };
    
    return this.load(filePath);
  }
}

// Export singleton instance
module.exports = new BlacklistLoader();
