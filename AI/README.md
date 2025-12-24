# WhereWeSport AI Module

AI/ML module cho hệ thống WhereWeSport, bao gồm:
- **Content Moderation**: Tự động lọc spam và nội dung không phù hợp
- **Recommendation Engine**: Gợi ý sân và bài viết dựa trên hành vi người dùng

## 📁 Cấu trúc thư mục

```
AI/
├── config/           # Cấu hình AI
│   └── index.js
├── moderation/       # Content moderation engine
│   └── engine.js
├── recommendation/   # Recommendation engine
│   └── engine.js
├── utils/           # Utilities
│   ├── logger.js
│   └── textAnalyzer.js
├── logs/            # Log files (auto-generated)
├── index.js         # Main entry point
├── package.json
└── README.md
```

## 🚀 Cài đặt

```bash
cd AI
npm install
```

## 📖 Sử dụng

### 1. Content Moderation

```javascript
const AI = require('./AI');

// Moderate nội dung
const result = await AI.moderation.moderate(
  "Nội dung cần kiểm tra",
  ["url/to/image1.jpg", "url/to/image2.jpg"]
);

console.log(result);
// {
//   isClean: true/false,
//   confidence: 0.95,
//   severity: 2,
//   decision: 'approved' | 'flagged' | 'removed',
//   reasons: [...],
//   flags: [...],
//   needsReview: false
// }
```

### 2. Recommendation System

```javascript
const AI = require('./AI');

// Gợi ý bài viết
const posts = await AI.recommendation.recommendPosts(
  userId,
  {
    bookings: [...],      // Lịch sử đặt sân
    reactions: [...],     // Lượt like/comment
    posts: [...],         // Bài viết đã tạo
    availablePosts: [...] // Pool bài viết để gợi ý
  },
  30 // limit
);

// Gợi ý sân thể thao
const facilities = await AI.recommendation.recommendFacilities(
  userId,
  {
    bookings: [...],
    availableFacilities: [...]
  },
  20
);
```

## ⚙️ Cấu hình

Chỉnh sửa `config/index.js`:

### Moderation Thresholds

```javascript
moderation: {
  thresholds: {
    autoRemove: 0.85,      // Tự động xóa nếu confidence < 0.85
    flagForReview: 0.60,   // Flag nếu < 0.60
    autoApprove: 0.95      // Auto approve nếu > 0.95
  }
}
```

### Recommendation Algorithm

```javascript
recommendation: {
  algorithm: {
    type: 'hybrid',        // 'content-based', 'collaborative', 'hybrid'
    factors: {
      userBookingHistory: 0.35,
      userReactions: 0.25,
      userCreatedPosts: 0.15,
      userSportPreferences: 0.15,
      recency: 0.10
    }
  }
}
```

## 🔧 Tích hợp vào Backend

### 1. Trong `backend/server.js`:

```javascript
const AI = require('../AI');

// Health check
app.get('/api/ai/health', (req, res) => {
  res.json(AI.healthCheck());
});
```

### 2. Trong `backend/controllers/Social/postController.js`:

```javascript
const AI = require('../../../AI');

// Sử dụng AI moderation
async function createPost(req, res) {
  const { content, imageUrls } = req.body;
  
  // AI Moderation
  const moderationResult = await AI.moderation.moderate(content, imageUrls);
  
  if (moderationResult.decision === 'removed') {
    return res.status(400).json({
      ok: false,
      message: 'Content violates community guidelines',
      reasons: moderationResult.reasons
    });
  }
  
  if (moderationResult.decision === 'flagged') {
    // Create post nhưng đánh dấu cần review
    post.status = 'PendingReview';
  }
  
  // ... tạo post
}
```

### 3. Recommendation Endpoints:

```javascript
// backend/routes/ai/recommendationRoutes.js
const AI = require('../../../AI');

router.get('/recommendations/posts', async (req, res) => {
  const userId = req.user.id;
  
  // Lấy context từ database
  const bookings = await BookingDAL.getUserBookings(userId);
  const reactions = await ReactionDAL.getUserReactions(userId);
  const posts = await PostDAL.getUserPosts(userId);
  const availablePosts = await PostDAL.getRecentPosts(1000);
  
  const recommendations = await AI.recommendation.recommendPosts(
    userId,
    { bookings, reactions, posts, availablePosts },
    30
  );
  
  res.json({ ok: true, data: recommendations });
});
```

## 🔌 External API Integration (Optional)

### OpenAI Moderation API

Thêm vào `.env`:
```
OPENAI_MODERATION_ENABLED=true
OPENAI_API_KEY=your_openai_api_key
```

### Azure Content Moderator

```
AZURE_MODERATOR_ENABLED=true
AZURE_MODERATOR_KEY=your_azure_key
AZURE_MODERATOR_ENDPOINT=https://your-region.api.cognitive.microsoft.com/
```

### Google Perspective API

```
PERSPECTIVE_API_ENABLED=true
PERSPECTIVE_API_KEY=your_google_api_key
```

## 📊 Monitoring & Logs

Logs được tự động ghi vào `AI/logs/`:
- `ai-info.log` - Thông tin chung
- `ai-warn.log` - Cảnh báo
- `ai-error.log` - Lỗi

Xem logs:
```bash
tail -f AI/logs/ai-info.log
```

## 🧪 Testing

```bash
npm test
```

## 📈 Performance Tips

1. **Cache recommendations**: Đã được tích hợp sẵn (TTL: 10 phút)
2. **Batch processing**: Chạy scheduled job để pre-compute recommendations
3. **Database indexes**: Index các cột `SportTypeID`, `CreatedDate`, `ReactionsCount`

## 🎯 Roadmap

- [ ] Tích hợp ML models (TensorFlow.js, ONNX)
- [ ] Collaborative filtering với matrix factorization
- [ ] Image moderation với computer vision
- [ ] Real-time recommendation updates
- [ ] A/B testing framework
- [ ] Personalized content ranking

## 📝 License

MIT
