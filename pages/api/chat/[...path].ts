import type { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = process.env.CHAT_API_URL || 'http://localhost:8000';

/**
 * API Proxy for chat endpoints.
 * Forwards all /api/chat/* requests to the FastAPI backend.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query;

  // Build the target URL
  const pathString = Array.isArray(path) ? path.join('/') : path;
  const queryString = Object.entries(req.query)
    .filter(([key]) => key !== 'path')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  const targetUrl = `${API_BASE_URL}/api/student/chat/${pathString}${
    queryString ? `?${queryString}` : ''
  }`;

  try {
    // Forward the request headers, including cookies for auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward session cookies
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }

    // Forward authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Make the request to the backend
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body:
        req.method !== 'GET' && req.method !== 'HEAD'
          ? JSON.stringify(req.body)
          : undefined,
    });

    // Get response data - handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      // Backend returned non-JSON (likely an error page)
      const text = await response.text();
      console.error('Chat API returned non-JSON:', text);
      res.status(response.status).json({
        error: 'Chat service error',
        detail: process.env.NODE_ENV === 'development' ? text : undefined,
      });
    }
  } catch (error) {
    console.error('Chat API proxy error:', error);
    res.status(502).json({
      error:
        'Failed to connect to chat service. Is the FastAPI server running on port 8000?',
      detail:
        process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
