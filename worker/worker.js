

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

function getToken(request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.replace("Bearer ", "").trim();
}

async function getCurrentUser(request, env) {
  const token = getToken(request);
  if (!token) return null;

  const session = await env.DB.prepare(
    `SELECT
      sessions.token,
      users.id,
      users.username,
      users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?`
  )
    .bind(token)
    .first();

  return session || null;
}

function requireAuth(user) {
  if (!user) {
    return json({ error: "Niste prijavljeni." }, 401);
  }
  return null;
}

function requireAdmin(user) {
  if (!user) {
    return json({ error: "Niste prijavljeni." }, 401);
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    return json({ error: "Nemate dozvolu za ovu radnju." }, 403);
  }

  return null;
}

function isValidRole(role) {
  return role === "user" || role === "admin" || role === "superadmin";
}

function isValidShiftType(shiftType) {
  return shiftType === "ujutro" || shiftType === "popodne" || shiftType === "slobodno";
}

function isValidStatus(status) {
  return status === "pending" || status === "approved" || status === "rejected";
}

function getNextAllowedDate() {
  const today = new Date();
  const day = today.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);

  return nextMonday;
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getDayName(dateValue) {
  const date = parseDateOnly(dateValue);
  if (!date) return "";

  return new Intl.DateTimeFormat("hr-HR", {
    weekday: "long",
  }).format(date);
}

async function handleLogin(request, env) {
  const body = await readJson(request);

  if (!body || !body.username || !body.password) {
    return json({ error: "Username i lozinka su obavezni." }, 400);
  }

  const username = String(body.username).trim();
  const password = String(body.password);

  const user = await env.DB.prepare(
    `SELECT id, username, role
     FROM users
     WHERE username = ? AND password = ?`
  )
    .bind(username, password)
    .first();

  if (!user) {
    return json({ error: "Pogrešan username ili lozinka." }, 401);
  }

  const token = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO sessions (user_id, token)
     VALUES (?, ?)`
  )
    .bind(user.id, token)
    .run();

  return json({
    message: "Uspješna prijava.",
    token,
    user,
  });
}

async function handleLogout(request, env) {
  const token = getToken(request);

  if (token) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`)
      .bind(token)
      .run();
  }

  return json({ message: "Odjavljeni ste." });
}

async function handleMe(request, env) {
  const user = await getCurrentUser(request, env);
  const authError = requireAuth(user);
  if (authError) return authError;

  return json({ user });
}

async function handleCreateUser(request, env) {
  const currentUser = await getCurrentUser(request, env);
  const authError = requireAdmin(currentUser);
  if (authError) return authError;

  const body = await readJson(request);

  if (!body || !body.username || !body.password) {
    return json({ error: "Username i lozinka su obavezni." }, 400);
  }

  const username = String(body.username).trim();
  const password = String(body.password);
  const role = body.role ? String(body.role).trim() : "user";

  if (!username || !password) {
    return json({ error: "Username i lozinka su obavezni." }, 400);
  }

  if (!isValidRole(role)) {
    return json({ error: "Neispravna uloga korisnika." }, 400);
  }

  if (role === "superadmin" && currentUser.role !== "superadmin") {
    return json({ error: "Samo superadmin može kreirati superadmin korisnika." }, 403);
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (username, password, role)
       VALUES (?, ?, ?)`
    )
      .bind(username, password, role)
      .run();

    return json({
      message: "Korisnik je kreiran.",
      id: result.meta.last_row_id,
    });
  } catch (error) {
    return json({ error: "Korisnik s tim usernameom već postoji." }, 409);
  }
}

async function handleListUsers(request, env) {
  const currentUser = await getCurrentUser(request, env);
  const authError = requireAdmin(currentUser);
  if (authError) return authError;

  const users = await env.DB.prepare(
    `SELECT id, username, role, created_at
     FROM users
     ORDER BY created_at DESC`
  ).all();

  return json({ users: users.results || [] });
}

async function handleCreateRequest(request, env) {
  const user = await getCurrentUser(request, env);
  const authError = requireAuth(user);
  if (authError) return authError;

  const body = await readJson(request);

  if (!body || !body.request_date || !body.shift_type) {
    return json({ error: "Datum i opcija smjene su obavezni." }, 400);
  }

  const requestDateValue = String(body.request_date).trim();
  const shiftType = String(body.shift_type).trim();
  const reason = body.reason ? String(body.reason).trim() : null;

  if (!isValidShiftType(shiftType)) {
    return json({ error: "Neispravna opcija smjene." }, 400);
  }

  const requestDate = parseDateOnly(requestDateValue);
  if (!requestDate) {
    return json({ error: "Neispravan datum." }, 400);
  }

  const nextAllowedDate = getNextAllowedDate();
  if (requestDate < nextAllowedDate) {
    return json({
      error: "Zahtjev se može poslati samo za idući tjedan ili kasnije.",
      min_date: nextAllowedDate.toISOString().slice(0, 10),
    }, 400);
  }

  const existing = await env.DB.prepare(
    `SELECT id
     FROM requests
     WHERE user_id = ? AND request_date = ?`
  )
    .bind(user.id, requestDateValue)
    .first();

  if (existing) {
    return json({ error: "Već imate zahtjev za taj datum." }, 409);
  }

  const result = await env.DB.prepare(
    `INSERT INTO requests (user_id, request_date, shift_type, reason)
     VALUES (?, ?, ?, ?)`
  )
    .bind(user.id, requestDateValue, shiftType, reason)
    .run();

  return json({
    message: "Zahtjev je spremljen.",
    id: result.meta.last_row_id,
  });
}

async function handleMyRequests(request, env) {
  const user = await getCurrentUser(request, env);
  const authError = requireAuth(user);
  if (authError) return authError;

  const requests = await env.DB.prepare(
    `SELECT id, request_date, shift_type, reason, status, created_at
     FROM requests
     WHERE user_id = ?
     ORDER BY request_date DESC, created_at DESC`
  )
    .bind(user.id)
    .all();

  const results = (requests.results || []).map((item) => ({
    ...item,
    day_name: getDayName(item.request_date),
  }));

  return json({ requests: results });
}

async function handleDeleteMyRequest(request, env, id) {
  const user = await getCurrentUser(request, env);
  const authError = requireAuth(user);
  if (authError) return authError;

  const existing = await env.DB.prepare(
    `SELECT id, status
     FROM requests
     WHERE id = ? AND user_id = ?`
  )
    .bind(id, user.id)
    .first();

  if (!existing) {
    return json({ error: "Zahtjev nije pronađen." }, 404);
  }

  if (existing.status !== "pending") {
    return json({ error: "Možete obrisati samo zahtjev koji je još na čekanju." }, 400);
  }

  await env.DB.prepare(`DELETE FROM requests WHERE id = ? AND user_id = ?`)
    .bind(id, user.id)
    .run();

  return json({ message: "Zahtjev je obrisan." });
}

async function handleAdminRequests(request, env, url) {
  const user = await getCurrentUser(request, env);
  const authError = requireAdmin(user);
  if (authError) return authError;

  const status = url.searchParams.get("status");
  const userId = url.searchParams.get("user_id");
  const weekStart = url.searchParams.get("week_start");
  const weekEnd = url.searchParams.get("week_end");

  let query = `SELECT
      requests.id,
      requests.user_id,
      users.username,
      requests.request_date,
      requests.shift_type,
      requests.reason,
      requests.status,
      requests.approved_by,
      approver.username AS approved_by_username,
      requests.approved_at,
      requests.created_at
    FROM requests
    JOIN users ON users.id = requests.user_id
    LEFT JOIN users AS approver ON approver.id = requests.approved_by
    WHERE 1 = 1`;

  const params = [];

  if (status && status !== "all") {
    if (!isValidStatus(status)) {
      return json({ error: "Neispravan status." }, 400);
    }

    query += ` AND requests.status = ?`;
    params.push(status);
  }

  if (userId) {
    query += ` AND requests.user_id = ?`;
    params.push(userId);
  }

  if (weekStart) {
    query += ` AND requests.request_date >= ?`;
    params.push(weekStart);
  }

  if (weekEnd) {
    query += ` AND requests.request_date <= ?`;
    params.push(weekEnd);
  }

  query += ` ORDER BY requests.request_date ASC, requests.created_at ASC`;

  const result = await env.DB.prepare(query)
    .bind(...params)
    .all();

  const results = (result.results || []).map((item) => ({
    ...item,
    day_name: getDayName(item.request_date),
  }));

  return json({ requests: results });
}

async function handleUpdateRequestStatus(request, env, id) {
  const user = await getCurrentUser(request, env);
  const authError = requireAdmin(user);
  if (authError) return authError;

  const body = await readJson(request);

  if (!body || !body.status) {
    return json({ error: "Status je obavezan." }, 400);
  }

  const status = String(body.status).trim();

  if (status !== "approved" && status !== "rejected") {
    return json({ error: "Status mora biti approved ili rejected." }, 400);
  }

  const existing = await env.DB.prepare(
    `SELECT id
     FROM requests
     WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!existing) {
    return json({ error: "Zahtjev nije pronađen." }, 404);
  }

  await env.DB.prepare(
    `UPDATE requests
     SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(status, user.id, id)
    .run();

  return json({ message: "Status zahtjeva je ažuriran." });
}

async function handleStats(request, env) {
  const user = await getCurrentUser(request, env);
  const authError = requireAdmin(user);
  if (authError) return authError;

  const stats = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count
     FROM requests
     GROUP BY status`
  ).all();

  const base = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  for (const row of stats.results || []) {
    base[row.status] = row.count;
    base.total += row.count;
  }

  return json({ stats: base });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "POST" && path === "/api/login") {
        return handleLogin(request, env);
      }

      if (request.method === "POST" && path === "/api/logout") {
        return handleLogout(request, env);
      }

      if (request.method === "GET" && path === "/api/me") {
        return handleMe(request, env);
      }

      if (request.method === "POST" && path === "/api/users") {
        return handleCreateUser(request, env);
      }

      if (request.method === "GET" && path === "/api/users") {
        return handleListUsers(request, env);
      }

      if (request.method === "POST" && path === "/api/requests") {
        return handleCreateRequest(request, env);
      }

      if (request.method === "GET" && path === "/api/my-requests") {
        return handleMyRequests(request, env);
      }

      const myRequestDeleteMatch = path.match(/^\/api\/my-requests\/(\d+)$/);
      if (request.method === "DELETE" && myRequestDeleteMatch) {
        return handleDeleteMyRequest(request, env, Number(myRequestDeleteMatch[1]));
      }

      if (request.method === "GET" && path === "/api/admin/requests") {
        return handleAdminRequests(request, env, url);
      }

      const adminRequestStatusMatch = path.match(/^\/api\/admin\/requests\/(\d+)\/status$/);
      if (request.method === "PUT" && adminRequestStatusMatch) {
        return handleUpdateRequestStatus(request, env, Number(adminRequestStatusMatch[1]));
      }

      if (request.method === "GET" && path === "/api/admin/stats") {
        return handleStats(request, env);
      }

      return json({ error: "Ruta nije pronađena." }, 404);
    } catch (error) {
      return json({
        error: "Greška na serveru.",
        details: error.message,
      }, 500);
    }
  },
};