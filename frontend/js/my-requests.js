const user = requireLogin();
const requestsList = document.getElementById("requestsList");

if (user) {
  loadMyRequests();
}

async function loadMyRequests() {
  try {
    const data = await apiRequest("/api/my-requests");

    requestsList.innerHTML = "";

    if (!data.requests.length) {
      requestsList.innerHTML = "<p>Nema zahtjeva.</p>";
      return;
    }

    data.requests.forEach((request) => {
      const div = document.createElement("div");
      div.className = "request-card";

      div.innerHTML = `
        <h3>${formatDate(request.request_date)} - ${capitalize(request.day_name)}</h3>
        <p><strong>Opcija:</strong> ${formatShift(request.shift_type)}</p>
        <p><strong>Status:</strong> ${formatStatus(request.status)}</p>
        ${request.reason ? `<p><strong>Razlog:</strong> ${request.reason}</p>` : ""}
        ${
          request.status === "pending"
            ? `<button onclick="deleteRequest(${request.id})">Povuci zahtjev</button>`
            : ""
        }
      `;

      requestsList.appendChild(div);
    });
  } catch (error) {
    requestsList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function deleteRequest(id) {
  try {
    await apiRequest(`/api/my-requests/${id}`, {
      method: "DELETE",
    });

    loadMyRequests();
  } catch (error) {
    alert(error.message);
  }
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatShift(value) {
  if (value === "ujutro") return "Ujutro";
  if (value === "popodne") return "Popodne";
  if (value === "slobodno") return "Slobodno";
  return value;
}

function formatStatus(value) {
  if (value === "pending") return "Na čekanju";
  if (value === "approved") return "Odobreno";
  if (value === "rejected") return "Odbijeno";
  return value;
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}