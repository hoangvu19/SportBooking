/**
 * Trending Analysis Module
 * Phân tích xu hướng bài viết và sân hot dựa trên engagement
 */

const logger = require('../utils/logger');

class TrendingAnalyzer {
  constructor() {
    this.MODULE_NAME = 'TrendingAnalyzer';
  }

  /**
   * Tính trending score cho bài viết
   * @param {Object} post - Bài viết cần tính score
   * @returns {number} Trending score (0-1)
   */
  calculatePostTrendingScore(post) {
    const now = Date.now();
    const postDate = new Date(post.CreatedDate || post.created_at).getTime();
    const ageInHours = (now - postDate) / (1000 * 60 * 60);

    // Engagement metrics
    const likes = post.ReactionsCount || post.LikesCount || 0;
    const comments = post.CommentsCount || post.CommentCount || 0;
    const shares = post.SharesCount || post.ShareCount || 0;

    // Time decay factor (bài mới được ưu tiên hơn)
    // Sau 24h: decay = 0.5, sau 48h: decay = 0.33, sau 72h: decay = 0.25
    const timeDecay = 1 / (1 + ageInHours / 24);

    // Engagement score
    const engagementScore = (
      likes * 1.0 +        // Like = 1 điểm
      comments * 3.0 +     // Comment = 3 điểm (quan trọng hơn)
      shares * 5.0         // Share = 5 điểm (quan trọng nhất)
    );

    // Normalize engagement (giả sử 100 engagement là rất tốt)
    const normalizedEngagement = Math.min(engagementScore / 100, 1);

    // Combined score: 60% engagement + 40% recency
    const trendingScore = (normalizedEngagement * 0.6) + (timeDecay * 0.4);

    return trendingScore;
  }

  /**
   * Tính trending score cho sân
   * @param {Object} field - Sân cần tính score
   * @returns {number} Trending score (0-1)
   */
  calculateFieldTrendingScore(field) {
    // Booking metrics
    const totalBookings = field.TotalBookings || field.total_bookings || 0;
    const recentBookings = field.RecentBookings || field.recent_bookings || 0; // 7 ngày gần nhất
    const averageRating = field.AverageRating || field.average_rating || 0;
    const ratingCount = field.RatingCount || field.rating_count || 0;

    // Booking trend (recent vs total)
    const bookingTrend = totalBookings > 0 
      ? Math.min(recentBookings / totalBookings * 10, 1) // x10 để tăng weight
      : 0;

    // Rating score
    const ratingScore = (averageRating / 5) * Math.min(ratingCount / 10, 1);

    // Combined score: 70% booking trend + 30% rating
    const trendingScore = (bookingTrend * 0.7) + (ratingScore * 0.3);

    return trendingScore;
  }

  /**
   * Lấy danh sách bài viết trending
   * @param {Array} posts - Danh sách bài viết
   * @param {number} limit - Số lượng bài viết trending
   * @returns {Array} Top trending posts
   */
  getTrendingPosts(posts, limit = 10) {
    logger.info(this.MODULE_NAME, 'Analyzing trending posts', {
      totalPosts: posts.length,
      limit
    });

    const scored = posts.map(post => ({
      ...post,
      trendingScore: this.calculatePostTrendingScore(post)
    }));

    // Sort by trending score (cao → thấp)
    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    const trending = scored.slice(0, limit);

    logger.info(this.MODULE_NAME, `Found ${trending.length} trending posts`);

    return trending;
  }

  /**
   * Lấy danh sách sân trending
   * @param {Array} fields - Danh sách sân
   * @param {number} limit - Số lượng sân trending
   * @returns {Array} Top trending fields
   */
  getTrendingFields(fields, limit = 10) {
    logger.info(this.MODULE_NAME, 'Analyzing trending fields', {
      totalFields: fields.length,
      limit
    });

    const scored = fields.map(field => ({
      ...field,
      trendingScore: this.calculateFieldTrendingScore(field)
    }));

    // Sort by trending score (cao → thấp)
    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    const trending = scored.slice(0, limit);

    logger.info(this.MODULE_NAME, `Found ${trending.length} trending fields`);

    return trending;
  }

  /**
   * Lấy danh sách cơ sở trending
   * @param {Array} facilities - Danh sách cơ sở
   * @param {number} limit - Số lượng cơ sở trending
   * @returns {Array} Top trending facilities
   */
  getTrendingFacilities(facilities, limit = 10) {
    logger.info(this.MODULE_NAME, 'Analyzing trending facilities', {
      totalFacilities: facilities.length,
      limit
    });

    const scored = facilities.map(facility => {
      // Tương tự như field
      const totalBookings = facility.TotalBookings || facility.total_bookings || 0;
      const recentBookings = facility.RecentBookings || facility.recent_bookings || 0;
      const averageRating = facility.AverageRating || facility.average_rating || 0;
      const ratingCount = facility.RatingCount || facility.rating_count || 0;

      const bookingTrend = totalBookings > 0 
        ? Math.min(recentBookings / totalBookings * 10, 1)
        : 0;

      const ratingScore = (averageRating / 5) * Math.min(ratingCount / 10, 1);
      const trendingScore = (bookingTrend * 0.7) + (ratingScore * 0.3);

      return {
        ...facility,
        trendingScore
      };
    });

    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    const trending = scored.slice(0, limit);

    logger.info(this.MODULE_NAME, `Found ${trending.length} trending facilities`);

    return trending;
  }

  /**
   * Merge trending với personalized recommendations
   * @param {Array} trendingItems - Danh sách trending
   * @param {Array} personalizedItems
   * @param {number} trendingRatio 
   * @returns {Array}
   */
  mergeWithPersonalized(trendingItems, personalizedItems, trendingRatio = 0.3) {
    const totalCount = personalizedItems.length;
    const trendingCount = Math.ceil(totalCount * trendingRatio);
    const personalizedCount = totalCount - trendingCount;

    logger.info(this.MODULE_NAME, 'Merging trending with personalized', {
      totalCount,
      trendingCount,
      personalizedCount,
      trendingRatio
    });

    // Lấy top trending items
    const topTrending = trendingItems.slice(0, trendingCount);

    // Lọc personalized items (loại bỏ những item đã có trong trending)
    const trendingIds = new Set(topTrending.map(item => 
      item.PostID || item.FieldID || item.FacilityID
    ));

    const filteredPersonalized = personalizedItems.filter(item => {
      const id = item.PostID || item.FieldID || item.FacilityID;
      return !trendingIds.has(id);
    });

    const merged = [
      ...topTrending,
      ...filteredPersonalized.slice(0, personalizedCount)
    ];

    return merged;
  }

  createHybridFeed(trendingItems, personalizedItems, totalCount = 10) {
    const feed = [];
    let tIdx = 0;
    let pIdx = 0;

    while (feed.length < totalCount) {
      if (tIdx < trendingItems.length) {
        const item = trendingItems[tIdx];
        const id = item.PostID || item.FieldID || item.FacilityID;
        const isDuplicate = feed.some(f => 
          (f.PostID || f.FieldID || f.FacilityID) === id
        );
        if (!isDuplicate) {
          feed.push({ ...item, source: 'trending' });
        }
        tIdx++;
      }

      for (let i = 0; i < 2 && feed.length < totalCount; i++) {
        if (pIdx < personalizedItems.length) {
          const item = personalizedItems[pIdx];
          const id = item.PostID || item.FieldID || item.FacilityID;
          const isDuplicate = feed.some(f => 
            (f.PostID || f.FieldID || f.FacilityID) === id
          );
          if (!isDuplicate) {
            feed.push({ ...item, source: 'personalized' });
          }
          pIdx++;
        }
      }

      // Nếu hết cả 2 list thì break
      if (tIdx >= trendingItems.length && pIdx >= personalizedItems.length) {
        break;
      }
    }

    logger.info(this.MODULE_NAME, 'Created hybrid feed', {
      totalItems: feed.length,
      trendingCount: feed.filter(f => f.source === 'trending').length,
      personalizedCount: feed.filter(f => f.source === 'personalized').length
    });

    return feed.slice(0, totalCount);
  }
}

module.exports = new TrendingAnalyzer();
