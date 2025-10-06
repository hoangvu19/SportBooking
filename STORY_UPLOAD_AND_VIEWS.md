# Story Feature - Upload Ảnh/Video và Lượt Xem ✅

## 🎯 Các Tính Năng Đã Thêm

### 1. ✅ Upload Ảnh/Video lên Story
- Upload file ảnh (jpg, png, gif, etc.)
- Upload video (mp4, webm, etc.)
- Kích thước tối đa: 50MB
- Preview ảnh/video trước khi đăng
- Tự động xác định loại media (image/video)

### 2. ✅ Tracking Lượt Xem
- Ghi nhận ai đã xem story nào
- Không cho phép xem trùng lặp (1 user chỉ được tính 1 lần)
- Lưu thời gian xem

### 3. ✅ Hiển Thị Số Lượt Xem
- Chủ story thấy số lượt xem
- Click vào số lượt xem để xem danh sách người xem
- Hiển thị avatar, tên, username, thời gian xem

---

## 📂 Backend Changes

### 1. Database Migration
**File**: `backend/migrations/005_create_story_view_table.sql`

```sql
CREATE TABLE StoryView (
    StoryViewID INT IDENTITY(1,1) PRIMARY KEY,
    StoryID INT NOT NULL,
    ViewerAccountID INT NOT NULL,
    ViewedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_StoryView_Story FOREIGN KEY (StoryID),
    CONSTRAINT FK_StoryView_Account FOREIGN KEY (ViewerAccountID),
    CONSTRAINT UQ_StoryView_Story_Viewer UNIQUE (StoryID, ViewerAccountID)
);
```

✅ **Thực thi**: Migration đã được chạy thành công

### 2. Models & DAL

**`backend/models/StoryView.js`**
- Class StoryView với toFrontendFormat()
- Validation cho story view data

**`backend/DAL/StoryViewDAL.js`**
- `recordView(storyId, viewerAccountId)` - Ghi nhận lượt xem
- `getStoryViewers(storyId)` - Lấy danh sách người xem
- `getViewCount(storyId)` - Đếm số lượt xem
- `hasUserViewed(storyId, accountId)` - Check đã xem chưa

### 3. Upload Middleware

**`backend/middleware/upload.js`**
- Sử dụng multer để xử lý file upload
- Filter: chỉ cho phép ảnh và video
- Kích thước max: 50MB
- Lưu file vào: `backend/uploads/stories/`
- Tên file: `story-{timestamp}-{random}-{filename}.ext`

### 4. Controller Updates

**`backend/controllers/storyController.js`**

**Cập nhật `createStory()`:**
- Nhận file từ `req.file` (multer middleware)
- Xác định mediaType từ file.mimetype
- Lưu relative path vào database

**Thêm mới:**
- `viewStory()` - Record view trong StoryView table
- `getStoryViewers()` - Lấy danh sách người xem (chỉ chủ story)
- `getStoryViewCount()` - Lấy số lượt xem (public)

### 5. Routes Updates

**`backend/routes/storyRoutes.js`**

```javascript
// Thêm upload middleware
const { uploadStoryMedia } = require('../middleware/upload');

// Create story với file upload
router.post('/', authenticateToken, uploadStoryMedia, createStory);

// New endpoints
router.post('/:storyId/view', authenticateToken, viewStory);
router.get('/:storyId/viewers', authenticateToken, getStoryViewers);
router.get('/:storyId/views/count', getStoryViewCount);
```

### 6. Dependencies
```json
{
  "multer": "^1.4.5-lts.1"
}
```

✅ **Cài đặt**: `npm install multer` - Hoàn tất

---

## 🎨 Frontend Changes

### 1. API Integration

**`frontend/src/utils/api.js`**

**Cập nhật `storyAPI.create()`:**
- Hỗ trợ FormData cho file upload
- Tự động detect FormData vs JSON
- Không set Content-Type cho FormData (để browser tự động set với boundary)

**Thêm mới:**
```javascript
// Get viewers list
getViewers: async (storyId) => {
    return apiCall(`/stories/${storyId}/viewers`);
},

// Get view count
getViewCount: async (storyId) => {
    return apiCall(`/stories/${storyId}/views/count`);
},
```

### 2. Story Creation Modal

**`frontend/src/components/StoryModel.jsx`**

**Cập nhật `handleCreateStory()`:**

**Text Story:**
```javascript
const storyData = {
    content: text.trim(),
    mediaType: 'text',
    backgroundColor: background
};
await storyAPI.create(storyData);
```

**Image/Video Story:**
```javascript
const formData = new FormData();
formData.append('media', media);  // File object
formData.append('content', text.trim() || '');
formData.append('backgroundColor', background);
await storyAPI.create(formData);  // Upload file
```

**Upload Flow:**
1. User chọn file → `handleMediaUpload()`
2. Create preview URL → `URL.createObjectURL(file)`
3. Hiển thị preview
4. Submit → Upload file trong FormData
5. Backend xử lý upload → trả về story với media URL

### 3. Story Viewer

**`frontend/src/components/StoryViewer.jsx`**

**Thêm Features:**

1. **Auto-track View:**
```javascript
useEffect(() => {
    if (viewStory && user) {
        storyAPI.view(viewStory._id).catch(console.error);
        fetchViewCount();
    }
}, [viewStory, user]);
```

2. **Hiển thị View Count** (chỉ cho chủ story):
```jsx
{isOwnStory && (
  <div onClick={fetchViewers}>
    <Eye size={18} />
    <span>{viewCount}</span>
  </div>
)}
```

3. **Viewers List Modal:**
```jsx
{showViewers && (
  <div className='absolute bottom-0 ...'>
    <h3>Người xem ({viewers.length})</h3>
    {viewers.map(viewer => (
      <div>
        <img src={viewer.viewer.profile_picture} />
        <p>{viewer.viewer.full_name}</p>
        <p>@{viewer.viewer.username}</p>
        <span>{new Date(viewer.viewed_at).toLocaleTimeString()}</span>
      </div>
    ))}
  </div>
)}
```

---

## 🧪 Testing Guide

### Test 1: Upload Ảnh Story
1. Login vào app
2. Click "Create Story"
3. Click tab "Photo/Video"
4. Chọn 1 file ảnh (jpg, png)
5. Xem preview ảnh
6. Click "Create Story"
7. ✅ Story với ảnh xuất hiện trong stories bar

### Test 2: Upload Video Story
1. Click "Create Story"
2. Click tab "Photo/Video"
3. Chọn 1 file video (mp4)
4. Xem preview video
5. Thêm text caption (optional)
6. Click "Create Story"
7. ✅ Story với video xuất hiện
8. ✅ Click xem → video tự động play

### Test 3: View Tracking
1. User A tạo story
2. User B xem story của User A
3. ✅ Lượt xem được ghi nhận
4. User A click vào biểu tượng mắt
5. ✅ Thấy User B trong danh sách người xem

### Test 4: View Count
1. Tạo story mới
2. Đăng nhập nhiều accounts khác nhau
3. Xem story
4. ✅ Số lượt xem tăng lên
5. ✅ Không tăng khi cùng user xem lại

### Test 5: Viewers List
1. Login account chủ story
2. Xem story của mình
3. Click vào số lượt xem (icon mắt)
4. ✅ Modal hiển thị danh sách người xem
5. ✅ Thấy avatar, tên, username, thời gian xem

---

## 📊 API Endpoints Summary

### Story CRUD
```
POST   /api/stories              Create story (with file upload)
GET    /api/stories              Get all active stories
GET    /api/stories/user/:userId Get user's stories
DELETE /api/stories/:storyId     Delete story (owner only)
```

### Story Views
```
POST /api/stories/:storyId/view           Record view (authenticated)
GET  /api/stories/:storyId/viewers        Get viewers list (owner only)
GET  /api/stories/:storyId/views/count    Get view count (public)
```

---

## 🎨 UI/UX Features

### Story Creation
- ✅ Text mode với custom background colors
- ✅ Photo/Video mode với file picker
- ✅ Preview trước khi đăng
- ✅ Loading state khi upload
- ✅ Success/error toast notifications

### Story Viewing
- ✅ Auto-play video stories
- ✅ Progress bar (10 seconds per story)
- ✅ View count badge (chỉ chủ story thấy)
- ✅ Click để xem danh sách người xem
- ✅ Close button

### Viewers List
- ✅ Sliding modal từ dưới lên
- ✅ Avatar + tên + username
- ✅ Thời gian xem (HH:MM format)
- ✅ Scroll nếu nhiều người xem
- ✅ Close button

---

## 🔒 Security & Permissions

### Authentication Required
- ✅ Create story
- ✅ View story (để track view)
- ✅ Delete story

### Authorization
- ✅ Chỉ chủ story mới xem được danh sách người xem
- ✅ Chỉ chủ story mới xóa được story
- ✅ View count public (ai cũng xem được)

### File Upload Security
- ✅ File type filter (chỉ image/* và video/*)
- ✅ File size limit (50MB)
- ✅ Unique filename để tránh conflict
- ✅ Stored trong uploads/stories/ folder

---

## 📝 Database Schema

### Story Table (đã có)
```sql
CREATE TABLE Story (
    StoryID INT PRIMARY KEY,
    AccountID INT,
    Content NVARCHAR(500),
    MediaUrl NVARCHAR(MAX),        -- Path to uploaded file
    MediaType VARCHAR(20),          -- text/image/video
    BackgroundColor VARCHAR(10),
    CreatedDate DATETIME,
    ExpiresAt AS DATEADD(HOUR, 24, CreatedDate),  -- Computed
    Status VARCHAR(20),
    ViewCount INT  -- Deprecated, use StoryView count instead
);
```

### StoryView Table (mới)
```sql
CREATE TABLE StoryView (
    StoryViewID INT PRIMARY KEY,
    StoryID INT,                    -- FK to Story
    ViewerAccountID INT,            -- FK to Account  
    ViewedAt DATETIME,              -- Timestamp
    UNIQUE (StoryID, ViewerAccountID)  -- Prevent duplicate views
);
```

---

## ✅ Completion Checklist

### Backend
- [x] Tạo StoryView table migration
- [x] Tạo StoryView model
- [x] Tạo StoryViewDAL với CRUD methods
- [x] Cài đặt multer middleware
- [x] Tạo upload middleware
- [x] Update StoryController để xử lý file upload
- [x] Update StoryController với view tracking APIs
- [x] Update routes với upload middleware và view endpoints
- [x] Serve uploads folder

### Frontend
- [x] Update storyAPI.create() để hỗ trợ FormData
- [x] Thêm getViewers() và getViewCount() vào storyAPI
- [x] Update StoryModel để upload file
- [x] Update StoryModel để preview media
- [x] Update StoryViewer để track view
- [x] Update StoryViewer để hiển thị view count
- [x] Tạo Viewers List modal
- [x] Styling và UI polish

### Testing
- [x] Test text story creation
- [x] Test image story upload
- [x] Test video story upload
- [x] Test view tracking
- [x] Test viewers list
- [x] Test permissions (owner only)

---

## 🚀 Status: HOÀN TẤT!

Tất cả 3 tính năng đã được implement thành công:

1. ✅ **Upload ảnh/video lên story**
2. ✅ **Lượt xem story** (tracking ai đã xem)
3. ✅ **Danh sách người xem story**

**Bạn có thể:**
- Tạo story text với background màu
- Upload và đăng ảnh lên story
- Upload và đăng video lên story
- Xem ai đã xem story của bạn
- Thấy số lượt xem và thời gian xem

🎉 **Chúc mừng! Story feature đã hoàn chỉnh!**
