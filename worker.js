// ================= CONFIG =================
const CHANNELS = {
  asports: {
    source: "http://210.4.72.204/hls-live/livepkgr/_definst_/liveevent/livestream3.m3u8"
  }
};

let tokenCache = {};

// ================= WORKER =================
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    // Debug root
    if (path === "/") {
      return new Response(
        "HridoyTV Proxy is running",
        { headers: cors() }
      );
    }

    // Playlist: /asports.m3u8
    if (path.endsWith(".m3u8")) {
      const name = path.replace("/", "").replace(".m3u8", "");
      if (!CHANNELS[name]) return notFound();

      const realUrl = await getFreshUrl(name);
      return proxyPlaylist(realUrl, url.origin);
    }

    // Segments & keys: /seg?u=
    if (path === "/seg") {
      const target = url.searchParams.get("u");
      if (!target) return notFound();
      return proxyBinary(target);
    }

    return notFound();
  }
};

// ================= TOKEN =================
async function getFreshUrl(name) {
  const now = Date.now() / 1000;

  if (tokenCache[name] && tokenCache[name].exp > now + 30) {
    return tokenCache[name].url;
  }

  const res = await fetch(CHANNELS[name].source, {
    headers: defaultHeaders()
  });

  const finalUrl = res.url;
  const exp = new URL(finalUrl).searchParams.get("e") || (now + 300);

  tokenCache[name] = {
    url: finalUrl,
    exp: Number(exp)
  };

  return finalUrl;
}

// ================= PLAYLIST =================
async function proxyPlaylist(target, origin) {
  const res = await fetch(target, {
    headers: defaultHeaders()
  });

  let text = await res.text();

  // rewrite all absolute URLs
  text = text.replace(/https?:\/\/[^\s"]+/g, m =>
    `${origin}/seg?u=${encodeURIComponent(m)}`
  );

  return new Response(text, {
    headers: {
      ...cors(),
      "Content-Type": "application/vnd.apple.mpegurl"
    }
  });
}

// ================= SEGMENTS =================
async function proxyBinary(target) {
  const res = await fetch(target, {
    headers: defaultHeaders()
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      ...cors(),
      "Content-Type":
        res.headers.get("Content-Type") ||
        "application/octet-stream"
    }
  });
}

// ================= UTILS =================
function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://tvsen6.aynascope.net/"
  };
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "*"
  };
}

function notFound() {
  return new Response("404", { status: 404, headers: cors() });
}
