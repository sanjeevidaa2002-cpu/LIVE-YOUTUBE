const API_BASE = '';

export class ApiError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('streamloop_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(netErr.message || 'Network error communicating with server', 0);
  }

  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/supabase-login')) {
    localStorage.removeItem('streamloop_token');
    localStorage.removeItem('streamloop_user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = data && typeof data === 'object' && data.error ? data.error : response.statusText || 'Request failed';
    throw new ApiError(errorMsg, response.status);
  }

  return data as T;
}
