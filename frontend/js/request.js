const user = requireLogin();

const requestDate = document.getElementById("requestDate");
const shiftType = document.getElementById("shiftType");
const reason = document.getElementById("reason");
const dayName = document.getElementById("dayName");
const message = document.getElementById("message");
const saveRequestBtn = document.getElementById("saveRequestBtn");

setMinimumDate();

requestDate.addEventListener("change", updateDayName);
saveRequestBtn.addEventListener("click", saveRequest);

function setMinimumDate() {
  const minDate = getNextMonday();
  requestDate.min = formatDate(minDate);
}

function getNextMonday() {
  const today = new Date();
  const day = today.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);

  return nextMonday;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function updateDayName() {
  if (!requestDate.value) {
    dayName.textContent = "";
    return;
  }

  const date = new Date(`${requestDate.value}T00:00:00`);

  const formattedDay = new Intl.DateTimeFormat("hr-HR", {
    weekday: "long",
  }).format(date);

  dayName.textContent = `Dan: ${formattedDay}`;
}

async function saveRequest() {
  message.textContent = "";

  try {
    await apiRequest("/api/requests", {
      method: "POST",
      body: JSON.stringify({
        request_date: requestDate.value,
        shift_type: shiftType.value,
        reason: reason.value.trim(),
      }),
    });

    message.textContent = "Zahtjev je spremljen.";
    message.style.color = "green";

    requestDate.value = "";
    shiftType.value = "";
    reason.value = "";
    dayName.textContent = "";

  } catch (error) {
    message.textContent = error.message;
    message.style.color = "red";
  }
}