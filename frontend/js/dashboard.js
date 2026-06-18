const user = requireLogin();

if (!user) {
  // requireLogin should redirect, but just in case
  throw new Error("User not authenticated");
}

const userInfo = document.getElementById("userInfo");
const dashboardIntro = document.getElementById("dashboardIntro");
const adminActions = document.getElementById("adminActions");
const userActions = document.getElementById("userActions");
const superadminUsersLink = document.getElementById("superadminUsersLink");

// Safety: ensure elements exist before manipulating
if (userInfo) userInfo.textContent = `${user.username} (${user.role})`;

// RESET UI STATE FIRST (important to avoid stale UI bugs)
if (userActions) userActions.classList.add("hidden");
if (adminActions) adminActions.classList.add("hidden");
if (superadminUsersLink) superadminUsersLink.classList.add("hidden");

if (dashboardIntro) {
  dashboardIntro.textContent = "";
}

// ROLE-BASED UI
if (user.role === "user") {
  if (dashboardIntro) {
    dashboardIntro.textContent = "Pošaljite zahtjev ili pregledajte svoje zahtjeve.";
  }

  if (userActions) userActions.classList.remove("hidden");
}

if (user.role === "admin") {
  if (dashboardIntro) {
    dashboardIntro.textContent = "Pregledavajte i obrađujte zahtjeve djelatnika.";
  }

  if (adminActions) adminActions.classList.remove("hidden");
}

if (user.role === "superadmin") {
  if (dashboardIntro) {
    dashboardIntro.textContent = "Potpuni pristup sustavu i upravljanju korisnicima.";
  }

  if (adminActions) adminActions.classList.remove("hidden");

  if (superadminUsersLink) {
    superadminUsersLink.classList.remove("hidden");
  }
}
