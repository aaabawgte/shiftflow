const user = requireAdmin();

const requestsList = document.getElementById("requestsList");
const pageTitle = document.getElementById("pageTitle");
const weekRange = document.getElementById("weekRange");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");

const params = new URLSearchParams(window.location.search);
const status = params.get("status") || "all";

let currentWeekStart = getStartOfWeek(new Date());

if (user) {
  setTitle();
  bindWeekButtons();
  loadRequests();
}

function setTitle() {
  if (status === "pending") pageTitle.textContent = "Novi zahtjevi";
  else if (status === "approved") pageTitle.textContent = "Odobreni zahtjevi";
  else if (status === "rejected") pageTitle.textContent = "Odbijeni zahtjevi";
  else pageTitle.textContent = "Svi zahtjevi";
}

function bindWeekButtons() {
  prevWeekBtn.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadRequests();
  });

  nextWeekBtn.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadRequests();
  });
}

async function loadRequests() {
  try {
    const weekEnd = getWeekEnd(currentWeekStart);
    const weekStartValue = formatDateForApi(currentWeekStart);
    const weekEndValue = formatDateForApi(weekEnd);

    weekRange.textContent = `${formatDate(currentWeekStart)} - ${formatDate(weekEnd)}`;

    const query = new URLSearchParams({
      status,
      week_start: weekStartValue,
      week_end: weekEndValue,
    });

    const data = await apiRequest(`/api/admin/requests?${query.toString()}`);

    requestsList.innerHTML = "";

    if (!data.requests.length) {
      requestsList.innerHTML = "<p>Nema zahtjeva za ovaj tjedan.</p>";
      return;
    }

    data.requests.forEach((request) => {
      const div = document.createElement("div");
      div.className = "request-card";

      div.innerHTML = `
        <h3>${request.username}</h3>
        <p><strong>Datum:</strong> ${formatDateFromApi(request.request_date)} - ${capitalize(request.day_name)}</p>
        <p><strong>Opcija:</strong> ${formatShift(request.shift_type)}</p>
        <p><strong>Status:</strong> ${formatStatus(request.status)}</p>
        ${request.reason ? `<p><strong>Razlog:</strong> ${request.reason}</p>` : ""}
        ${
          request.status === "pending"
            ? `
              <div class="button-row">
                <button onclick="updateStatus(${request.id}, 'approved')">Odobri</button>
                <button onclick="updateStatus(${request.id}, 'rejected')">Odbij</button>
              </div>
            `
            : ""
        }
      `;

      requestsList.appendChild(div);
    });
  } catch (error) {
    requestsList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function updateStatus(id, newStatus) {
  try {
    await apiRequest(`/api/admin/requests/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({
        status: newStatus,
      }),
    });

    loadRequests();
  } catch (error) {
    alert(error.message);
  }
}

function getStartOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);

  return result;
}

function getWeekEnd(weekStart) {
  const result = new Date(weekStart);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);

  return result;
}

function formatDateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateFromApi(value) {
  const date = new Date(`${value}T00:00:00`);
  return formatDate(date);
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