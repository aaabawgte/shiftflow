function requireLogin() {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    window.location.href = "index.html";
    return null;
  }

  return user;
}

function requireAdmin() {
  const user = requireLogin();
  if (!user) return null;

  if (user.role !== "admin" && user.role !== "superadmin") {
    window.location.href = "dashboard.html";
    return null;
  }

  return user;
}

function logout() {
  removeToken();
  window.location.href = "index.html";
}