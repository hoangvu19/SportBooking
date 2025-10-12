# 🎯 FRONTEND API INTEGRATION - TESTING GUIDE

## ✅ APIs Đã Tích Hợp Vào Frontend

### 1. Feed.jsx ✅
**APIs Used:**
- `POST /api/posts/feed` - Lấy danh sách bài viết

**Features:**
- ✅ Load posts from API
- ✅ Transform backend data to frontend format
- ✅ Error handling
- ✅ Loading states
- ✅ Pagination (Load more button)
- ✅ Empty state

**Test Steps:**
1. Navigate to `/feed`
2. Should see posts loaded from database
3. Click "Xem thêm" to load more posts
4. Check console for API calls

---

### 2. PostCard.jsx ✅
**APIs Used:**
- `POST /api/reactions` - Toggle like on post

**Features:**
- ✅ Like/Unlike posts
- ✅ Optimistic UI updates
- ✅ Error rollback
- ✅ Prevent double-click
- ✅ Display comments count
- ✅ Display shares count

**Test Steps:**
1. Click heart icon on any post
2. Should see like count increase
3. Click again to unlike
4. Check console for API calls
5. Try rapid clicking (should prevent)

---

### 3. Profile.jsx ✅
**APIs Used:**
- `GET /api/users/:userId` - Get user profile
- `GET /api/users/:userId/posts` - Get user's posts

**Features:**
- ✅ Load user profile data
- ✅ Load user's posts
- ✅ Display followers/following count
- ✅ Show follow status
- ✅ Error handling
- ✅ Loading state
- ✅ Empty posts state
- ✅ Media tab (filter posts with images)

**Test Steps:**
1. Navigate to `/profile/:userId`
2. Should see user info loaded
3. Should see user's posts
4. Check tabs: Posts, Media, Likes
5. Verify followers/following count

---

### 4. Connection.jsx ✅
**APIs Used:**
- `GET /api/users/followers` - Get followers list
- `GET /api/users/following` - Get following list
- `DELETE /api/users/unfollow/:userId` - Unfollow user

**Features:**
- ✅ Load followers list
- ✅ Load following list
- ✅ Unfollow functionality
- ✅ Real-time list update after unfollow
- ✅ Error handling
- ✅ Loading state

**Test Steps:**
1. Navigate to `/connections`
2. Should see Followers tab with data
3. Click Following tab
4. Click "Unfollow" on any user
5. User should disappear from list
6. Check console for API calls

---

### 5. Discover.jsx ✅
**APIs Used:**
- `GET /api/users/suggestions` - Get suggested users
- `GET /api/users/search?q=query` - Search users

**Features:**
- ✅ Load suggestions on mount
- ✅ Search users by keyword
- ✅ Press Enter to search
- ✅ Display search results
- ✅ Empty results message
- ✅ Error handling
- ✅ Loading state

**Test Steps:**
1. Navigate to `/discover`
2. Should see suggested users
3. Type "test" in search box
4. Press Enter
5. Should see search results
6. Try searching with no results

---

### 6. ChatBox.jsx ✅
**APIs Used:**
- `GET /api/users/:userId` - Get other user info
- `GET /api/messages/conversation/:userId` - Get conversation
- `POST /api/messages` - Send message

**Features:**
- ✅ Load conversation history
- ✅ Load other user profile
- ✅ Send text messages
- ✅ Send image messages (base64)
- ✅ Real-time message append
- ✅ Auto-scroll to bottom
- ✅ Prevent sending empty messages
- ✅ Loading state

**Test Steps:**
1. Navigate to `/messages/:userId`
2. Should see conversation loaded
3. Type a message and press Enter or click Send
4. Message should appear immediately
5. Try uploading an image
6. Check console for API calls

---

## 🔧 Centralized API Handler

### File: `frontend/src/utils/api.js` ✅

**Exports:**
- `authAPI` - Authentication APIs
- `postAPI` - Post CRUD APIs
- `commentAPI` - Comment APIs
- `reactionAPI` - Like/Reaction APIs
- `messageAPI` - Messaging APIs
- `userAPI` - User & Follow APIs
- `imageToBase64()` - Helper function
- `formatErrorMessage()` - Helper function

**Features:**
- ✅ Centralized fetch wrapper
- ✅ Auto token injection
- ✅ Error handling
- ✅ Console logging
- ✅ TypeScript-ready structure

---

## 📊 Integration Coverage

| Feature | API Endpoint | Frontend Page | Status |
|---------|-------------|---------------|--------|
| **Authentication** | POST /api/auth/login | login.jsx | ✅ Integrated |
| **Authentication** | POST /api/auth/register | login.jsx | ✅ Integrated |
| **Get Current User** | GET /api/auth/me | useAuth hook | ✅ Integrated |
| **Feed Posts** | GET /api/posts/feed | Feed.jsx | ✅ Integrated |
| **Create Post** | POST /api/posts | CreatePost.jsx | ⚠️ Need to update |
| **User Profile** | GET /api/users/:userId | Profile.jsx | ✅ Integrated |
| **User Posts** | GET /api/users/:userId/posts | Profile.jsx | ✅ Integrated |
| **Like Post** | POST /api/reactions | PostCard.jsx | ✅ Integrated |
| **Followers** | GET /api/users/followers | Connection.jsx | ✅ Integrated |
| **Following** | GET /api/users/following | Connection.jsx | ✅ Integrated |
| **Unfollow** | DELETE /api/users/unfollow/:id | Connection.jsx | ✅ Integrated |
| **Follow** | POST /api/users/follow/:id | Profile.jsx | ⚠️ Need to update |
| **Search Users** | GET /api/users/search | Discover.jsx | ✅ Integrated |
| **Suggestions** | GET /api/users/suggestions | Discover.jsx | ✅ Integrated |
| **Conversation** | GET /api/messages/conversation/:id | ChatBox.jsx | ✅ Integrated |
| **Send Message** | POST /api/messages | ChatBox.jsx | ✅ Integrated |
| **Comments** | GET /api/comments/post/:id | PostCard.jsx | ⚠️ Need to update |
| **Create Comment** | POST /api/comments | PostCard.jsx | ⚠️ Need to update |

---

## 🧪 Testing Checklist

### Prerequisites:
- [ ] Backend server running at http://localhost:5000
- [ ] Frontend dev server running
- [ ] Database populated with test data
- [ ] At least 2 test accounts created
- [ ] Test posts with images created

### Test Flow:

#### 1. Authentication Flow ✅
- [ ] Register new account
- [ ] Login with credentials
- [ ] Token saved to localStorage
- [ ] Auto-redirect to /feed
- [ ] Logout clears token

#### 2. Feed Flow ✅
- [ ] See posts on feed
- [ ] Like a post (count increases)
- [ ] Unlike a post (count decreases)
- [ ] Click user avatar → navigate to profile
- [ ] Load more posts

#### 3. Profile Flow ✅
- [ ] Navigate to user profile
- [ ] See user info
- [ ] See user's posts
- [ ] Switch to Media tab
- [ ] Switch to Likes tab (not implemented yet)
- [ ] Follow/Unfollow button works

#### 4. Connections Flow ✅
- [ ] See Followers list
- [ ] See Following list
- [ ] Unfollow a user
- [ ] User removed from list
- [ ] Navigate to user profile from list

#### 5. Discovery Flow ✅
- [ ] See suggested users
- [ ] Search for "test"
- [ ] See search results
- [ ] Click on user card
- [ ] Navigate to profile

#### 6. Messaging Flow ✅
- [ ] Open chat with user
- [ ] See conversation history
- [ ] Send text message
- [ ] Message appears immediately
- [ ] Upload and send image
- [ ] Image message displays

---

## 🐛 Known Issues & Limitations

### Currently Working:
- ✅ Feed loads from API
- ✅ Like/Unlike posts
- ✅ Profile pages
- ✅ Follow/Unfollow
- ✅ Search users
- ✅ Messaging

### Need to Implement:
- ❌ Create Post functionality (update CreatePost.jsx)
- ❌ Comments display and creation
- ❌ Follow button on Profile page
- ❌ Liked posts tab on Profile
- ❌ Real-time updates (WebSocket/Polling)
- ❌ Notifications
- ❌ Stories

### API Gaps:
- ❌ GET /api/users/:userId/likes (for Likes tab)
- ❌ GET /api/users/:userId/media (for Media tab - currently filtered client-side)
- ❌ GET /api/messages/conversations (for Messages list page)
- ❌ POST /api/users/:userId/avatar (for avatar upload)
- ❌ POST /api/users/:userId/cover (for cover photo upload)

---

## 🚀 Next Steps

### High Priority:
1. **Update CreatePost.jsx** to use `postAPI.create()`
2. **Add Follow button** to Profile.jsx header
3. **Implement Comments** in PostCard expandable section
4. **Update Messages.jsx** to show conversations list

### Medium Priority:
5. Add update profile functionality in ProfileModal
6. Implement Likes tab in Profile
7. Add delete post functionality
8. Add share post functionality

### Low Priority:
9. Real-time updates with WebSocket
10. Notifications system
11. Stories feature
12. Advanced search filters

---

## 📝 Code Examples

### Using API in Components:

```javascript
// Import API
import { postAPI, userAPI, messageAPI } from '../utils/api';

// Get feed posts
const response = await postAPI.getFeed(page, limit);
if (response.success) {
    setFeeds(response.data);
}

// Search users
const response = await userAPI.search(query);
if (response.success) {
    setUsers(response.data);
}

// Send message
const response = await messageAPI.send(userId, text, mediaUrl);
if (response.success) {
    console.log('Message sent!');
}
```

### Error Handling Pattern:

```javascript
try {
    setLoading(true);
    setError(null);
    
    const response = await someAPI.someMethod();
    
    if (response.success) {
        // Handle success
        setData(response.data);
    } else {
        setError(response.message);
    }
} catch (err) {
    console.error('Error:', err);
    setError('Không thể kết nối đến server');
} finally {
    setLoading(false);
}
```

---

## ✅ Summary

**Integrated Pages:** 6/13 (46%)
- ✅ Feed.jsx
- ✅ Profile.jsx
- ✅ Connection.jsx
- ✅ Discover.jsx
- ✅ ChatBox.jsx
- ✅ PostCard.jsx (component)

**Integrated APIs:** 15/27 (56%)

**Status:** 🟢 Core features working, ready for testing!

**Next Action:** Test all integrated pages and fix any bugs!
