// /functions/ping.js (Pages Function)
export async function onRequest(context) {
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const ALLOWED_ORIGIN = 'https://www.supercut-editor.com'; 

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

  const validUntil = new Date(Date.now() + TTL_MS).toISOString();
  const body = JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    validUntil,
    // Optional: Add more validation data
    domain: new URL(context.request.url).hostname
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      // Optional: Add security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
}
