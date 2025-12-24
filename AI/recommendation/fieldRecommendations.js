/**
 * Field Recommendations
 * Gợi ý sân cụ thể (SportField) cho người dùng
 */

const logger = require('../utils/logger');
const TextAnalyzer = require('../utils/textAnalyzer');

class FieldRecommendations {
  constructor() {
    this.MODULE_NAME = 'FieldRecommendations';
  }

  /**
   * Gợi ý sân dựa trên user profile và context
   * @param {Object} userProfile 
   * @param {Object} context - { location, time, sportType, priceRange, ... }
   * @param {Array} availableFields 
   * @param {number} limit 
   * @returns {Array} Recommended fields với scores
   */
  async recommendFields(userProfile, context, availableFields, limit = 10) {
    try {
      // Score each field
      const scored = availableFields.map(field => {
        const score = this.scoreField(field, userProfile, context);
        return {
          ...field,
          recommendationScore: score.total,
          scoreBreakdown: score.breakdown
        };
      });

      // Sort by score
      scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

      // Apply filters
      const filtered = this.applyFilters(scored, context);

      // Apply diversity
      const diversified = this.applyDiversity(filtered, context);

      return diversified.slice(0, limit);

    } catch (error) {
      logger.error(this.MODULE_NAME, 'Error recommending fields', error);
      return [];
    }
  }

  /**
   * Score một sân cụ thể theo priority:
   * 1. User đã đặt sân này → Top priority (không cần confirmed)
   * 2. Popularity/Ranking (total bookings) → Priority 2
   * 3. Rating → Priority 3
   */
  scoreField(field, userProfile, context) {
    const breakdown = {};
    let total = 0;
    
    const fieldId = field.fieldId || field.FacilityID || field.facilityId || field.facility_id;
    const fieldSportType = field.sportTypeId || field.SportTypeID || field.sport_type_id;
    const avgRating = field.averageRating || field.AverageRating || field.average_rating || 0;
    const totalBookings = field.totalBookings || field.TotalBookings || 0;
    const recentBookings = field.recentBookings || field.RecentBookings || 0;

    // === PRIORITY 1: USER ĐÃ ĐẶT SÂN NÀY (60%) ===
    // Check if user has booked this exact field/facility before (any status)
    const userHasBookedThis = this.checkUserBookedField(fieldId, userProfile, context);
    
    if (userHasBookedThis) {
      breakdown.userBooked = 0.6;
      total += 0.6;
    }

    // === PRIORITY 2: POPULARITY/RANKING (30%) ===
    // Ưu tiên SỐ LƯỢNG BOOKING TỔNG (total bookings) - sân có nhiều booking nhất
    const popularityScore = Math.min(totalBookings / 100, 1) * 0.30;
    breakdown.popularity = popularityScore;
    total += popularityScore;

    // === PRIORITY 3: RATING (15%) ===
    const ratingScore = (avgRating / 5.0) * 0.15;
    breakdown.rating = ratingScore;
    total += ratingScore;

    // === SECONDARY FACTORS ===
    
    // Sport type match (5% - minor factor now)
    if (fieldSportType && userProfile.sportPreferences && userProfile.sportPreferences[fieldSportType]) {
      const sportScore = userProfile.sportPreferences[fieldSportType] * 0.05;
      breakdown.sportMatch = sportScore;
      total += sportScore;
    }

    // Location proximity (3%)
    if (context.location && (field.Latitude || field.latitude)) {
      const distanceScore = this.calculateDistanceScore(
        context.location,
        {
          lat: field.Latitude || field.latitude,
          lng: field.Longitude || field.longitude
        }
      );
      breakdown.location = distanceScore * 0.03;
      total += distanceScore * 0.03;
    }

    // Price match (2%)
    if (context.priceRange) {
      const priceScore = this.calculatePriceScore(field, context.priceRange);
      breakdown.price = priceScore * 0.02;
      total += priceScore * 0.02;
    }

    return { total: Math.max(total, 0), breakdown };
  }

  /**
   * Check if user has booked this field before (any status, not just confirmed)
   */
  checkUserBookedField(fieldId, userProfile, context) {
    if (!context.bookings || context.bookings.length === 0) {
      return false;
    }

    // Check if any booking matches this field/facility
    return context.bookings.some(booking => {
      const bookingFieldId = booking.FieldID || booking.field_id;
      const bookingFacilityId = booking.FacilityID || booking.facility_id;
      
      // Match by field ID or facility ID
      return bookingFieldId === fieldId || bookingFacilityId === fieldId;
    });
  }

  /**
   * Calculate price match score
   */
  calculatePriceScore(field, priceRange) {
    const fieldPrice = field.PricePerHour || field.price_per_hour || 0;
    
    if (!priceRange.min && !priceRange.max) {
      return 1; // No preference
    }

    const { min = 0, max = Infinity } = priceRange;

    // Perfect match
    if (fieldPrice >= min && fieldPrice <= max) {
      return 1;
    }

    // Slightly out of range - penalize
    const rangeMid = (min + max) / 2;
    const deviation = Math.abs(fieldPrice - rangeMid);
    const rangeSize = max - min;
    
    if (deviation === 0) return 1;
    if (rangeSize === 0) return 0.5;

    return Math.max(0, 1 - (deviation / rangeSize));
  }

  /**
   * Calculate distance-based score
   * @param {Object} userLocation - { lat, lng }
   * @param {Object} fieldLocation - { lat, lng }
   */
  calculateDistanceScore(userLocation, fieldLocation) {
    if (!userLocation || !fieldLocation) return 0.5; // Neutral

    const distance = this.haversineDistance(
      userLocation.lat,
      userLocation.lng,
      fieldLocation.lat,
      fieldLocation.lng
    );

    // Distance trong km
    // 0-5km: 1.0
    // 5-10km: 0.8
    // 10-20km: 0.5
    // >20km: 0.2
    if (distance <= 5) return 1.0;
    if (distance <= 10) return 0.8;
    if (distance <= 20) return 0.5;
    return 0.2;
  }

  /**
   * Haversine distance formula
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Check availability score
   */
  checkAvailability(field, timeSlot) {
    // Simplified - backend sẽ query DB để check
    // Giả sử field có property isAvailable hoặc bookedSlots
    
    if (field.isAvailable === false) return 0;
    if (field.isAvailable === true) return 1;
    
    // Default: assume available
    return 0.8;
  }

  /**
   * Apply filters (hard constraints)
   */
  applyFilters(fields, context) {
    let filtered = [...fields];

    // Filter by sport type
    if (context.sportType) {
      filtered = filtered.filter(f => 
        (f.SportTypeID || f.sport_type_id) === context.sportType
      );
    }

    // Filter by price range (hard limit)
    if (context.priceRange && context.priceRange.hardLimit) {
      const { min = 0, max = Infinity } = context.priceRange;
      filtered = filtered.filter(f => {
        const price = f.PricePerHour || f.price_per_hour || 0;
        return price >= min && price <= max;
      });
    }

    // Filter by availability
    if (context.mustBeAvailable) {
      filtered = filtered.filter(f => f.isAvailable !== false);
    }

    return filtered;
  }

  /**
   * Apply diversity - đa dạng facility
   */
  applyDiversity(fields, context) {
    if (!context.diversity || !context.diversity.enabled) {
      return fields;
    }

    const result = [];
    const facilityCount = {};
    const maxPerFacility = context.diversity.maxPerFacility || 3;

    for (const field of fields) {
      const facilityId = field.FacilityID || field.facility_id;
      const count = facilityCount[facilityId] || 0;

      if (count < maxPerFacility) {
        result.push(field);
        facilityCount[facilityId] = count + 1;
      }
    }

    return result;
  }

  /**
   * Gợi ý sân theo thời gian (time-aware)
   * Ví dụ: buổi sáng gợi ý sân có ánh sáng tốt, tối gợi ý sân có đèn
   */
  scoreByTimeOfDay(field, hour) {
    const fieldHasLighting = field.HasLighting || field.has_lighting;
    const isIndoor = field.IsIndoor || field.is_indoor;

    // Buổi tối (18h-22h)
    if (hour >= 18 && hour <= 22) {
      if (fieldHasLighting || isIndoor) {
        return 1.0; // Perfect cho tối
      }
      return 0.3; // Không phù hợp
    }

    // Buổi sáng sớm (5h-8h)
    if (hour >= 5 && hour <= 8) {
      if (!isIndoor) {
        return 1.0; // Outdoor tốt cho sáng
      }
      return 0.7;
    }

    // Giờ cao điểm (12h-14h, 17h-19h)
    if ((hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 19)) {
      // Gợi ý sân có booking rate thấp hơn
      const bookingRate = field.BookingRate || field.booking_rate || 0.5;
      return Math.max(0.3, 1 - bookingRate);
    }

    return 0.8; // Neutral
  }
}

module.exports = new FieldRecommendations();
