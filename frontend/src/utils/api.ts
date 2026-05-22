// Dynamically determine the API base URL based on the current environment
const getApiBase = (): string => {
  if (typeof window === "undefined") return "";
  
  // If we are working locally, point to the local FastAPI port
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }
  
  // In production (Vercel), let it use a relative path to leverage Vercel's routing rules
  return "";
};

const API_BASE = getApiBase();

export function getToken(): string | null {
  return localStorage.getItem('veriledger_token');
}

export function setToken(token: string) {
  localStorage.setItem('veriledger_token', token);
}

export function removeToken() {
  localStorage.removeItem('veriledger_token');
  localStorage.removeItem('veriledger_user');
}

export function getStoredUser() {
  const user = localStorage.getItem('veriledger_user');
  if (user) {
    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredUser(user: any) {
  localStorage.setItem('veriledger_user', JSON.stringify(user));
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Combine the dynamic base URL with the exact network endpoint path
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const text = await response.text();
      try {
        const errorJson = JSON.parse(text);
        errorMsg = errorJson.detail || errorMsg;
      } catch {
        errorMsg = text || errorMsg;
      }
    } catch {
      // Ignore text reading failure
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

export const api = {
  async register(data: any) {
    return request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async login(data: any) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.access_token) {
      setToken(res.access_token);
      setStoredUser(res.user);
    }
    return res;
  },

  async getReviewers(role: string) {
    return request(`/api/users/reviewers?role=${role}`);
  },

  async createSheet(formData: FormData) {
    return request('/api/sheets', {
      method: 'POST',
      body: formData,
    });
  },

  async updateSheet(id: string, formData: FormData) {
    return request(`/api/sheets/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },

  async getSheets() {
    return request('/api/sheets');
  },

  async getSheetDetail(id: string) {
    return request(`/api/sheets/${id}`);
  },

  async transitionSheet(id: string, action: string, targetUserId?: string, notes?: string) {
    return request(`/api/sheets/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, target_user_id: targetUserId, notes }),
    });
  },

  getFileUrl(path: string) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${API_BASE}${path}`;
  },

  async getDeadlines() {
    return request('/api/deadlines');
  },

  async createDeadline(data: any) {
    return request('/api/deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getComments(sheetId: string) {
    return request(`/api/sheets/${sheetId}/comments`);
  },

  async createComment(sheetId: string, text: string) {
    return request(`/api/sheets/${sheetId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  },

  async markCommentsAsRead(sheetId: string) {
    return request(`/api/sheets/${sheetId}/comments/read`, {
      method: 'POST',
    });
  },

  async getUnreadCommentsCount() {
    return request('/api/sheets/comments/unread-count');
  }
};