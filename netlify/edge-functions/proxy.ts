import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  
  // Extract target URL from path `/file/...`
  let targetUrl = url.pathname.replace(/^\/file\//, '');

  if (!targetUrl) {
    // Fallback to query param
    targetUrl = url.searchParams.get("url") || "";
  }

  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Handle double slash normalization by some clients/servers
  if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
      targetUrl = targetUrl.replace('http:/', 'http://');
  } else if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
      targetUrl = targetUrl.replace('https:/', 'https://');
  } else if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl; // Default to https
  }

  // Append query string if any exist and wasn't part of the targetUrl already
  if (url.search && !url.searchParams.has('url')) {
      targetUrl += url.search;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      }
    });

    const headers = new Headers(response.headers);
    
    headers.delete("x-frame-options");
    headers.delete("content-security-policy");
    headers.delete("set-cookie");

    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy error", details: String(error) }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
