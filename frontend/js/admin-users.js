const user = requireAdmin();

const createUserBtn = document.getElementById("createUserBtn");
const message = document.getElementById("message");
const usersList = document.getElementById("usersList");

if (user) {
  loadUsers();
}

createUserBtn.addEventListener("click", createUser);

async function createUser() {
  message.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  try {
    await apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        role,
      }),
    });

    message.textContent = "Korisnik je kreiran.";
    message.style.color = "green";

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    document.getElementById("role").value = "user";

    loadUsers();
  } catch (error) {
    message.textContent = error.message;
    message.style.color = "red";
  }
}

async function loadUsers() {
  try {
    const data = await apiRequest("/api/users");

    usersList.innerHTML = "";

    data.users.forEach((item) => {
      const div = document.createElement("div");
      div.className = "user-row";

      div.innerHTML = `
        <strong>${item.username}</strong>
        <span>${formatRole(item.role)}</span>
      `;

      usersList.appendChild(div);
    });
  } catch (error) {
    usersList.innerHTML = `<p>${error.message}</p>`;
  }
}

function formatRole(role) {
  if (role === "superadmin") return "Superadmin";
  if (role === "admin") return "Voditelj";
  return "Djelatnik";
}