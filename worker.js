// ================= CONFIG =================
const CHANNELS = {
  asports: {
    base: "https://tvsen6.aynascope.net/asports/index.m3u8",
    tokenApi: "https://tvsen6.aynascope.net/asports/index.m3u8"
  }
};

// In-memory token cache
let tokenCache = {};

// ================= WORKER =================
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace("/", "");

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    // Playlist
    if (path.endsWith(".m3u8")) {
      const name = path.replace(".m3u8", "");
      if (!CHANNELS[name]) return notFound();

      const realUrl = await getFreshUrl(name);
      return proxyPlaylist(realUrl, url.origin);
    }

    // Segments / keys
    if (url.searchParams.get("u")) {
      return proxyBinary(url.searchParams.get("u"));
    }

    return notFound();
  }
};

// ================= TOKEN LOGIC =================
async function getFreshUrl(name) {
  const cached = tokenCache[name];
  const now = Date.now() / 1000;

  if (cached && cached.expiry > now + 30) {
    return cached.url;
  }

  // Fetch new token (HEAD/GET)
  const res = await fetch(CHANNELS[name].tokenApi, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": CHANNELS[name].base
    },
    redirect: "follow"
  });

  const finalUrl = res.url;

  // extract expiry param e=
  const e = new URL(finalUrl).searchParams.get("e") || (now + 300);

  tokenCache[name] = {
    url: finalUrl,
    expiry: Number(e)
  };

  return finalUrl;
}

// ================= PLAYLIST =================
async function proxyPlaylist(target, origin) {
  const res = await fetch(target);
  let text = await res.text();

  text = text.replace(/(https?:\/\/[^\s]+)/g, m =>
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
  const res = await fetch(target);
  return new Response(res.body, {
    status: res.status,
    headers: {
      ...cors(),
      "Content-Type": res.headers.get("Content-Type") || "application/octet-stream"
    }
  });
}

// ================= UTILS =================
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
