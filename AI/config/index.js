/**
 * AI/ML Configuration
 * Cấu hình cho các module AI và ML
 */

module.exports = {
  // Moderation Configuration
  moderation: {
    // Ngưỡng tự động
    thresholds: {
      // Adjusted thresholds:
      // - autoRemove: only remove when confidence is very low
      // - flagForReview: flag for human review when confidence is moderately low
      // - autoApprove: auto approve when confidence is very high
      autoRemove: 0.50,      // Tự động xóa nếu confidence < 0.50
      flagForReview: 0.85,   // Đánh dấu cần review nếu confidence < 0.85
      autoApprove: 0.95      // Tự động approve nếu confidence >= 0.95
    },
    
    // Trọng số cho các yếu tố
    weights: {
      sensitiveKeywords: 0.35,  // Từ khóa nhạy cảm
      spamPatterns: 0.2,       // Pattern spam
      textQuality: 0.1,        // Chất lượng văn bản
      // textModel weight can be set via env TEXT_MODEL_WEIGHT or defaults to 0.25 in dev, 0.0 in prod
      textModel: Number(process.env.TEXT_MODEL_WEIGHT || (process.env.NODE_ENV === 'development' ? 0.25 : 0.0)),
      imageContent: 0.35       // Nội dung hình ảnh (tăng để ảnh có tác động lớn hơn)
    },
    
    // Tích hợp API bên ngoài (optional)
    externalAPIs: {
      // OpenAI Moderation API
      openai: {
        enabled: process.env.OPENAI_MODERATION_ENABLED === 'true',
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: 'https://api.openai.com/v1/moderations'
      },
      
      // Google Perspective API (toxic comment detection)
      perspective: {
        enabled: process.env.PERSPECTIVE_API_ENABLED === 'true',
        apiKey: process.env.PERSPECTIVE_API_KEY,
        endpoint: 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze'
      },
      
      // Azure Content Moderator (image moderation)
      azureModerator: {
        enabled: process.env.AZURE_MODERATOR_ENABLED === 'true',
        apiKey: process.env.AZURE_MODERATOR_KEY,
        endpoint: process.env.AZURE_MODERATOR_ENDPOINT
      }
    },

    // Model server for text moderation (local transformer inference service)
    modelServer: {
      // Enable model server if explicitly enabled OR when running in development
      enabled: (process.env.MODERATION_MODEL_SERVER === 'true') || (process.env.NODE_ENV === 'development'),
      // Full URL to the predict endpoint, e.g. http://localhost:8000/predict
      url: process.env.MODERATION_MODEL_SERVER_URL || 'http://127.0.0.1:8000/predict',
      timeout: 4000
    },
    
    // Từ khóa nhạy cảm tiếng Việt - load từ file blacklist.txt
    keywords: {
      // File blacklist chứa hơn 2000+ từ khóa spam
      blacklistFile: './AI/data/blacklist.txt',
      
      // Backup keywords nếu file không load được
      highSeverity: [
        'lừa đảo', 'lua dao', 'scam', 'hack', 'phishing',
        'ma túy', 'ma tuy', 'drugs', 'heroin', 'cocaine',
        'khủng bố', 'khung bo', 'terrorist', 'bomb',
        'sex', 'porn', 'khiêu dâm', 'xxx', 'nhục dục',
        'đụ', 'địt', 'lồn', 'cặc', 'đéo', 'đm', 'dcm', 'vl'
      ],
      
      mediumSeverity: [
        'cờ bạc', 'co bac', 'casino', 'gambling', 'bet',
        'chửi thề', 'dm', 'dcm', 'vl', 'cl', 'cc', 'đm',
        'bạo lực', 'bao luc', 'violence', 'đánh đập',
        'chính trị', 'chinh tri', 'political'
      ],
      
      lowSeverity: [
        'spam', 'quảng cáo', 'quang cao', 'advertisement',
        'inbox', 'zalo', 'telegram', 'whatsapp',
        'mua ngay', 'giảm giá', 'giam gia', 'sale off'
      ]
    },
    
    // Spam patterns
    spamPatterns: [
      /(.)\1{5,}/gi,                    // Lặp ký tự 6+ lần
      /(https?:\/\/[^\s]+){4,}/gi,      // 4+ links
      /(\d{9,})/g,                      // Số điện thoại
      /(inbox|zalo|telegram).{0,30}(liên hệ|contact|hotline)/gi,
      /(mua|bán|sale).{0,40}(inbox|zalo|sdt)/gi,
      /🔥{3,}|💰{3,}|⚡{3,}/g           // Spam emoji
    ]
  },

  // Recommendation Configuration
  recommendation: {
    // Algorithm configuration
    algorithm: {
      type: 'hybrid',           // 'content-based', 'collaborative', 'hybrid'
      contentWeight: 0.6,       // Trọng số content-based
      collaborativeWeight: 0.4, // Trọng số collaborative filtering
      
      // Các yếu tố ảnh hưởng đến recommendation
      factors: {
        userBookingHistory: 0.35,    // Lịch sử đặt sân
        userReactions: 0.25,          // Lượt like/comment
        userCreatedPosts: 0.15,       // Bài viết người dùng tạo
        userSportPreferences: 0.15,   // Sở thích thể thao
        recency: 0.10                 // Độ mới của nội dung
      }
    },
    
    // Caching
    cache: {
      enabled: true,
      ttl: 600,              // 10 phút
      maxItems: 1000
    },
    
    // Batch processing
    batch: {
      enabled: true,
      interval: '0 */6 * * *',  // Mỗi 6 giờ
      batchSize: 100
    },
    
    // Embeddings (nếu dùng)
    embeddings: {
      enabled: process.env.EMBEDDINGS_ENABLED === 'true',
      provider: 'openai',        // 'openai', 'cohere', 'huggingface'
      model: 'text-embedding-3-small',
      dimensions: 1536,
      batchSize: 50
    },
    
    // Diversity settings
    diversity: {
      enabled: true,
      minDifferentSportTypes: 2,  // Ít nhất 2 loại thể thao khác nhau
      maxSameSportInRow: 3        // Tối đa 3 bài cùng môn liên tiếp
    }
  },

  // Database Configuration
  database: {
    // Bảng lưu kết quả AI
    tables: {
      moderationLog: 'ContentModerationLog',
      userPreferences: 'AI_UserPreferences',
      recommendations: 'AI_Recommendations',
      embeddings: 'AI_Embeddings'
    }
  },

  // Performance & Limits
  performance: {
    maxConcurrentRequests: 10,
    requestTimeout: 5000,      // 5 giây
    retryAttempts: 2,
    retryDelay: 1000
  },

    // Logging
    logging: {
      // Default level changed to 'warn' to avoid noisy info/debug logs in production/dev terminals.
      // Override with environment variable AI_LOG_LEVEL if detailed logs are needed.
      level: process.env.AI_LOG_LEVEL || 'warn',
      logToFile: true,
      logPath: './AI/logs'
    }
};
