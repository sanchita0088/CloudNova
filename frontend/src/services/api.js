import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  incidents: {
    list: async (status) => {
      const response = await client.get('/incidents', {
        params: status ? { status } : {},
      });
      return response.data;
    },
    simulate: async (type) => {
      const response = await client.post('/incidents/simulate', { type });
      return response.data;
    },
    resolve: async (id) => {
      const response = await client.post(`/incidents/${id}/resolve`);
      return response.data;
    },
    types: async () => {
      const response = await client.get('/incidents/types/available');
      return response.data.types || response.data;
    },
    analyze: async (incidentId) => {
      const response = await client.post(`/analysis/${incidentId}`);
      return response.data;
    },
  },
  rag: {
    ingest: async () => {
      const response = await client.post('/rag/ingest');
      return response.data;
    },
    search: async (query, k = 3) => {
      const response = await client.get('/rag/search', {
        params: { query, k },
      });
      return response.data;
    },
    query: async (query, k = 3) => {
      const response = await client.get('/rag/search', {
        params: { query, k },
      });
      return response.data;
    },
  },
  analysis: {
    trigger: async (incidentId) => {
      const response = await client.post(`/analysis/${incidentId}`);
      return response.data;
    },
    getReport: async (incidentId) => {
      const response = await client.get(`/analysis/${incidentId}/report`);
      return response.data;
    },
  },
  sandbox: {
    getState: async () => {
      const response = await client.get('/sandbox/state');
      return response.data;
    },
    simulate: async (type, demoMode = false) => {
      const response = await client.post('/sandbox/simulate', { type, demo_mode: demoMode });
      return response.data;
    },
    recover: async () => {
      const response = await client.post('/sandbox/recover');
      return response.data;
    },
  },
  system: {
    info: async () => {
      const response = await client.get('/system/info');
      return response.data;
    },
    getMode: async () => {
      const response = await client.get('/system/mode');
      return response.data;
    },
    setMode: async (mode) => {
      const response = await client.post('/system/mode', { mode });
      return response.data;
    },
  },
};
export default api;
