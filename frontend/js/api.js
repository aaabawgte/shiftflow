const API_BASE_URL = "https://bb-shiftflow-api.bb-shiftflow.workers.dev";
function getToken() {
  return localStorage.getItem("shiftflow_token");
}

function setToken(token) {
  localStorage.setItem("shiftflow_token", token);
}

function removeToken() {
  localStorage.removeItem("shiftflow_token");
  localStorage.removeItem("shiftflow_user");
}

function getStoredUser() {
  const raw = localStorage.getItem("shiftflow_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem("shiftflow_user", JSON.stringify(user));
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Greška u komunikaciji sa serverom.");
  }

  return data;
}