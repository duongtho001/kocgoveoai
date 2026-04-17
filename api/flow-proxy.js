/**
 * Vercel Serverless Proxy for Flow API
 * Bypasses CORS by making server-side requests to Flow API (ngrok)
 * 
 * Usage: POST /api/flow-proxy
 * Body: { method, path, body }
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const FLOW_API_URL = process.env.VITE_FLOW_API_URL || '';
  const FLOW_API_KEY = process.env.VITE_FLOW_API_KEY || '';

  if (!FLOW_API_URL) {
    return res.status(500).json({ error: 'VITE_FLOW_API_URL not configured' });
  }

  try {
    const { method = 'GET', path = '', body, isFormData } = req.body || {};

    const targetUrl = `${FLOW_API_URL}${path}`;
    
    const headers = {};
    if (FLOW_API_KEY) headers['X-API-Key'] = FLOW_API_KEY;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const fetchOptions = {
      method: method || 'GET',
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else if (contentType.includes('image') || contentType.includes('video')) {
      // Binary content - forward as base64
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ 
        data: base64, 
        mimeType: contentType,
        url: targetUrl 
      });
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('[flow-proxy] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
