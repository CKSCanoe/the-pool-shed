window.POOL_SHED_CONFIG = window.POOL_SHED_CONFIG || {
  supabaseUrl: "",
  supabasePublishableKey: "",
  workspaceId: "pool-bros-main",
  apiBase: "",
  secureWorkspaceWrites: true,
  appOrigin: ""
};

(function applyQueryOverrides(cfg) {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("supabaseUrl")) cfg.supabaseUrl = q.get("supabaseUrl");
    if (q.get("supabaseKey")) cfg.supabasePublishableKey = q.get("supabaseKey");
    if (q.get("workspace")) cfg.workspaceId = q.get("workspace");
    if (q.get("apiBase")) cfg.apiBase = q.get("apiBase");
  } catch (_) {}
})(window.POOL_SHED_CONFIG);
