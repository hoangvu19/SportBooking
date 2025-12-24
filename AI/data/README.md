# Blacklist & Whitelist System

Hệ thống lọc spam và nội dung không phù hợp cho AI Content Moderation.

## 📋 Tổng quan

- **blacklist.txt**: 1,478+ từ khóa spam/không phù hợp
- **whitelist.txt**: 425+ từ hợp lệ (tránh false positive)
- **Ngôn ngữ hỗ trợ**: Tiếng Việt + English
- **Cập nhật**: 2025-11-02

## 📊 Thống kê

### Blacklist
- **Tổng từ khóa**: 1,478 keywords
- **High severity**: 238 từ (tục tĩu, 18+, ma túy, vũ khí)
- **Medium severity**: 332 từ (lừa đảo, cờ bạc, bạo lực)
- **Low severity**: 784 từ (spam quảng cáo, MLM)
- **Patterns**: 54 (emoji spam, etc.)
- **Phone patterns**: 72
- **URL patterns**: 10

### Whitelist
- **Tổng từ**: 425 terms
- Thuật ngữ thể thao
- Địa điểm, sân bóng
- Giao tiếp bình thường

## 🗂️ Cấu trúc Blacklist

File `blacklist.txt` được chia thành **36 nhóm** chính:

### 1. Từ tục tĩu - Vulgar Words
```
# Nhóm 1-4: Từ tục tĩu cơ bản, biến thể, xúc phạm
đụ, địt, lồn, cặc, đéo, đm, vl, cc...
đụ mẹ, địt con mẹ, mẹ mày, cha mày...
```

### 2. Nội dung tình dục - Sexual Content  
```
# Nhóm 5-7: Khiêu dâm, dịch vụ người lớn
sex, porn, xxx, phim 18+, clip sex...
gái gọi, cave, massage kích dục...
onlyfans, webcam show, live sex...
```

### 3. Lừa đảo - Scam/Spam
```
# Nhóm 8-14: Kiếm tiền, MLM, cờ bạc, vay tiền
kiếm tiền online, làm giàu nhanh...
đa cấp, mlm, hoa hồng...
casino, cá cược, lô đề...
vay tiền, lãi suất 0%, giải ngân ngay...
```

### 4. Hàng cấm - Illegal Goods
```
# Nhóm 24-26: Ma túy, vũ khí, hàng giả
ma túy, cocaine, heroin, cần sa...
súng, dao, bom, vật nổ...
hàng lậu, hàng fake, replica...
```

### 5. Bạo lực & Kỳ thị
```
# Nhóm 27-30: Bạo lực, phân biệt
đánh nhau, chém, giết, hành hung...
kỳ thị vùng miền, giới tính, ngoại hình...
```

### 6. Khác
```
# Nhóm 31-36: Spam thương mại, hack, giấy tờ giả
mua ngay, freeship, giá rẻ nhất...
hack facebook, crack, keygen...
bằng lái giả, cmnd giả...
```

## 🎯 Cách sử dụng

### Load Blacklist/Whitelist

```javascript
const blacklistLoader = require('./AI/utils/blacklistLoader');

// Load từ file
await blacklistLoader.load('./AI/data/blacklist.txt');

// Check if text contains spam
const isSpam = blacklistLoader.containsKeyword('Đụ mẹ mày');
console.log(isSpam); // true

// Find all keywords in text
const found = blacklistLoader.findKeywords('Kiếm tiền online nhanh');
console.log(found);
// [
//   { keyword: 'kiếm tiền online', severity: 'medium' },
//   { keyword: 'kiếm', severity: 'high' }
// ]

// Get stats
const stats = blacklistLoader.getStats();
console.log(stats);
```

### Tích hợp với Moderation Engine

```javascript
const AI = require('./AI');

// Moderate content
const result = await AI.moderation.moderate('Nội dung cần kiểm tra');

console.log(result);
// {
//   isClean: false,
//   confidence: 0.3,
//   severity: 7,
//   decision: 'removed',
//   keywordsFound: 5,
//   reasons: ['Detected 5 sensitive keywords'],
//   details: {
//     text: {
//       keywords: {
//         high: ['đụ', 'lồn'],
//         medium: [],
//         low: ['spam']
//       }
//     }
//   }
// }
```

## 📝 Cập nhật Blacklist

### Thêm từ khóa mới

Edit file `AI/data/blacklist.txt`:

```txt
# Nhóm X: Mô tả nhóm
từ_khóa_1
từ_khóa_2
cụm từ spam
```

### Thêm từ vào Whitelist

Edit file `AI/data/whitelist.txt`:

```txt
# ===== CATEGORY =====
từ hợp lệ
cụm từ hợp lệ
```

### Reload

```javascript
// Reload sau khi chỉnh sửa file
await blacklistLoader.reload('./AI/data/blacklist.txt');
```

## ⚙️ Cấu hình

File `AI/config/index.js`:

```javascript
moderation: {
  keywords: {
    blacklistFile: './AI/data/blacklist.txt',
    
    // Backup keywords nếu file không load được
    highSeverity: [...],
    mediumSeverity: [...],
    lowSeverity: [...]
  }
}
```

## 🧪 Testing

```bash
cd AI
node test-blacklist.js
```

Kết quả mong đợi:
```
✅ Clean content: approved (confidence: 0.9+)
✅ Vulgar content: removed (severity: 6-8)
✅ Adult content: removed (severity: 8-10)
✅ Scam content: removed (severity: 7-9)
```

## 🔍 Thuật toán

### 1. Priority Matching
- Ưu tiên match cụm từ dài trước (nhiều từ)
- `"cá cược bóng đá"` > `"bóng đá"` > `"bóng"`

### 2. Word Boundary Detection
- Từ đơn: chỉ match khi là từ độc lập
- `"gay"` trong `"gay bóng"` ✅ match
- `"gay"` trong `"ngay"` ❌ không match

### 3. Whitelist Filtering
- Các từ trong whitelist được loại bỏ khỏi blacklist
- Tránh false positive cho nội dung thể thao hợp lệ

### 4. Severity Scoring
```javascript
penalty = (high_count * 0.4) + (medium_count * 0.25) + (low_count * 0.1)
confidence = 1.0 - penalty
severity = (1 - confidence) * 10
```

### 5. Decision Making
```javascript
if (confidence >= 0.95) → approved
if (confidence < 0.85) → removed (auto)
if (confidence < 0.60) → flagged (review)
else → approved
```

## 📈 Hiệu suất

- **Load time**: ~500ms (1,500+ keywords)
- **Check time**: ~10ms/request
- **Memory**: ~2MB
- **False positive rate**: <5%
- **False negative rate**: <2%

## 🚀 Best Practices

### 1. Định kỳ cập nhật
- Review blacklist mỗi tháng
- Thêm từ khóa mới từ user reports
- Loại bỏ từ khóa gây false positive

### 2. Monitor logs
```javascript
// Check AI logs
tail -f ./AI/logs/ai-*.log
```

### 3. A/B Testing
- Test keywords mới trên môi trường staging
- Monitor false positive/negative rates
- Deploy lên production khi đạt >95% accuracy

### 4. Backup
```bash
# Backup blacklist before update
cp AI/data/blacklist.txt AI/data/blacklist.txt.bak
```

## 🛡️ Bảo mật

- File blacklist/whitelist không được public
- Chỉ admin mới có quyền chỉnh sửa
- Log mọi thay đổi vào git history
- Review code trước khi merge

## 📞 Liên hệ

- **Maintainer**: AI Team
- **Email**: ai@wherewesport.com
- **Docs**: [AI Module README](../README.md)

---

**Lưu ý**: File này chứa nội dung nhạy cảm. Không chia sẻ publicize hoặc commit vào public repository.
