

import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { notificationAPI } from "../utils/api";

// Mock fetch and localStorage for Node test environment
beforeAll(() => {
  globalThis.fetch = jest.fn((url, options) => {
    if (url.endsWith('/notifications')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, notifications: [{ id: 1, text: 'Test notification', read: false }] })
      });
    }
    if (url.endsWith('/notifications/read-all')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });
    }
    return Promise.reject(new Error('Unknown endpoint'));
  });
  globalThis.localStorage = {
    getItem: jest.fn(() => 'test-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
});

describe("Notification API integration", () => {
  it("should return an array of notifications for the current user", async () => {
    const res = await notificationAPI.getAll();
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.notifications)).toBe(true);
    expect(res.notifications[0].text).toBe('Test notification');
  });

  it("should mark all notifications as read", async () => {
    const res = await notificationAPI.markAllRead();
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
  });
});
