/**
 * Content Moderation Engine
 * AI-powered content moderation với multi-layer detection
 */

const config = require('../config');
const logger = require('../utils/logger');
const TextAnalyzer = require('../utils/textAnalyzer');
const blacklistLoader = require('../utils/blacklistLoader');
// VN timezone helper for moderation timestamps
let toVnIso = null;
try { toVnIso = require('../../backend/utils/vnTime').toVnIso; } catch (e) { /* ignore */ }
const path = require('path');

class ModerationEngine {
  constructor() {
    this.config = config.moderation;
    this.MODULE_NAME = 'ModerationEngine';
    this.blacklistLoaded = false;
    this.blacklistReady = false;
    
    // Load blacklist khi khởi tạo (non-blocking)
    this.initBlacklist();
  }

  /**
   * Initialize blacklist
   */
  async initBlacklist() {
    try {
      const blacklistPath = path.resolve(__dirname, '../data/blacklist.txt');
      await blacklistLoader.load(blacklistPath);
      this.blacklistLoaded = true;
      this.blacklistReady = true;
      
      if (process.env.DEBUG_AI === 'true') {
        const stats = blacklistLoader.getStats();
        logger.info(this.MODULE_NAME, 'Blacklist loaded successfully', stats);
      }
    } catch (error) {
      logger.error(this.MODULE_NAME, 'Failed to load blacklist', error);
      this.blacklistLoaded = false;
      this.blacklistReady = false;
    }
  }

  /**
   * Wait for blacklist to be ready
   */
  async ensureBlacklistReady() {
    if (this.blacklistReady) return;
    
    // Wait maximum 5 seconds for blacklist to load
    const maxWait = 5000;
    const interval = 100;
    let waited = 0;
    
    while (!this.blacklistReady && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }
    
    if (!this.blacklistReady) {
      logger.warn(this.MODULE_NAME, 'Blacklist not ready after 5s, using fallback');
    }
  }

  /**
   * Moderate content (text + images)
   * @param {string} text - Nội dung văn bản
   * @param {Array} imageUrls - Danh sách URL hình ảnh
   * @returns {Object} Kết quả moderation
   */
  async moderate(text, imageUrls = []) {
    // Đảm bảo blacklist đã sẵn sàng
    await this.ensureBlacklistReady();
    
    logger.info(this.MODULE_NAME, 'Starting moderation', {
      textLength: text?.length || 0,
      imageCount: imageUrls.length,
      blacklistReady: this.blacklistReady
    });

    try {
      const result = {
        isClean: true,
        confidence: 1.0,
        severity: 0,           // 0-10 scale
        decision: 'approved',  // 'approved', 'flagged', 'removed'
        reasons: [],
        flags: [],
    details: {},
    needsReview: false,
    timestamp: (typeof toVnIso === 'function') ? toVnIso() : (new Date().toISOString().replace('Z', '+07:00'))
      };

      // Layer 1: Text Analysis
      const textResult = await this.analyzeText(text);
      Object.assign(result.details, { text: textResult });

      // Layer 1.5: Transformer-based text model (optional)
      if (this.config.modelServer && this.config.modelServer.enabled && text) {
        try {
          const fetch = require('node-fetch');
          const resp = await fetch(this.config.modelServer.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });

          if (resp.ok) {
            const mdata = await resp.json();
            // Expecting { labels: [{label,score}], scores: {label:score}, aggregate: <0-1 confidence> }
            result.details.model = mdata;
          } else {
            logger.warn(this.MODULE_NAME, 'Model server returned non-OK', { status: resp.status });
          }
        } catch (err) {
          logger.warn(this.MODULE_NAME, 'Model server call failed', err.message);
        }
      }

      // Layer 2: Image Analysis (if enabled)
      if (imageUrls && imageUrls.length > 0) {
        const imageResult = await this.analyzeImages(imageUrls);
        Object.assign(result.details, { images: imageResult });
      }

      // Layer 3: External API (if enabled)
      if (this.config.externalAPIs.openai.enabled && text) {
        const externalResult = await this.checkWithOpenAI(text);
        Object.assign(result.details, { openai: externalResult });
      }

      // Calculate final score
      this.calculateFinalScore(result);

      // Make decision
      this.makeDecision(result);

      logger.info(this.MODULE_NAME, 'Moderation completed', {
        decision: result.decision,
        confidence: result.confidence,
        severity: result.severity
      });

      return result;

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Moderation error', error);
      
      // Fail-safe: nếu lỗi thì flag để human review
      return {
        isClean: false,
        confidence: 0.5,
        severity: 5,
        decision: 'flagged',
        reasons: ['System error during moderation'],
        flags: ['error'],
        needsReview: true,
        error: error.message
      };
    }
  }

  /**
   * Phân tích văn bản
   */
  async analyzeText(text) {
    if (!text || text.trim().length === 0) {
      return { score: 1.0, flags: [], reasons: [] };
    }

    const result = {
      score: 1.0,
      flags: [],
      reasons: [],
      details: {}
    };

    const trimmedText = text.trim();

    // 1. Kiểm tra từ khóa nhạy cảm
    const keywordCheck = this.checkKeywords(trimmedText);
    if (keywordCheck.found) {
      result.score -= keywordCheck.penalty;
      result.flags.push('sensitive_keywords');
      result.reasons.push(`Detected ${keywordCheck.count} sensitive keywords`);
      result.details.keywords = keywordCheck;
    }

    // 2. Kiểm tra spam patterns
    const spamCheck = this.checkSpamPatterns(trimmedText);
    if (spamCheck.isSpam) {
      result.score -= spamCheck.penalty;
      result.flags.push('spam_pattern');
      result.reasons.push(`Matched ${spamCheck.patterns.length} spam patterns`);
      result.details.spam = spamCheck;
    }

    // 3. Phân tích chất lượng văn bản
    const qualityScore = TextAnalyzer.getTextQualityScore(trimmedText);
    result.details.quality = qualityScore;
    
    if (qualityScore < 0.5) {
      result.score -= (1 - qualityScore) * 0.3;
      result.flags.push('low_quality');
      result.reasons.push('Low text quality');
    }

    // 4. Kiểm tra độ dài
    if (trimmedText.length > 3000) {
      result.flags.push('too_long');
      result.reasons.push('Content exceeds maximum length');
      result.score -= 0.1;
    }

    // 5. Kiểm tra excessive caps
    const capsRatio = TextAnalyzer.getCapsRatio(trimmedText);
    if (capsRatio > 0.7) {
      result.flags.push('excessive_caps');
      result.reasons.push('Excessive use of capital letters');
      result.score -= 0.15;
    }

    result.score = Math.max(0, Math.min(1, result.score));
    return result;
  }

  /**
   * Kiểm tra từ khóa nhạy cảm
   */
  checkKeywords(text) {
    const lowerText = text.toLowerCase();
    
    // Nếu blacklist đã load, sử dụng nó
    if (this.blacklistLoaded && blacklistLoader.loaded) {
      const foundKeywords = blacklistLoader.findKeywords(lowerText);
      
      const found = {
        high: foundKeywords.filter(k => k.severity === 'high').map(k => k.keyword),
        medium: foundKeywords.filter(k => k.severity === 'medium').map(k => k.keyword),
        low: foundKeywords.filter(k => k.severity === 'low').map(k => k.keyword)
      };
      
      const totalCount = foundKeywords.length;
      const penalty = (found.high.length * 0.4) + (found.medium.length * 0.25) + (found.low.length * 0.1);

      return {
        found: totalCount > 0,
        count: totalCount,
        details: found,
        penalty: Math.min(penalty, 0.8),
        source: 'blacklist'
      };
    }
    
    // Fallback: Sử dụng keywords từ config
    const found = {
      high: [],
      medium: [],
      low: []
    };

    // Check high severity keywords
    for (const keyword of this.config.keywords.highSeverity) {
      if (lowerText.includes(keyword.toLowerCase())) {
        found.high.push(keyword);
      }
    }

    // Check medium severity keywords
    for (const keyword of this.config.keywords.mediumSeverity) {
      if (lowerText.includes(keyword.toLowerCase())) {
        found.medium.push(keyword);
      }
    }

    // Check low severity keywords
    for (const keyword of this.config.keywords.lowSeverity) {
      if (lowerText.includes(keyword.toLowerCase())) {
        found.low.push(keyword);
      }
    }

    const totalCount = found.high.length + found.medium.length + found.low.length;
    const penalty = (found.high.length * 0.4) + (found.medium.length * 0.25) + (found.low.length * 0.1);

    return {
      found: totalCount > 0,
      count: totalCount,
      details: found,
      penalty: Math.min(penalty, 0.8),
      source: 'config'
    };
  }

  /**
   * Kiểm tra spam patterns
   */
  checkSpamPatterns(text) {
    const matchedPatterns = [];
    
    for (let i = 0; i < this.config.spamPatterns.length; i++) {
      const pattern = this.config.spamPatterns[i];
      if (pattern.test(text)) {
        matchedPatterns.push({
          index: i,
          pattern: pattern.toString()
        });
      }
    }

    const penalty = matchedPatterns.length * 0.2;

    return {
      isSpam: matchedPatterns.length > 0,
      patterns: matchedPatterns,
      penalty: Math.min(penalty, 0.6)
    };
  }

  /**
   * Phân tích hình ảnh (placeholder - cần tích hợp API)
   */
  async analyzeImages(imageUrls) {
    // Use imageModeration adapter which supports Azure or heuristic fallback
    const imageMod = require('./imageModeration');

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return { score: 1.0, count: 0, flags: [], reasons: [], note: 'no images' };
    }

    const modResult = await imageMod.moderateImages(imageUrls);

    const details = {
      count: modResult.count,
      aggregateScore: modResult.aggregateScore,
      items: modResult.results
    };

    const score = Math.max(0, 1 - details.aggregateScore); // higher aggregateScore -> lower safety score

    const flags = [];
    const reasons = [];

    // If any item has high nsfwScore, add flags/reasons
    for (const item of details.items) {
      if (item.nsfwScore >= 0.85) {
        flags.push('nsfw_high');
        reasons.push(`High NSFW score for ${item.url}`);
      } else if (item.nsfwScore >= 0.6) {
        flags.push('nsfw_medium');
        reasons.push(`Medium NSFW score for ${item.url}`);
      }
    }

    return {
      score,
      count: details.count,
      flags: Array.from(new Set(flags)),
      reasons,
      details
    };
  }

  /**
   * Kiểm tra với OpenAI Moderation API
   */
  async checkWithOpenAI(text) {
    if (!this.config.externalAPIs.openai.enabled) {
      return null;
    }

    try {
      const fetch = require('node-fetch');
      const response = await fetch(this.config.externalAPIs.openai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.externalAPIs.openai.apiKey}`
        },
        body: JSON.stringify({ input: text })
      });

      const data = await response.json();
      
      if (data.results && data.results[0]) {
        const result = data.results[0];
        return {
          flagged: result.flagged,
          categories: result.categories,
          categoryScores: result.category_scores
        };
      }

      return null;

    } catch (error) {
      logger.warn(this.MODULE_NAME, 'OpenAI API error', error.message);
      return null;
    }
  }

  /**
   * Tính điểm cuối cùng từ tất cả layers
   */
  calculateFinalScore(result) {
    const weights = this.config.weights;
    let finalScore = 0;
    let totalWeight = 0;

    // Text score
    if (result.details.text) {
      finalScore += result.details.text.score * weights.textQuality;
      totalWeight += weights.textQuality;
    }

    // Image score
    if (result.details.images) {
      finalScore += result.details.images.score * weights.imageContent;
      totalWeight += weights.imageContent;
    }

    // Model (transformer) score
    if (result.details.model && typeof weights.textModel === 'number' && weights.textModel > 0) {
      // model may return an aggregate confidence or label scores
      let modelConf = 0;
      try {
        if (typeof result.details.model.aggregate === 'number') {
          modelConf = result.details.model.aggregate;
        } else if (result.details.model.scores) {
          // scores: {label: score}
          const vals = Object.values(result.details.model.scores).map(v => parseFloat(v) || 0);
          modelConf = vals.length ? Math.max(...vals) : 0;
        } else if (Array.isArray(result.details.model.labels)) {
          const vals = result.details.model.labels.map(l => parseFloat(l.score) || 0);
          modelConf = vals.length ? Math.max(...vals) : 0;
        }
      } catch (e) {
        modelConf = 0;
      }

      finalScore += modelConf * weights.textModel;
      totalWeight += weights.textModel;
    }

    // Normalize
    result.confidence = totalWeight > 0 ? finalScore / totalWeight : 0.5;

    // Calculate severity (0-10)
    result.severity = Math.round((1 - result.confidence) * 10);
  }

  /**
   * Đưa ra quyết định cuối cùng
   */
  makeDecision(result) {
    const thresholds = this.config.thresholds;

    if (result.confidence >= thresholds.autoApprove) {
      result.decision = 'approved';
      result.isClean = true;
      result.needsReview = false;
    } 
    else if (result.confidence < thresholds.autoRemove) {
      // Previously this branch auto-removed content. To avoid false positives
      // removing benign booking posts, we mark these as flagged and require human review,
      // while including a recommendedAction so the caller can act if desired.
      result.decision = 'flagged';
      result.isClean = false;
      result.needsReview = true;
      result.recommendedAction = 'remove';
      result.reasons.unshift('Content flagged for removal (requires human review)');
    } 
    else if (result.confidence < thresholds.flagForReview) {
      result.decision = 'flagged';
      result.isClean = false;
      result.needsReview = true;
      result.recommendedAction = 'review';
      result.reasons.unshift('Content flagged for admin review');
    } 
    else {
      result.decision = 'approved';
      result.isClean = true;
      result.needsReview = false;
    }
  }

  /**
   * Lấy thống kê moderation
   */
  getStats() {
    const blacklistStats = this.blacklistLoaded ? blacklistLoader.getStats() : null;
    
    return {
      thresholds: this.config.thresholds,
      blacklist: blacklistStats,
      keywordCount: {
        high: this.config.keywords.highSeverity.length,
        medium: this.config.keywords.mediumSeverity.length,
        low: this.config.keywords.lowSeverity.length
      },
      spamPatternCount: this.config.spamPatterns.length
    };
  }
}

module.exports = new ModerationEngine();
