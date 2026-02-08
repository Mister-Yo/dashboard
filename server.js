const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || "dashboard-jwt-secret-change-me";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "coord.json");

// ═══════════════════════════════════════
// Data helpers
// ═══════════════════════════════════════

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { threads: [], messages: [], agents: [], users: [], api_keys: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  let changed = false;
  if (!data.users) { data.users = []; changed = true; }
  if (!data.api_keys) { data.api_keys = []; changed = true; }
  if (changed) fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 1e6) { req.destroy(); reject(new Error("Payload too large")); }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
    });
  });
}

function nowIso() { return new Date().toISOString(); }

function filterByQuery(items, query, fields) {
  return items.filter((item) => fields.every((field) => {
    const q = query.get(field);
    if (!q) return true;
    return String(item[field] || "") === q;
  }));
}

function matchPath(method, pathname, target) {
  return method === target.method && pathname === target.path;
}

// ═══════════════════════════════════════
// Crypto helpers
// ═══════════════════════════════════════

function generateApiKey(ownerType) {
  return `ak_${ownerType}_${crypto.randomBytes(24).toString("hex")}`;
}

function hashApiKey(plainKey) {
  return crypto.createHash("sha256").update(plainKey).digest("hex");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  return hash === crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function base64url(str) { return Buffer.from(str).toString("base64url"); }

function createJwt(payload, expiresInHours = 72) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInHours * 3600 };
  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(fullPayload))];
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(segments.join(".")).digest("base64url");
  return [...segments, signature].join(".");
}

function verifyJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url");
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ═══════════════════════════════════════
// Auth — get identity from token
// ═══════════════════════════════════════

function getAuthContext(req) {
  let auth = req.headers.authorization || "";

  // Support ?api_key= query parameter as fallback (for environments that block Authorization header)
  if (!auth) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const qKey = url.searchParams.get("api_key");
      if (qKey) auth = `Bearer ${qKey}`;
    } catch(e) {}
  }

  // API key (agents)
  if (auth.startsWith("Bearer ak_")) {
    const token = auth.replace("Bearer ", "");
    const hashed = hashApiKey(token);
    const data = loadData();
    const keyRecord = data.api_keys.find(k => k.key_hash === hashed && k.status === "active");
    if (!keyRecord) return null;
    // Check if agent/user is active
    if (keyRecord.owner_type === "agent") {
      const agent = data.agents.find(a => a.employee_id === keyRecord.owner_id);
      if (!agent || agent.status !== "active") return null; // not activated
    }
    if (keyRecord.owner_type === "user") {
      const user = data.users.find(u => u.id === keyRecord.owner_id);
      if (!user || user.status !== "active") return null;
    }
    return { type: "api_key", owner_type: keyRecord.owner_type, owner_id: keyRecord.owner_id, name: keyRecord.owner_name };
  }

  // JWT (users)
  if (auth.startsWith("Bearer ey")) {
    const payload = verifyJwt(auth.replace("Bearer ", ""));
    if (!payload) return null;
    // Check user is still active
    const data = loadData();
    const user = data.users.find(u => u.id === payload.user_id);
    if (!user || user.status !== "active") return null;
    return { type: "jwt", owner_type: "user", owner_id: payload.user_id, name: payload.name, role: payload.role };
  }

  return null; // No auth = null (not anonymous)
}

// Helper: require auth, return authCtx or send 401
function requireAuth(req, res) {
  const ctx = getAuthContext(req);
  if (!ctx) {
    sendJson(res, 401, { error: "authentication_required", message: "Please login or provide API key" });
    return null;
  }
  return ctx;
}

// Helper: require CEO role
function requireCeo(authCtx, res) {
  if (!authCtx || authCtx.role !== "ceo") {
    sendJson(res, 403, { error: "forbidden", message: "Only CEO can perform this action" });
    return false;
  }
  return true;
}

// ═══════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    return res.end();
  }

  // ─── Health (public) ───
  if (matchPath(method, pathname, { method: "GET", path: "/health" })) {
    return sendJson(res, 200, { status: "ok", time: nowIso() });
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC ROUTES — registration & login only
  // ═══════════════════════════════════════════════════════

  // POST /api/coord/users/register — creates user with status "pending"
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/users/register" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.email || !body.password || !body.name) {
        return sendJson(res, 400, { error: "email, password, and name are required" });
      }
      if (body.password.length < 6) {
        return sendJson(res, 400, { error: "password must be at least 6 characters" });
      }
      const data = loadData();
      if (data.users.find(u => u.email === body.email)) {
        return sendJson(res, 409, { error: "email_already_registered" });
      }

      // First user ever becomes CEO and is auto-activated
      const isFirstUser = data.users.length === 0;

      const user = {
        id: crypto.randomUUID(),
        email: body.email,
        name: body.name,
        role: isFirstUser ? "ceo" : (body.role || "employee"),
        password_hash: hashPassword(body.password),
        status: isFirstUser ? "active" : "pending",  // ← pending until CEO activates
        created_at: nowIso(),
        updated_at: nowIso()
      };

      // Generate API key (will only work after activation)
      const plainKey = generateApiKey("user");
      const keyRecord = {
        id: crypto.randomUUID(),
        key_hash: hashApiKey(plainKey),
        owner_type: "user",
        owner_id: user.id,
        owner_name: user.name,
        status: "active",
        created_at: nowIso()
      };

      data.users.push(user);
      data.api_keys.push(keyRecord);
      saveData(data);

      if (isFirstUser) {
        // Auto-login first user (CEO)
        const token = createJwt({ user_id: user.id, name: user.name, email: user.email, role: user.role });
        return sendJson(res, 201, {
          status: "ok",
          user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
          token,
          api_key: plainKey,
          warning: "Save your API key now. It will NOT be shown again.",
          message: "You are the first user — auto-assigned as CEO and activated."
        });
      }

      return sendJson(res, 201, {
        status: "pending_activation",
        user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
        api_key: plainKey,
        warning: "Save your API key now. It will NOT be shown again.",
        message: "Registration successful. Your account must be activated by CEO before you can log in."
      });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/users/login — only active users can login
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/users/login" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.email || !body.password) {
        return sendJson(res, 400, { error: "email and password required" });
      }
      const data = loadData();
      const user = data.users.find(u => u.email === body.email);
      if (!user || !verifyPassword(body.password, user.password_hash)) {
        return sendJson(res, 401, { error: "invalid_credentials" });
      }
      if (user.status === "pending") {
        return sendJson(res, 403, { error: "account_pending", message: "Your account is pending activation by CEO." });
      }
      if (user.status !== "active") {
        return sendJson(res, 403, { error: "account_inactive", message: "Your account is not active." });
      }

      const token = createJwt({ user_id: user.id, name: user.name, email: user.email, role: user.role });
      return sendJson(res, 200, {
        status: "ok",
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token
      });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/agents/register — creates agent with status "pending"
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/agents/register" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.employee_id) {
        return sendJson(res, 400, { error: "employee_id_required" });
      }
      const data = loadData();
      const existing = data.agents.find(a => a.employee_id === body.employee_id);

      const agent = {
        employee_id: body.employee_id,
        name: body.name || null,
        endpoint_url: body.endpoint_url || null,
        specialization_codes: body.specialization_codes || [],
        capabilities: body.capabilities || {},
        owner_employee_id: body.owner_employee_id || null,
        status: existing ? existing.status : "pending",  // ← pending until CEO activates
        last_heartbeat_at: nowIso(),
        updated_at: nowIso(),
        created_at: existing ? existing.created_at : nowIso()
      };

      let plainKey = null;

      if (existing) {
        const idx = data.agents.findIndex(a => a.employee_id === body.employee_id);
        data.agents[idx] = agent;
      } else {
        plainKey = generateApiKey("agent");
        data.api_keys.push({
          id: crypto.randomUUID(),
          key_hash: hashApiKey(plainKey),
          owner_type: "agent",
          owner_id: body.employee_id,
          owner_name: body.name || body.employee_id,
          status: "active",
          created_at: nowIso()
        });
        data.agents.push(agent);
      }

      saveData(data);

      const response = { status: existing ? "updated" : "pending_activation", agent };
      if (plainKey) {
        response.api_key = plainKey;
        response.warning = "Save your API key now. It will NOT be shown again.";
        response.message = "Agent registered. Must be activated by CEO before it can use the API.";
      }
      return sendJson(res, 200, response);
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/api-keys/validate — public (so agents can check if key works)
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/api-keys/validate" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.api_key) return sendJson(res, 400, { error: "api_key required" });
      const hashed = hashApiKey(body.api_key);
      const data = loadData();
      const keyRecord = data.api_keys.find(k => k.key_hash === hashed && k.status === "active");
      if (!keyRecord) return sendJson(res, 401, { error: "invalid_or_revoked_key" });
      // Check if owner is active
      let ownerStatus = "unknown";
      if (keyRecord.owner_type === "agent") {
        const a = data.agents.find(a => a.employee_id === keyRecord.owner_id);
        ownerStatus = a ? a.status : "not_found";
      } else {
        const u = data.users.find(u => u.id === keyRecord.owner_id);
        ownerStatus = u ? u.status : "not_found";
      }
      return sendJson(res, 200, {
        status: "ok",
        owner_type: keyRecord.owner_type,
        owner_id: keyRecord.owner_id,
        owner_name: keyRecord.owner_name,
        owner_status: ownerStatus,
        can_use_api: ownerStatus === "active"
      });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // ═══════════════════════════════════════════════════════
  // PROTECTED ROUTES — require valid auth (active user/agent)
  // ═══════════════════════════════════════════════════════

  const authCtx = requireAuth(req, res);
  if (!authCtx) return; // 401 already sent

  // ─── GET /api/coord/auth/me ───
  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/auth/me" })) {
    return sendJson(res, 200, authCtx);
  }

  // ═══════════════════════════════════════
  // CEO-ONLY: Activation & management
  // ═══════════════════════════════════════

  // POST /api/coord/admin/activate — CEO activates agent or user
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/admin/activate" })) {
    if (!requireCeo(authCtx, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.type || !body.id) {
        return sendJson(res, 400, { error: "type (agent|user) and id required" });
      }
      const data = loadData();
      if (body.type === "agent") {
        const idx = data.agents.findIndex(a => a.employee_id === body.id);
        if (idx === -1) return sendJson(res, 404, { error: "agent_not_found" });
        data.agents[idx].status = "active";
        data.agents[idx].updated_at = nowIso();
        saveData(data);
        return sendJson(res, 200, { status: "ok", message: `Agent ${data.agents[idx].name || body.id} activated`, agent: data.agents[idx] });
      }
      if (body.type === "user") {
        const idx = data.users.findIndex(u => u.id === body.id || u.email === body.id);
        if (idx === -1) return sendJson(res, 404, { error: "user_not_found" });
        data.users[idx].status = "active";
        data.users[idx].updated_at = nowIso();
        saveData(data);
        return sendJson(res, 200, { status: "ok", message: `User ${data.users[idx].name} activated`, user: { id: data.users[idx].id, name: data.users[idx].name, email: data.users[idx].email, role: data.users[idx].role, status: data.users[idx].status } });
      }
      return sendJson(res, 400, { error: "type must be 'agent' or 'user'" });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/admin/deactivate — CEO deactivates agent or user
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/admin/deactivate" })) {
    if (!requireCeo(authCtx, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.type || !body.id) return sendJson(res, 400, { error: "type and id required" });
      const data = loadData();
      if (body.type === "agent") {
        const idx = data.agents.findIndex(a => a.employee_id === body.id);
        if (idx === -1) return sendJson(res, 404, { error: "agent_not_found" });
        data.agents[idx].status = "inactive";
        data.agents[idx].updated_at = nowIso();
        saveData(data);
        return sendJson(res, 200, { status: "ok", message: `Agent ${body.id} deactivated` });
      }
      if (body.type === "user") {
        const idx = data.users.findIndex(u => u.id === body.id || u.email === body.id);
        if (idx === -1) return sendJson(res, 404, { error: "user_not_found" });
        data.users[idx].status = "inactive";
        data.users[idx].updated_at = nowIso();
        saveData(data);
        return sendJson(res, 200, { status: "ok", message: `User ${body.id} deactivated` });
      }
      return sendJson(res, 400, { error: "type must be 'agent' or 'user'" });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // GET /api/coord/admin/pending — list all pending registrations (CEO only)
  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/admin/pending" })) {
    if (!requireCeo(authCtx, res)) return;
    const data = loadData();
    const pendingAgents = data.agents.filter(a => a.status === "pending").map(a => ({ type: "agent", id: a.employee_id, name: a.name, specializations: a.specialization_codes, created_at: a.created_at }));
    const pendingUsers = data.users.filter(u => u.status === "pending").map(u => ({ type: "user", id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at }));
    return sendJson(res, 200, { pending: [...pendingAgents, ...pendingUsers] });
  }

  // POST /api/coord/api-keys/regenerate — CEO only
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/api-keys/regenerate" })) {
    if (!requireCeo(authCtx, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.owner_id || !body.owner_type) return sendJson(res, 400, { error: "owner_id and owner_type required" });
      const data = loadData();
      data.api_keys.forEach(k => {
        if (k.owner_id === body.owner_id && k.owner_type === body.owner_type) k.status = "revoked";
      });
      const plainKey = generateApiKey(body.owner_type);
      data.api_keys.push({
        id: crypto.randomUUID(),
        key_hash: hashApiKey(plainKey),
        owner_type: body.owner_type,
        owner_id: body.owner_id,
        owner_name: body.owner_name || body.owner_id,
        status: "active",
        created_at: nowIso()
      });
      saveData(data);
      return sendJson(res, 200, { status: "ok", api_key: plainKey, warning: "Save now. Won't be shown again." });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // ═══════════════════════════════════════
  // GET routes — authenticated users can read
  // ═══════════════════════════════════════

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/users" })) {
    const data = loadData();
    return sendJson(res, 200, data.users.map(u => ({
      id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, created_at: u.created_at
    })));
  }

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/agents" })) {
    const data = loadData();
    return sendJson(res, 200, filterByQuery(data.agents, url.searchParams, ["status", "owner_employee_id"]));
  }

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/threads" })) {
    const data = loadData();
    return sendJson(res, 200, filterByQuery(data.threads, url.searchParams, ["project_id", "task_id", "thread_type", "created_by"]));
  }

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/messages" })) {
    const data = loadData();
    let messages = filterByQuery(data.messages, url.searchParams, ["thread_id", "sender_id", "message_type"]);
    const since = url.searchParams.get("since");
    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!Number.isNaN(sinceTime)) messages = messages.filter(m => new Date(m.created_at).getTime() >= sinceTime);
    }
    return sendJson(res, 200, messages);
  }

  // ═══════════════════════════════════════
  // WRITE routes — sender auto-detected from token
  // ═══════════════════════════════════════

  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/threads" })) {
    try {
      const body = await parseJsonBody(req);
      const data = loadData();
      const thread = {
        id: crypto.randomUUID(),
        project_id: body.project_id || null,
        task_id: body.task_id || null,
        thread_type: body.thread_type || "general",
        title: body.title || null,
        created_by: authCtx.name,  // ← from token, not request body
        created_at: nowIso()
      };
      data.threads.push(thread);
      saveData(data);
      return sendJson(res, 201, thread);
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/messages — sender_id ALWAYS from token
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/messages" })) {
    try {
      const body = await parseJsonBody(req);
      const data = loadData();
      const thread = data.threads.find(t => t.id === body.thread_id);
      if (!thread) return sendJson(res, 404, { error: "thread_not_found" });

      const message = {
        id: crypto.randomUUID(),
        thread_id: body.thread_id,
        sender_id: authCtx.name,          // ← ALWAYS from token
        sender_type: authCtx.owner_type,   // "user" or "agent"
        message_type: body.message_type || "note",
        payload: body.payload || {},
        reply_to: body.reply_to || null,
        created_at: nowIso()
      };
      data.messages.push(message);
      saveData(data);
      return sendJson(res, 201, message);
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/agents/heartbeat — only the agent itself can heartbeat
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/agents/heartbeat" })) {
    try {
      const body = await parseJsonBody(req);
      const agentId = body.employee_id || authCtx.owner_id;
      const data = loadData();
      const idx = data.agents.findIndex(a => a.employee_id === agentId);
      if (idx === -1) return sendJson(res, 404, { error: "agent_not_found" });
      data.agents[idx].status = body.status || data.agents[idx].status || "active";
      data.agents[idx].last_heartbeat_at = nowIso();
      data.agents[idx].updated_at = nowIso();
      saveData(data);
      return sendJson(res, 200, { status: "ok", next_heartbeat_sec: 60 });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  return sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Coordinator API listening on http://localhost:${PORT}`);
  console.log(`Auth model: register → pending → CEO activates → active`);
  console.log(`Writes require auth. Sender auto-detected from token.`);
});
