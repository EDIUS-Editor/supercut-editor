// functions/ping.js
export async function onRequest(context) {
  console.log('🔍 Ping function called!', context.request.method, context.request.url);
// functions/ping.js
export async function onRequest(context) {
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const ALLOWED_ORIGIN = 'https://www.supercut-editor.com';

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store'
      }
    });
  }

  // Main response
  const validUntil = new Date(Date.now() + TTL_MS).toISOString();
  const responseData = {
    ok: true,
    serverTime: new Date().toISOString(),
    validUntil,
    message: 'Ping successful'
  };

  const body = JSON.stringify(responseData);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN
    }
  });
}
