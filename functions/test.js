// functions/test.js
export async function onRequest(context) {
  console.log('TEST FUNCTION CALLED!');
  
  return new Response(JSON.stringify({
    message: 'Test function working!',
    timestamp: new Date().toISOString(),
    method: context.request.method,
    url: context.request.url
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}