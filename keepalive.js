/* Quiet Supabase keep-alive: when someone opens the site, send one tiny harmless request
 * (at most once every 6 hours per browser). Never shows anything and never throws. */
(function () {
  try {
    var URL_ = "https://bbnufbjuhmaokyewqyov.supabase.co";
    var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibnVmYmp1aG1hb2t5ZXdxeW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODg5NDksImV4cCI6MjEwNjE2NDk0OX0.k-_Tzi5mS1Bt-9SdnOop09a41cRuWkh_I6CYkVnFCKo";
    var STORE = "shKeepAliveAt", EVERY = 6 * 3600 * 1000, now = Date.now(), last = 0;
    try { last = Number(localStorage.getItem(STORE)) || 0; } catch (e) {}
    if (now - last < EVERY) return;
    try { localStorage.setItem(STORE, String(now)); } catch (e) {}
    fetch(URL_ + "/rest/v1/rpc/customer_messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify({ p_listing: "KEEPALIVE", p_client: "keepalive", p_after: 0 }),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
})();
