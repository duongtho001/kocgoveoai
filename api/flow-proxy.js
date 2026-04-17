/**
 * Vercel Serverless Proxy for Flow API
 * Bypasses CORS by making server-side requests to Flow API (Cloudflare tunnel)
 * 
 * Usage: POST /api/flow-proxy
 * Body: { method, path, body, isFormData }
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const FLOW_API_URL = (process.env.VITE_FLOW_API_URL || '').replace(/\/+$/, ''); // Strip trailing slash
  const FLOW_API_KEY = process.env.VITE_FLOW_API_KEY || '';

  if (!FLOW_API_URL) {
    return res.status(500).json({ error: 'VITE_FLOW_API_URL not configured' });
  }

  try {
    const { method = 'GET', path = '', body, isFormData } = req.body || {};

    const targetUrl = `${FLOW_API_URL}${path}`;
    
    const headers = {};
    if (FLOW_API_KEY) headers['X-API-Key'] = FLOW_API_KEY;

    const fetchOptions = {
      method: method || 'GET',
      headers,
    };

    // Handle file upload (base64 dataUrl → FormData)
    if (isFormData && body?.dataUrl) {
      const { dataUrl, filename } = body;
      // Convert base64 data URL to binary
      const base64Data = dataUrl.split(',')[1] || dataUrl;
      const binaryData = Buffer.from(base64Data, 'base64');
      
      // Detect mime type from data URL
      const mimeMatch = dataUrl.match(/^data:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      // Build multipart form data manually
      const boundary = '----FormBoundary' + Date.now().toString(36);
      const formParts = [];
      formParts.push(`--${boundary}\r\n`);
      formParts.push(`Content-Disposition: form-data; name="file"; filename="${filename || 'image.png'}"\r\n`);
      formParts.push(`Content-Type: ${mimeType}\r\n\r\n`);
      
      const headerBuf = Buffer.from(formParts.join(''));
      const footerBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
      
      fetchOptions.body = Buffer.concat([headerBuf, binaryData, footerBuf]);
      fetchOptions.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    } else if (body && method !== 'GET') {
      // Regular JSON body
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    console.log(`[flow-proxy] ${method} ${targetUrl}`);
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
