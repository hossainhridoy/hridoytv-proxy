export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean);

    /* ---------- BASE64 ---------- */
    const b64e = s => btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    const b64d = s => {
      s = s.replace(/-/g,"+").replace(/_/g,"/");
      while (s.length % 4) s += "=";
      return atob(s);
    };

    /* ---------- ALLOWED REFERER ---------- */
    const ALLOWED = [
      "https://hridoytv.4mel.com",
      "https://hridoytv.vercel.app"
    ];

    const checkRef = () => {
      const r = req.headers.get("Referer") || "";
      return ALLOWED.some(d => r.startsWith(d));
    };

    /* ---------- CHANNELS ---------- */
    const CHANNELS = {
      "nagorik-tv": "http://116.204.149.16/nagorik/index.m3u8",
      "tsports": "http://cdnd.sonyplex.com:8090/hls/tsportshd.m3u8"
    };

    /* ---------- SEGMENT ---------- */
    if (path[0] === "seg") {
      let target;
      try { target = b64d(path[1]); }
      catch { return new Response("Bad segment", {status:400}); }

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

    /* ---------- PLAYLIST ---------- */
    if (path[0] === "channel") {
      if (!checkRef())
        return new Response("Access Blocked", {status:403});

      const up = CHANNELS[path[1]];
      if (!up) return new Response("Channel Not Found", {status:404});

      const r = await fetch(up, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/vnd.apple.mpegurl",
          "Accept-Encoding": "identity"
        }
      });

      const text = await r.text();

      const out = text.split(/\r?\n/).map(l=>{
        if (!l || l.startsWith("#")) return l;
        return `${url.origin}/seg/${b64e(new URL(l, up))}`;
      }).join("\n");

      return new Response(out, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return new Response("HridoyProxy is running");
  }
};