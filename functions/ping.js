export async function onRequest(context) {
  const TTL_MS = 24 * 60 * 60 * 1000;
  const ALLOWED_ORIGIN = 'https://supercut-editor.com';

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
    message: 'Ping successful'
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN
    }
  });
}
