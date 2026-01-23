export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean);

    /* ---------- BASE64 URL SAFE ---------- */
    const b64e = s =>
      btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const b64d = s => {
      s = s.replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      return atob(s);
    };

    /* ---------- ALLOWED REFERER ---------- */
    const ALLOWED = [
      "https://hridoytv.4mel.com",
      "https://hridoytv.vercel.app",
      "http://localhost"
    ];

    const checkRef = () => {
      const r = req.headers.get("Referer") || "";
      return ALLOWED.some(d => r.startsWith(d));
    };

    /* ---------- CHANNEL LIST ---------- */
    const CHANNELS = {
      "nagorik-tv": "http://116.204.149.16/nagorik/index.m3u8",
      "tsports": "http://cdnd.sonyplex.com:8090/hls/tsportshd.m3u8"
    };

    /* ---------- SEGMENT PROXY ---------- */
    if (path[0] === "seg") {
      let target;
      try {
        target = b64d(path[1]);
      } catch {
        return new Response("Invalid segment", { status: 400 });
      }

      const range = req.headers.get("Range");

      const headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Accept-Encoding": "identity"
      };
      if (range) headers["Range"] = range;

      const r = await fetch(target, { headers });

      return new Response(r.body, {
        status: r.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Accept-Ranges": "bytes"
        }
      });
    }

    /* ---------- PLAYLIST PROXY ---------- */
    if (path[0] === "channel") {
      if (!checkRef())
        return new Response("Access Blocked", { status: 403 });

      const upstream = CHANNELS[path[1]];
      if (!upstream)
        return new Response("Channel Not Found", { status: 404 });

      const r = await fetch(upstream, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/vnd.apple.mpegurl",
          "Accept-Encoding": "identity"
        }
      });

      const text = await r.text();

      const out = text
        .split(/\r?\n/)
        .map(line => {
          if (!line || line.startsWith("#")) return line;
          return `${url.origin}/seg/${b64e(
            new URL(line, upstream).toString()
          )}`;
        })
        .join("\n");

      return new Response(out, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    /* ---------- HOME ---------- */
    return new Response("HridoyProxy is running", {
      headers: { "content-type": "text/plain" }
    });
  }
};
