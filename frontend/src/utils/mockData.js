/**
 * Mock data for production when backend is not available
 * This allows UI testing without a live backend
 */

export const mockUser = {
  AccountID: 1,
  Username: 'demo_user',
  FullName: 'Demo User',
  Email: 'demo@example.com',
  AvatarUrl: 'https://ui-avatars.com/api/?name=Demo+User&background=4F46E5&color=fff',
  PhoneNumber: '0123456789',
  Role: 'User'
};

export const mockLogin = async (identifier, password) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Accept any credentials for demo
  return {
    success: true,
    message: 'Đăng nhập thành công (Mock Mode)',
    data: {
      user: mockUser,
      token: 'mock-jwt-token-' + Date.now()
    }
  };
};

export const mockGetCurrentUser = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    success: true,
    data: mockUser
  };
};

export const mockPosts = [
  {
    PostID: 1,
    Content: 'Chào mừng đến với ứng dụng! Đây là bài viết demo. Backend sẽ sớm được deploy.',
    CreatedAt: new Date().toISOString(),
    Author: mockUser,
    LikeCount: 10,
    CommentCount: 3,
    ShareCount: 1
  },
  {
    PostID: 2,
    Content: 'Frontend đã được deploy thành công trên Vercel! 🎉',
    CreatedAt: new Date(Date.now() - 3600000).toISOString(),
    Author: mockUser,
    LikeCount: 25,
    CommentCount: 8,
    ShareCount: 5
  }
];

export const mockGetFeed = async () => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    success: true,
    data: mockPosts,
    pagination: {
      page: 1,
      limit: 10,
      total: mockPosts.length
    }
  };
};

export const mockStories = [
  {
    StoryID: 1,
    AccountID: mockUser.AccountID,
    Author: mockUser,
    MediaUrl: 'https://picsum.photos/400/600',
    CreatedAt: new Date().toISOString(),
    ExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    ViewCount: 15
  }
];

export const mockGetStories = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    success: true,
    data: mockStories
  };
};

export const mockConversations = [
  {
    ConversationID: 1,
    Participant: {
      AccountID: 2,
      FullName: 'Bạn bè Demo',
      AvatarUrl: 'https://ui-avatars.com/api/?name=Friend&background=10B981&color=fff'
    },
    LastMessage: {
      Content: 'Xin chào! Đây là tin nhắn demo.',
      CreatedAt: new Date().toISOString()
    },
    UnreadCount: 2
  }
];

export const mockGetConversations = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    success: true,
    data: mockConversations
  };
};
