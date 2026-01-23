// worker.js
// HridoyProxy – Secure HLS / M3U8 Proxy
// No token | No origin leak | Referer protected

addEventListener("fetch", e => {
  e.respondWith(handleRequest(e.request));
});

/* ---------------- BASE64 URL SAFE ---------------- */
function b64uEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(inp) {
  let s = inp.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

/* ---------------- ALLOWED SITES ---------------- */
const ALLOWED = [
  "https://hridoytv.4mel.com",
  "http://hridoytv.4mel.com",
  "https://hridoytv.vercel.app",
  "http://hridoytv.vercel.app",
  "http://localhost:8080"
];

function checkReferer(req) {
  const ref = req.headers.get("Referer") || "";
  return ALLOWED.some(d => ref.startsWith(d));
}

/* ---------------- CHANNEL LIST ---------------- */
const CHANNELS = {
  "nagorik-tv": "http://116.204.149.16/nagorik/index.m3u8",
  "tsports": "http://cdnd.sonyplex.com:8090/hls/tsportshd.m3u8"
};

/* ---------------- BLOCK PAGE ---------------- */
function blockHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Access Blocked | HridoyProxy</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;font-family:Arial;background:#fff;color:#111}
.box{max-width:480px;margin:40px auto;padding:30px;border:1px solid #eee;
border-radius:14px;text-align:center;box-shadow:0 6px 16px rgba(0,0,0,.08)}
h1{color:#00a55a;margin-bottom:8px}
p{font-size:15px;line-height:1.6}
a{display:inline-block;margin-top:16px;padding:10px 22px;
background:#00c96b;color:#fff;border-radius:8px;text-decoration:none}
</style>
</head>
<body>
<div class="box">
<h1>Access Blocked</h1>
<p>This stream is protected by <b>HridoyProxy</b>.</p>
<p>Please watch from the official website only.</p>
<a href="https://hridoytv.4mel.com">Visit HridoyTV</a>
</div>
</body>
</html>`;
}

/* ---------------- FETCH TEXT (PLAYLIST) ---------------- */
async function fetchText(url) {
  const r = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/vnd.apple.mpegurl,*/*",
      "Accept-Encoding": "identity"
    }
  });
  if (!r.ok) throw new Error("Upstream error " + r.status);
  return await r.text();
}

/* ---------------- MAIN HANDLER ---------------- */
async function handleRequest(req) {
  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);

  /* -------- SEGMENT PROXY -------- */
  if (path[0] === "seg") {
    const enc = path[1];
    if (!enc) return new Response("Bad Request", { status: 400 });

    let target;
    try {
      target = b64uDecode(enc);
    } catch {
      return new Response("Invalid segment", { status: 400 });
    }

    const ref = req.headers.get("Referer");
    if (ref && !checkReferer(req)) {
      return new Response(blockHTML(), {
        status: 403,
        headers: { "content-type": "text/html" }
      });
    }

    const range = req.headers.get("Range");

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Connection": "keep-alive"
    };
    if (range) headers["Range"] = range;

    const resp = await fetch(target, {
      method: "GET",
      headers,
      redirect: "follow"
    });

    const h = new Headers(resp.headers);
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Accept-Ranges", "bytes");
    h.delete("Set-Cookie");

    return new Response(resp.body, {
      status: resp.status,
      headers: h
    });
  }

  /* -------- PLAYLIST PROXY -------- */
  if (path[0] === "channel") {
    const channel = path[1];
    const upstream = CHANNELS[channel];

    if (!upstream) {
      return new Response("Channel Not Found", { status: 404 });
    }

    if (!checkReferer(req)) {
      return new Response(blockHTML(), {
        status: 403,
        headers: { "content-type": "text/html" }
      });
    }

    let m3u8;
    try {
      m3u8 = await fetchText(upstream);
    } catch (e) {
      return new Response("Playlist load failed", { status: 502 });
    }

    const rewritten = m3u8
      .split(/\r?\n/)
      .map(line => {
        if (!line || line.startsWith("#")) return line;
        try {
          const abs = new URL(line.trim(), upstream).toString();
          return `${url.origin}/seg/${b64uEncode(abs)}`;
        } catch {
          return line;
        }
      })
      .join("\n");

    return new Response(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  /* -------- HOME -------- */
  return new Response("HridoyProxy is running", {
    headers: { "content-type": "text/plain" }
  });
}