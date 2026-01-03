export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = "http://210.4.72.204/hls-live/livepkgr/_definst_/liveevent/livestream3.m3u8";

    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "http://210.4.72.204/",
        "Origin": "http://210.4.72.204"
      }
    });

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/vnd.apple.mpegurl"
      }
    });
  }
}
