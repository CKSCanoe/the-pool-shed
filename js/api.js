window.PoolShedAPI = (function () {
  const cfg = () => window.POOL_SHED_CONFIG || {};
  const workspace = () => cfg().workspaceId || "pool-bros-main";
  const apiRoot = () => String(cfg().apiBase || "").replace(/\/$/, "");
  const configured = () => !!(cfg().supabaseUrl && cfg().supabasePublishableKey);

  let client = null;
  let session = null;
  let revision = null;

  function supabase() {
    if (client) return client;
    if (!configured() || !window.supabase) return null;
    client = window.supabase.createClient(cfg().supabaseUrl, cfg().supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  async function token() {
    if (session?.access_token) return session.access_token;
    const sb = supabase();
    if (!sb) return "";
    const result = await sb.auth.getSession();
    session = result.data?.session || null;
    return session?.access_token || "";
  }

  function url(path, params) {
    const base = apiRoot() || location.origin;
    const u = new URL(path, base.endsWith("/") ? base : base + "/");
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    });
    return u;
  }

  async function request(path, { method = "GET", params, body, headers, raw } = {}) {
    const auth = await token();
    const h = { Accept: "application/json", ...(headers || {}) };
    if (auth) h.Authorization = "Bearer " + auth;
    if (body !== undefined && !raw) h["Content-Type"] = "application/json";
    const response = await fetch(url(path, params), {
      method,
      headers: h,
      credentials: "same-origin",
      cache: "no-store",
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body)
    });
    let json = {};
    try { json = await response.json(); } catch (_) {}
    if (!response.ok) {
      const err = new Error(json.error || json.message || path + " failed (" + response.status + ")");
      err.status = response.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  async function signIn(email, password) {
    const sb = supabase();
    if (!sb) throw new Error("Supabase is not configured. Add supabaseUrl and supabasePublishableKey.");
    const result = await sb.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    session = result.data.session;
    return session;
  }

  async function restoreSession() {
    const sb = supabase();
    if (!sb) return null;
    const result = await sb.auth.getSession();
    session = result.data?.session || null;
    sb.auth.onAuthStateChange((_event, next) => { session = next; });
    return session;
  }

  async function signOut() {
    const sb = supabase();
    if (sb) await sb.auth.signOut();
    session = null;
  }

  async function loadWorkspace() {
    const sb = supabase();
    if (!sb || !session) return null;
    const response = await sb.from("workspace_snapshots").select("data,updated_at").eq("workspace_id", workspace()).maybeSingle();
    if (response.error) throw response.error;
    revision = response.data?.updated_at || null;
    return response.data || null;
  }

  async function saveWorkspace(snapshot) {
    const sb = supabase();
    if (!sb || !session) throw new Error("Sign in before saving the shared workspace.");
    if (cfg().secureWorkspaceWrites === true) {
      const response = await sb.rpc("ps_workspace_save", {
        w: workspace(),
        expected: revision || null,
        snapshot
      });
      if (response.error) throw response.error;
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      revision = row?.updated_at || revision;
      return row;
    }
    const payload = {
      workspace_id: workspace(),
      data: snapshot,
      updated_by: session.user.id,
      updated_at: new Date().toISOString()
    };
    const query = revision
      ? sb.from("workspace_snapshots").update(payload).eq("workspace_id", workspace()).eq("updated_at", revision)
      : sb.from("workspace_snapshots").insert(payload);
    const response = await query.select("updated_at").maybeSingle();
    if (response.error) throw response.error;
    if (!response.data) throw new Error("Shared workspace changed on another device. Reload before saving.");
    revision = response.data.updated_at;
    return response.data;
  }

  async function profile() {
    const sb = supabase();
    if (!sb || !session) return null;
    const response = await sb.from("user_profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (response.error) return { email: session.user.email };
    return response.data || { email: session.user.email };
  }

  const quote = {
    staff: (quoteId) => request("/api/quote", { params: { action: "staff", workspace: workspace(), quoteId } }),
    publish: (body) => request("/api/quote", { method: "POST", params: { action: "publish", workspace: workspace() }, body }),
    send: (body) => request("/api/quote", { method: "POST", params: { action: "send", workspace: workspace() }, body }),
    processConversion: (publicationId) => request("/api/quote", { method: "POST", params: { action: "process-conversion", workspace: workspace() }, body: { publicationId } }),
    public: (tokenValue) => request("/api/quote", { params: { action: "public", token: tokenValue } })
  };

  const finance = {
    status: () => request("/api/finance", { params: { action: "status", workspace: workspace() } }),
    connect: () => request("/api/finance", { method: "POST", params: { action: "connect", workspace: workspace() }, body: {} }),
    tenants: () => request("/api/finance", { params: { action: "tenants", workspace: workspace() } }),
    selectTenant: (id) => request("/api/finance", { method: "POST", params: { action: "tenant", workspace: workspace() }, body: { id } }),
    lookups: (page = 1) => request("/api/finance", { params: { action: "lookups", workspace: workspace(), page } }),
    queue: (source, invoice) => request("/api/finance", { method: "POST", params: { action: "queue", workspace: workspace() }, body: { source, invoice } }),
    sync: () => request("/api/finance", { method: "POST", params: { action: "sync", workspace: workspace() }, body: {} }),
    refresh: (document) => request("/api/finance", { method: "POST", params: { action: "refresh-document", workspace: workspace() }, body: { document } }),
    reconcile: (document) => request("/api/finance", { method: "POST", params: { action: "reconcile", workspace: workspace() }, body: { document } })
  };

  const azzy = {
    bootstrap: () => request("/api/azzy", { params: { action: "bootstrap" } }),
    chat: (message, context) => request("/api/azzy", { method: "POST", params: { action: "chat" }, body: { message, context } }),
    record: (type, id) => request("/api/azzy", { params: { action: "record", type, id } }),
    seen: (ids) => request("/api/azzy", { method: "POST", params: { action: "attention-seen" }, body: { ids } })
  };

  const media = {
    listProduct: (productId) => request("/api/media", { params: { action: "product-list", workspace: workspace(), productId } }),
    listCustomer: (customerId) => request("/api/media", { params: { action: "customer-list", workspace: workspace(), customerId } }),
    sign: (refs) => request("/api/media", { params: { action: "sign", workspace: workspace(), refs: (refs || []).join(",") } })
  };

  const projects = {
    review: (jobId) => request("/api/project-review", { method: "POST", body: { workspace: workspace(), jobId } }),
    dashboardReview: () => request("/api/project-review", { method: "POST", body: { workspace: workspace(), scope: "dashboard" } }),
    extraEmail: (payload) => request("/api/project-email", { method: "POST", body: { workspace: workspace(), ...payload } })
  };

  return {
    configured,
    workspace,
    supabase,
    token,
    session: () => session,
    revision: () => revision,
    signIn,
    restoreSession,
    signOut,
    loadWorkspace,
    saveWorkspace,
    profile,
    quote,
    finance,
    azzy,
    media,
    projects
  };
})();
