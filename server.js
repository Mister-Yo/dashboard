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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { threads: [], messages: [], agents: [], users: [], api_keys: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
  // Migrate: add missing collections
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  let changed = false;
  if (!data.users) { data.users = []; changed = true; }
  if (!data.api_keys) { data.api_keys = []; changed = true; }
  if (changed) fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
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
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function nowIso() {
  return new Date().toISOString();
}

function filterByQuery(items, query, fields) {
  return items.filter((item) => {
    return fields.every((field) => {
      const q = query.get(field);
      if (!q) return true;
      return String(item[field] || "") === q;
    });
  });
}

// ═══════════════════════════════════════
// API Key generation & validation
// ═══════════════════════════════════════

function generateApiKey(ownerType) {
  const random = crypto.randomBytes(24).toString("hex");
  return `ak_${ownerType}_${random}`;
}

function hashApiKey(plainKey) {
  return crypto.createHash("sha256").update(plainKey).digest("hex");
}

function validateApiKey(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ak_")) return null;
  const token = auth.replace("Bearer ", "");
  const hashed = hashApiKey(token);
  const data = loadData();
  const keyRecord = data.api_keys.find(k => k.key_hash === hashed && k.status === "active");
  return keyRecord || null;
}

// ═══════════════════════════════════════
// Password hashing (PBKDF2 — no deps needed)
// ═══════════════════════════════════════

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verify;
}

// ═══════════════════════════════════════
// Simple JWT (no deps — HMAC-SHA256)
// ═══════════════════════════════════════

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}

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
    const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url");
    if (signature !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// Auth middleware
// ═══════════════════════════════════════

function getAuthContext(req) {
  const auth = req.headers.authorization || "";

  // Try API key (for agents)
  if (auth.startsWith("Bearer ak_")) {
    const keyRecord = validateApiKey(req);
    if (keyRecord) {
      return { type: "api_key", owner_type: keyRecord.owner_type, owner_id: keyRecord.owner_id, name: keyRecord.owner_name };
    }
    return null;
  }

  // Try JWT (for users)
  if (auth.startsWith("Bearer ey")) {
    const payload = verifyJwt(auth.replace("Bearer ", ""));
    if (payload) {
      return { type: "jwt", owner_type: "user", owner_id: payload.user_id, name: payload.name, role: payload.role };
    }
    return null;
  }

  // No auth — anonymous (allowed for some routes)
  return { type: "anonymous" };
}

function matchPath(method, pathname, target) {
  return method === target.method && pathname === target.path;
}

function pathStartsWith(method, pathname, targetMethod, prefix) {
  return method === targetMethod && pathname.startsWith(prefix);
}

// ═══════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  // CORS
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    return res.end();
  }

  const authCtx = getAuthContext(req);

  // ─── Health ───
  if (matchPath(method, pathname, { method: "GET", path: "/health" })) {
    return sendJson(res, 200, { status: "ok", time: nowIso() });
  }

  // ═══════════════════════════════════════
  // USER AUTH ROUTES (public)
  // ═══════════════════════════════════════

  // POST /api/coord/users/register
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
      const existing = data.users.find(u => u.email === body.email);
      if (existing) {
        return sendJson(res, 409, { error: "email_already_registered" });
      }

      const user = {
        id: crypto.randomUUID(),
        email: body.email,
        name: body.name,
        role: body.role || "employee",
        password_hash: hashPassword(body.password),
        status: "active",
        created_at: nowIso(),
        updated_at: nowIso()
      };

      // Generate API key for user too
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

      // Return JWT + API key (shown ONCE)
      const token = createJwt({ user_id: user.id, name: user.name, email: user.email, role: user.role });

      return sendJson(res, 201, {
        status: "ok",
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
        api_key: plainKey,
        warning: "Save your API key now. It will NOT be shown again."
      });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/users/login
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/users/login" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.email || !body.password) {
        return sendJson(res, 400, { error: "email and password required" });
      }
      const data = loadData();
      const user = data.users.find(u => u.email === body.email && u.status === "active");
      if (!user || !verifyPassword(body.password, user.password_hash)) {
        return sendJson(res, 401, { error: "invalid_credentials" });
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

  // GET /api/coord/users
  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/users" })) {
    const data = loadData();
    const users = data.users.map(u => ({
      id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, created_at: u.created_at
    }));
    return sendJson(res, 200, users);
  }

  // ═══════════════════════════════════════
  // AGENT ROUTES
  // ═══════════════════════════════════════

  // POST /api/coord/agents/register — now generates API key
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/agents/register" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.employee_id) {
        return sendJson(res, 400, { error: "employee_id_required" });
      }
      const data = loadData();
      const existing = data.agents.find((a) => a.employee_id === body.employee_id);

      const agent = {
        employee_id: body.employee_id,
        name: body.name || null,
        endpoint_url: body.endpoint_url || null,
        specialization_codes: body.specialization_codes || [],
        capabilities: body.capabilities || {},
        owner_employee_id: body.owner_employee_id || null,
        status: body.status || "active",
        last_heartbeat_at: nowIso(),
        updated_at: nowIso(),
        created_at: existing ? existing.created_at : nowIso()
      };

      let plainKey = null;

      if (existing) {
        const idx = data.agents.findIndex((a) => a.employee_id === body.employee_id);
        data.agents[idx] = agent;
      } else {
        // NEW agent — generate API key
        plainKey = generateApiKey("agent");
        const keyRecord = {
          id: crypto.randomUUID(),
          key_hash: hashApiKey(plainKey),
          owner_type: "agent",
          owner_id: body.employee_id,
          owner_name: body.name || body.employee_id,
          status: "active",
          created_at: nowIso()
        };
        data.api_keys.push(keyRecord);
        data.agents.push(agent);
      }

      saveData(data);

      const response = { status: "ok", agent };
      if (plainKey) {
        response.api_key = plainKey;
        response.warning = "Save your API key now. It will NOT be shown again.";
      }
      return sendJson(res, 200, response);
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/agents/heartbeat
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/agents/heartbeat" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.employee_id) {
        return sendJson(res, 400, { error: "employee_id_required" });
      }
      const data = loadData();
      const idx = data.agents.findIndex((a) => a.employee_id === body.employee_id);
      if (idx === -1) {
        return sendJson(res, 404, { error: "agent_not_found" });
      }
      data.agents[idx].status = body.status || data.agents[idx].status || "active";
      data.agents[idx].last_heartbeat_at = nowIso();
      data.agents[idx].updated_at = nowIso();
      saveData(data);
      return sendJson(res, 200, { status: "ok", next_heartbeat_sec: 60 });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // GET /api/coord/agents
  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/agents" })) {
    const data = loadData();
    const agents = filterByQuery(data.agents, url.searchParams, [
      "status",
      "owner_employee_id"
    ]);
    return sendJson(res, 200, agents);
  }

  // ═══════════════════════════════════════
  // API KEY MANAGEMENT
  // ═══════════════════════════════════════

  // POST /api/coord/api-keys/regenerate — regenerate API key for agent/user
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/api-keys/regenerate" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.owner_id || !body.owner_type) {
        return sendJson(res, 400, { error: "owner_id and owner_type required" });
      }
      const data = loadData();
      // Revoke old keys
      data.api_keys.forEach(k => {
        if (k.owner_id === body.owner_id && k.owner_type === body.owner_type) {
          k.status = "revoked";
        }
      });
      // Generate new
      const plainKey = generateApiKey(body.owner_type);
      const keyRecord = {
        id: crypto.randomUUID(),
        key_hash: hashApiKey(plainKey),
        owner_type: body.owner_type,
        owner_id: body.owner_id,
        owner_name: body.owner_name || body.owner_id,
        status: "active",
        created_at: nowIso()
      };
      data.api_keys.push(keyRecord);
      saveData(data);
      return sendJson(res, 200, {
        status: "ok",
        api_key: plainKey,
        warning: "Save your API key now. It will NOT be shown again."
      });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // POST /api/coord/api-keys/validate — check if API key is valid
  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/api-keys/validate" })) {
    try {
      const body = await parseJsonBody(req);
      if (!body.api_key) {
        return sendJson(res, 400, { error: "api_key required" });
      }
      const hashed = hashApiKey(body.api_key);
      const data = loadData();
      const keyRecord = data.api_keys.find(k => k.key_hash === hashed && k.status === "active");
      if (!keyRecord) {
        return sendJson(res, 401, { error: "invalid_or_revoked_key" });
      }
      return sendJson(res, 200, {
        status: "ok",
        owner_type: keyRecord.owner_type,
        owner_id: keyRecord.owner_id,
        owner_name: keyRecord.owner_name
      });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  // ═══════════════════════════════════════
  // THREAD ROUTES
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
        created_by: body.created_by || null,
        created_at: nowIso()
      };
      data.threads.push(thread);
      saveData(data);
      return sendJson(res, 201, thread);
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/threads" })) {
    const data = loadData();
    const threads = filterByQuery(data.threads, url.searchParams, [
      "project_id",
      "task_id",
      "thread_type",
      "created_by"
    ]);
    return sendJson(res, 200, threads);
  }

  // ═══════════════════════════════════════
  // MESSAGE ROUTES
  // ═══════════════════════════════════════

  if (matchPath(method, pathname, { method: "POST", path: "/api/coord/messages" })) {
    try {
      const body = await parseJsonBody(req);
      const data = loadData();
      const exists = data.threads.find((t) => t.id === body.thread_id);
      if (!exists) {
        return sendJson(res, 404, { error: "thread_not_found" });
      }
      const message = {
        id: crypto.randomUUID(),
        thread_id: body.thread_id,
        sender_id: body.sender_id || (authCtx ? authCtx.name || authCtx.owner_id : null),
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

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/messages" })) {
    const data = loadData();
    let messages = filterByQuery(data.messages, url.searchParams, [
      "thread_id",
      "sender_id",
      "message_type"
    ]);
    const since = url.searchParams.get("since");
    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!Number.isNaN(sinceTime)) {
        messages = messages.filter((m) => new Date(m.created_at).getTime() >= sinceTime);
      }
    }
    return sendJson(res, 200, messages);
  }

  // ═══════════════════════════════════════
  // AUTH INFO ROUTE
  // ═══════════════════════════════════════

  // GET /api/coord/auth/me — who am I?
  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/auth/me" })) {
    if (!authCtx || authCtx.type === "anonymous") {
      return sendJson(res, 401, { error: "not_authenticated" });
    }
    return sendJson(res, 200, authCtx);
  }

  return sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Coordinator API listening on http://localhost:${PORT}`);
  console.log(`Auth: API keys for agents, JWT for users`);
});
