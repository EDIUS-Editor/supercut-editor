// functions/ping.js
export async function onRequest(context) {
  // CONFIG
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — change if you want shorter/longer
  const ALLOWED_ORIGIN = "https://bc11603c.supercut-editor.pages.dev"; // your site

  // Handle CORS preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "no-store"
      }
    });
  }

  const validUntil = new Date(Date.now() + TTL_MS).toISOString();
  const payload = {
    ok: true,
    serverTime: new Date().toISOString(),
    validUntil
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN
    }
  });
}


