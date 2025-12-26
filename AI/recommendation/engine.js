/**
 * Recommendation Engine
 * Hệ thống gợi ý sân và bài viết dựa trên hành vi người dùng
 */

const config = require('../config');
const logger = require('../utils/logger');
const TextAnalyzer = require('../utils/textAnalyzer');
const FieldRecommendations = require('./fieldRecommendations');
const TrendingAnalyzer = require('./trending');

class RecommendationEngine {
  constructor() {
    this.config = config.recommendation;
    this.MODULE_NAME = 'RecommendationEngine';
    this.cache = new Map(); 
    this.fieldRec = FieldRecommendations;
    this.trending = TrendingAnalyzer;
  }

  /**
   * Gợi ý bài viết cho user
   * @param {number} userId 
   * @param {Object} context - User context và preferences
   * @param {number} limit 
   * @returns {Array} Danh sách post IDs được gợi ý
   */
  async recommendPosts(userId, context, limit = 30) {
    logger.info(this.MODULE_NAME, `Generating post recommendations for user ${userId}`);

    try {
      // Check cache
      const cacheKey = `posts:${userId}:${limit}`;
      if (this.config.cache.enabled) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.ttl * 1000) {
          logger.debug(this.MODULE_NAME, 'Returning cached recommendations');
          return cached.data;
        }
      }
      const userProfile = await this.buildUserProfile(userId, context);
      const candidates = await this.generateCandidates(userProfile, context);
      const contentScored = this.scoreCandidates(candidates, userProfile);

      let finalScored = contentScored;
      if (context.allUsers && context.allUsers.length > 0 && 
          this.config.algorithm.type === 'hybrid') {
        finalScored = this.applyCFToPosts(
          contentScored, 
          userProfile, 
          context.allUsers
        );
      }

      const diversified = this.applyDiversity(finalScored, userProfile);

      const recommendations = diversified.slice(0, limit);
      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          data: recommendations,
          timestamp: Date.now()
        });
        if (this.cache.size > this.config.cache.maxItems) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }

      logger.info(this.MODULE_NAME, `Generated ${recommendations.length} post recommendations`);
      return recommendations;

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Recommendation error', error);
      return [];
    }
  }

  async recommendFacilities(userId, context, limit = 20) {
    logger.info(this.MODULE_NAME, `Generating facility recommendations for user ${userId}`);

    try {
      const cacheKey = `facilities:${userId}:${limit}`;
      if (this.config.cache.enabled) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.ttl * 1000) {
          return cached.data;
        }
      }

      const userProfile = await this.buildUserProfile(userId, context);
      
      let candidates = [];
      
      if (context.availableFacilities && context.availableFacilities.length > 0) {
        candidates = context.availableFacilities;
      }
      const contentScored = this.scoreFacilities(candidates, userProfile);
      let finalScored = contentScored;
      if (context.allUsers && context.allUsers.length > 0 && 
          this.config.algorithm.type === 'hybrid') {
        finalScored = this.applyCFToFacilities(
          contentScored, 
          userProfile, 
          context.allUsers
        );
      }

      const recommendations = finalScored.slice(0, limit);

      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          data: recommendations,
          timestamp: Date.now()
        });
      }

      logger.info(this.MODULE_NAME, `Generated ${recommendations.length} facility recommendations`);
      return recommendations;

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Facility recommendation error', error);
      return [];
    }
  }

  /**
   * Gợi ý sân cụ thể (SportField) - NEW
   */
  async recommendFields(userId, context, limit = 10) {
    logger.info(this.MODULE_NAME, `Generating field recommendations for user ${userId}`);

    try {
      const cacheKey = `fields:${userId}:${JSON.stringify(context.filters || {})}:${limit}`;
      if (this.config.cache.enabled) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.ttl * 1000) {
          return cached.data;
        }
      }

      const userProfile = await this.buildUserProfile(userId, context);
      
      // Sử dụng FieldRecommendations module
      const recommendations = await this.fieldRec.recommendFields(
        userProfile,
        context,
        context.availableFields || [],
        limit
      );

      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          data: recommendations,
          timestamp: Date.now()
        });
      }

      logger.info(this.MODULE_NAME, `Generated ${recommendations.length} field recommendations`);
      return recommendations;

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Field recommendation error', error);
      return [];
    }
  }

  /**
   * Xây dựng user profile từ hành vi
   */
  async buildUserProfile(userId, context) {
    const profile = {
      userId,
      sportPreferences: {},     // { sportTypeId: score }
      facilityPreferences: {},  // { facilityId: score }
      topicInterests: [],       // Keywords user quan tâm
      activityLevel: 0,         // 0-1
      recencyBias: 0.7,         // Thích content mới
      diversityPreference: 0.5  // 0 = focused, 1 = diverse
    };

    try {
      // Từ booking history
      if (context.bookings && context.bookings.length > 0) {
        const sportCounts = {};
        const facilityCounts = {};

        context.bookings.forEach(booking => {
          const sportId = booking.SportTypeID || booking.sport_type_id;
          const facilityId = booking.FacilityID || booking.facility_id;
          
          if (sportId) {
            sportCounts[sportId] = (sportCounts[sportId] || 0) + 1;
          }
          if (facilityId) {
            facilityCounts[facilityId] = (facilityCounts[facilityId] || 0) + 1;
          }
        });

        // Normalize scores
        const maxBookings = Math.max(...Object.values(sportCounts), 1);
        Object.keys(sportCounts).forEach(sportId => {
          profile.sportPreferences[sportId] = sportCounts[sportId] / maxBookings;
        });

        const maxFacility = Math.max(...Object.values(facilityCounts), 1);
        Object.keys(facilityCounts).forEach(facilityId => {
          profile.facilityPreferences[facilityId] = facilityCounts[facilityId] / maxFacility;
        });
      }

      // Từ reactions (likes, comments)
      if (context.reactions && context.reactions.length > 0) {
        context.reactions.forEach(reaction => {
          const sportId = reaction.SportTypeID || reaction.sport_type_id;
          if (sportId) {
            profile.sportPreferences[sportId] = 
              (profile.sportPreferences[sportId] || 0) + 0.3;
          }
        });
      }

      // Từ posts đã tạo
      if (context.posts && context.posts.length > 0) {
        const allKeywords = [];
        context.posts.forEach(post => {
          if (post.Content || post.content) {
            const keywords = TextAnalyzer.extractKeywords(
              post.Content || post.content, 
              3
            );
            allKeywords.push(...keywords);
          }
        });
        
        // Tần suất keywords
        const keywordFreq = {};
        allKeywords.forEach(kw => {
          keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
        });
        
        profile.topicInterests = Object.entries(keywordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([word]) => word);
      }

      // Activity level
      const totalActions = (context.bookings?.length || 0) + 
                          (context.reactions?.length || 0) + 
                          (context.posts?.length || 0);
      profile.activityLevel = Math.min(totalActions / 50, 1);

      logger.debug(this.MODULE_NAME, 'Built user profile', {
        userId,
        sportCount: Object.keys(profile.sportPreferences).length,
        facilityCount: Object.keys(profile.facilityPreferences).length,
        topicCount: profile.topicInterests.length
      });

      return profile;

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Error building user profile', error);
      return profile;
    }
  }

  /**
   * Generate post candidates
   */
  async generateCandidates(userProfile, context) {
    const candidates = [];

    // Từ context.availablePosts nếu có
    if (context.availablePosts && context.availablePosts.length > 0) {
      return context.availablePosts;
    }

    // Nếu không có, return empty (backend sẽ query DB)
    return candidates;
  }

  /**
   * Generate facility candidates
   */
  async generateFacilityCandidates(userProfile, context) {
    if (context.availableFacilities && context.availableFacilities.length > 0) {
      return context.availableFacilities;
    }
    return [];
  }

  /**
   * Score post candidates dựa trên user profile
   */
  scoreCandidates(candidates, userProfile) {
    const factors = this.config.algorithm.factors;
    const scored = candidates.map(post => {
      let score = 0;

      // Factor 1: Sport type match
      const postSportId = post.SportTypeID || post.sport_type_id;
      if (postSportId && userProfile.sportPreferences[postSportId]) {
        score += userProfile.sportPreferences[postSportId] * factors.userSportPreferences;
      }

      // Factor 2: Booking history match
      const postFacilityId = post.FacilityID || post.facility_id;
      if (postFacilityId && userProfile.facilityPreferences[postFacilityId]) {
        score += userProfile.facilityPreferences[postFacilityId] * factors.userBookingHistory;
      }

      // Factor 3: Content similarity (nếu có topicInterests)
      if (userProfile.topicInterests.length > 0 && (post.Content || post.content)) {
        const postKeywords = TextAnalyzer.extractKeywords(
          post.Content || post.content, 
          5
        );
        const overlap = postKeywords.filter(kw => 
          userProfile.topicInterests.includes(kw)
        ).length;
        
        if (overlap > 0) {
          score += (overlap / userProfile.topicInterests.length) * factors.userCreatedPosts;
        }
      }

      // Factor 4: Popularity (reactions count)
      const reactionsCount = post.ReactionsCount || post.reactions_count || 0;
      const normalizedReactions = Math.min(reactionsCount / 100, 1);
      score += normalizedReactions * factors.userReactions;

      // Factor 5: Recency
      if (post.CreatedDate || post.created_date) {
        const createdDate = new Date(post.CreatedDate || post.created_date);
        const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - (ageInDays / 30)); // Decay over 30 days
        score += recencyScore * factors.recency * userProfile.recencyBias;
      }

      return {
        ...post,
        recommendationScore: score,
        scoreDetails: {
          sportMatch: postSportId && userProfile.sportPreferences[postSportId] ? 
            userProfile.sportPreferences[postSportId] * factors.userSportPreferences : 0,
          facilityMatch: postFacilityId && userProfile.facilityPreferences[postFacilityId] ?
            userProfile.facilityPreferences[postFacilityId] * factors.userBookingHistory : 0
        }
      };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Score facility candidates
   */
  scoreFacilities(candidates, userProfile) {
    const scored = candidates.map(facility => {
      let score = 0;

      // Sport type match - HIGHEST PRIORITY
      const sportId = facility.SportTypeID || facility.sport_type_id;
      const hasSportPreference = sportId && userProfile.sportPreferences[sportId];
      
      if (hasSportPreference) {
        // User có booking history với loại thể thao này
        score += userProfile.sportPreferences[sportId] * 0.6; // Tăng từ 0.3 -> 0.6
      } else if (sportId && Object.keys(userProfile.sportPreferences).length > 0) {
        // User có preferences nhưng KHÔNG match -> penalty
        score -= 0.5; // Trừ điểm mạnh nếu không match sport type
      }

      // Facility match (nếu user từng đặt facility này)
      const facilityId = facility.FacilityID || facility.facility_id;
      if (userProfile.facilityPreferences[facilityId]) {
        score += userProfile.facilityPreferences[facilityId] * 0.3; // Giảm từ 0.4 -> 0.3
      }

      // Rating - CHỈ có impact nhỏ nếu đã match sport type
      const rating = facility.AverageRating || facility.average_rating || 0;
      if (hasSportPreference) {
        score += (rating / 5.0) * 0.1; // Giảm từ 0.3 -> 0.1
      }

      return {
        ...facility,
        recommendationScore: Math.max(score, 0) // Không cho điểm âm
      };
    });

    return scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Apply diversity filter để tránh recommend quá nhiều cùng loại
   */
  applyDiversity(scored, userProfile) {
    if (!this.config.diversity.enabled) {
      return scored;
    }

    const result = [];
    const sportTypeCounts = {};
    const maxSameInRow = this.config.diversity.maxSameSportInRow;
    let consecutiveSameCount = 0;
    let lastSportType = null;

    for (const item of scored) {
      const sportType = item.SportTypeID || item.sport_type_id;
      
      // Track diversity
      if (sportType === lastSportType) {
        consecutiveSameCount++;
      } else {
        consecutiveSameCount = 1;
        lastSportType = sportType;
      }

      // Skip if too many consecutive same sport
      if (consecutiveSameCount > maxSameInRow) {
        continue;
      }

      result.push(item);
      sportTypeCounts[sportType] = (sportTypeCounts[sportType] || 0) + 1;
    }

    return result;
  }

  /**
   * Apply collaborative filtering to posts (Hybrid approach)
   */
  applyCFToPosts(contentScoredPosts, userProfile, allUsers) {
    try {
      // Find similar users
      const similarUsers = this.cf.findSimilarUsers(
        userProfile.userId,
        userProfile,
        allUsers,
        10 // Top 10 similar users
      );

      if (similarUsers.length === 0) {
        return contentScoredPosts; // Fallback to content-based only
      }

      // Get CF recommendations
      const cfRecs = this.cf.getRecommendationsFromSimilarUsers(
        similarUsers,
        userProfile
      );

      // Merge CF scores với content-based scores
      const cfPostScores = new Map();
      cfRecs.posts.forEach(item => {
        cfPostScores.set(item.id, item.score);
      });

      const hybridScored = contentScoredPosts.map(post => {
        const postId = post.PostID || post.post_id || post.id;
        const contentScore = post.recommendationScore || 0;
        const cfScore = cfPostScores.get(postId) || 0;

        // Weighted combination
        const hybridScore = 
          (contentScore * this.config.algorithm.contentWeight) +
          (cfScore * this.config.algorithm.collaborativeWeight);

        return {
          ...post,
          recommendationScore: hybridScore,
          contentScore,
          collaborativeScore: cfScore
        };
      });

      // Re-sort by hybrid score
      return hybridScored.sort((a, b) => 
        b.recommendationScore - a.recommendationScore
      );

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Error applying CF to posts', error);
      return contentScoredPosts; // Fallback
    }
  }

  /**
   * Apply collaborative filtering to facilities
   */
  applyCFToFacilities(contentScoredFacilities, userProfile, allUsers) {
    try {
      const similarUsers = this.cf.findSimilarUsers(
        userProfile.userId,
        userProfile,
        allUsers,
        10
      );

      if (similarUsers.length === 0) {
        return contentScoredFacilities;
      }

      const cfRecs = this.cf.getRecommendationsFromSimilarUsers(
        similarUsers,
        userProfile
      );

      const cfFacilityScores = new Map();
      cfRecs.facilities.forEach(item => {
        cfFacilityScores.set(item.id, item.score);
      });

      const hybridScored = contentScoredFacilities.map(facility => {
        const facilityId = facility.FacilityID || facility.facility_id || facility.id;
        const contentScore = facility.recommendationScore || 0;
        const cfScore = cfFacilityScores.get(facilityId) || 0;

        const hybridScore = 
          (contentScore * this.config.algorithm.contentWeight) +
          (cfScore * this.config.algorithm.collaborativeWeight);

        return {
          ...facility,
          recommendationScore: hybridScore,
          contentScore,
          collaborativeScore: cfScore
        };
      });

      return hybridScored.sort((a, b) => 
        b.recommendationScore - a.recommendationScore
      );

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Error applying CF to facilities', error);
      return contentScoredFacilities;
    }
  }

  /**
   * Clear cache
   */
  clearCache(userId = null) {
    if (userId) {
      // Clear specific user cache
      for (const key of this.cache.keys()) {
        if (key.includes(`:${userId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
    
    // Clear CF cache too
    this.cf.clearCache();
    
    logger.info(this.MODULE_NAME, `Cache cleared for user: ${userId || 'all'}`);
  }

  /**
   * Personalized Feed: Kết hợp trending + personalized
   * Đây là method CHÍNH cho newsfeed
   * @param {number} userId 
   * @param {Object} context 
   * @param {number} limit 
   * @param {string} feedType - 'hybrid' | 'trending-first' | 'personalized-only'
   * @returns {Array} Feed items
   */
  async getPersonalizedFeed(userId, context, limit = 10, feedType = 'hybrid') {
    logger.info(this.MODULE_NAME, `Generating personalized feed for user ${userId}`, {
      feedType,
      limit
    });

    try {
      const cacheKey = `feed:${userId}:${feedType}:${limit}`;
      if (this.config.cache.enabled) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.ttl * 1000) {
          return cached.data;
        }
      }

      // 1. Lấy trending posts
      const allPosts = context.availablePosts || [];
      const trendingPosts = this.trending.getTrendingPosts(allPosts, limit * 2);

      // 2. Lấy personalized recommendations
      const personalizedPosts = await this.recommendPosts(userId, context, limit * 2);

      // 3. Merge theo feedType
      let feed = [];
      
      if (feedType === 'trending-first') {
        // 30% trending ở đầu, 70% personalized
        feed = this.trending.mergeWithPersonalized(
          trendingPosts, 
          personalizedPosts, 
          0.3
        );
      } else if (feedType === 'personalized-only') {
        // 100% personalized
        feed = personalizedPosts.slice(0, limit);
      } else {
        // 'hybrid': xen kẽ trending và personalized (1-2-2 pattern)
        feed = this.trending.createHybridFeed(
          trendingPosts,
          personalizedPosts,
          limit
        );
      }

      // Cache result
      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          data: feed,
          timestamp: Date.now()
        });
      }

      logger.info(this.MODULE_NAME, `Generated feed with ${feed.length} items`);
      return feed;

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Personalized feed error', error);
      return [];
    }
  }

  /**
   * Trending Feed: Chỉ hiển thị trending
   * @param {Object} context 
   * @param {number} limit 
   * @param {string} type - 'posts' | 'fields' | 'facilities'
   * @returns {Array} Trending items
   */
  async getTrendingFeed(context, limit = 10, type = 'posts') {
    logger.info(this.MODULE_NAME, `Getting trending ${type}`, { limit });

    try {
      const cacheKey = `trending:${type}:${limit}`;
      if (this.config.cache.enabled) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.ttl * 1000) {
          return cached.data;
        }
      }

      let trending = [];

      if (type === 'posts') {
        const allPosts = context.availablePosts || [];
        trending = this.trending.getTrendingPosts(allPosts, limit);
      } else if (type === 'fields') {
        const allFields = context.availableFields || [];
        trending = this.trending.getTrendingFields(allFields, limit);
      } else if (type === 'facilities') {
        const allFacilities = context.availableFacilities || [];
        trending = this.trending.getTrendingFacilities(allFacilities, limit);
      }

      // Cache
      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          data: trending,
          timestamp: Date.now()
        });
      }

      logger.info(this.MODULE_NAME, `Found ${trending.length} trending ${type}`);
      return trending;

    } catch (error) {
      logger.error(this.MODULE_NAME, `Trending ${type} error`, error);
      return [];
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      algorithmType: this.config.algorithm.type,
      factors: this.config.algorithm.factors
    };
  }
}

module.exports = new RecommendationEngine();
