// Edge function for geolocation-based API routing
export default async (request: Request, context: any) => {
  const url = new URL(request.url);
  
  // Only process API requests
  if (!url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Get user's country from Netlify context
  const country = context.geo?.country?.code || 'US';
  
  // Route to appropriate API endpoint based on location
  let apiBaseUrl: string;
  
  switch (country) {
    case 'JP':
      apiBaseUrl = 'https://api-jp.example.com';
      break;
    case 'EU':
    case 'DE':
    case 'FR':
    case 'IT':
    case 'ES':
      apiBaseUrl = 'https://api-eu.example.com';
      break;
    case 'AU':
      apiBaseUrl = 'https://api-au.example.com';
      break;
    default:
      apiBaseUrl = 'https://api-us.example.com';
  }
  
  // Construct the new URL
  const apiPath = url.pathname.replace('/api', '');
  const targetUrl = new URL(apiPath, apiBaseUrl);
  targetUrl.search = url.search;
  
  // Forward the request
  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' ? request.body : undefined,
  });
  
  // Add custom headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-API-Region', country);
  newResponse.headers.set('X-Served-By', 'Netlify Edge Function');
  
  return newResponse;
};