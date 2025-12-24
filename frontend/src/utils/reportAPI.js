import apiClient from './apiClient';

export const reportAPI = {
  /**
   * Create a new report
   */
  create: async (contentType, contentId, reason, description = '') => {
    try {
      const response = await apiClient.post('/reports', {
        contentType,
        contentId,
        reason,
        description
      });
      return response.data;
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  },

  /**
   * Get all reports (Admin only)
   */
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.contentType) params.append('contentType', filters.contentType);

      const response = await apiClient.get(`/reports?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error getting reports:', error);
      throw error;
    }
  },

  /**
   * Get report by ID (Admin only)
   */
  getById: async (reportId) => {
    try {
      const response = await apiClient.get(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting report:', error);
      throw error;
    }
  },

  /**
   * Update report status (Admin only)
   */
  update: async (reportId, status, adminNote = '', deleteContent = false) => {
    try {
      const response = await apiClient.patch(`/reports/${reportId}`, {
        status,
        adminNote,
        deleteContent
      });
      return response.data;
    } catch (error) {
      console.error('Error updating report:', error);
      throw error;
    }
  },

  /**
   * Get report statistics (Admin only)
   */
  getStats: async () => {
    try {
      const response = await apiClient.get('/reports/stats');
      return response.data;
    } catch (error) {
      console.error('Error getting report stats:', error);
      throw error;
    }
  }
};

export default reportAPI;
