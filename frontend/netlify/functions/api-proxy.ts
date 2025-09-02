import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// API proxy function for handling CORS and authentication
const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const { httpMethod, path, queryStringParameters, body, headers } = event;
  
  // Get backend API URL from environment
  const API_BASE_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';
  
  // Extract the API path
  const apiPath = path.replace('/.netlify/functions/api-proxy', '');
  const targetUrl = `${API_BASE_URL}${apiPath}`;
  
  // Add query parameters if present
  const url = new URL(targetUrl);
  if (queryStringParameters) {
    Object.entries(queryStringParameters).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value);
    });
  }
  
  try {
    // Forward the request to the backend API
    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers: {
        'Content-Type': headers['content-type'] || 'application/json',
        'Authorization': headers['authorization'] || '',
        'User-Agent': headers['user-agent'] || 'Netlify-Function',
      },
    };
    
    // Add body for POST/PUT requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      fetchOptions.body = body;
    }
    
    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.text();
    
    // Return the response with CORS headers
    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: data,
    };
  } catch (error) {
    console.error('API Proxy Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to proxy request to backend API',
      }),
    };
  }
};

export { handler };