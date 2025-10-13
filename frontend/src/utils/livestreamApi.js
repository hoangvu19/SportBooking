import api from './api';

export default {
  listActive: (limit = 20) => api.get(`/livestreams/active?limit=${limit}`).then(r => r.data),
  create: (payload) => api.post('/livestreams', payload).then(r => r.data),
  getById: (id) => api.get(`/livestreams/${id}`).then(r => r.data),
  end: (id) => api.put(`/livestreams/${id}/end`).then(r => r.data)
};
