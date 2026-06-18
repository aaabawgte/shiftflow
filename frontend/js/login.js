const loginBtn = document.getElementById("loginBtn");

loginBtn.addEventListener("click", login);

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const message = document.getElementById("message");

  message.textContent = "";

  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
      }),
    });

    setToken(result.token);
    setStoredUser(result.user);

    window.location.href = "dashboard.html";

  } catch (error) {
    message.textContent = error.message;
  }
}