const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.COORD_API_KEY || "";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "coord.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { threads: [], messages: [], agents: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
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

function requireAuth(req, res) {
  if (!API_KEY) return true;
  const auth = req.headers.authorization || "";
  const ok = auth === `Bearer ${API_KEY}`;
  if (!ok) {
    sendJson(res, 401, { error: "unauthorized" });
  }
  return ok;
}

function matchPath(method, pathname, target) {
  return method === target.method && pathname === target.path;
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    return res.end();
  }

  if (!requireAuth(req, res)) return;

  if (matchPath(method, pathname, { method: "GET", path: "/health" })) {
    return sendJson(res, 200, { status: "ok", time: nowIso() });
  }

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
        sender_id: body.sender_id || null,
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
      if (existing) {
        const idx = data.agents.findIndex((a) => a.employee_id === body.employee_id);
        data.agents[idx] = agent;
      } else {
        data.agents.push(agent);
      }
      saveData(data);
      return sendJson(res, 200, { status: "ok", agent: agent });
    } catch (err) {
      return sendJson(res, 400, { error: "invalid_json" });
    }
  }

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

  if (matchPath(method, pathname, { method: "GET", path: "/api/coord/agents" })) {
    const data = loadData();
    const agents = filterByQuery(data.agents, url.searchParams, [
      "status",
      "owner_employee_id"
    ]);
    return sendJson(res, 200, agents);
  }

  return sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Coordinator API listening on http://localhost:${PORT}`);
});
