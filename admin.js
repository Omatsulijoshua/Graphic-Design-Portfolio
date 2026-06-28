(function () {
  const ADMIN_EMAIL = "joshuagraph07@gmail.com";
  const ADMIN_PASSWORD_HASH = "301edf90d2a0776cbf559ee7f50b9cdde56b51c1a2d173551cf0c07d329127a5";
  const SESSION_KEY = "jgw_admin_session";
  const data = window.JGW_DATA;

  const $ = (selector) => document.querySelector(selector);

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function categoryProjectCount(categoryId) {
    return data.projects.filter((project) => project.category === categoryId).length;
  }

  function albumCount() {
    return data.categories.reduce((total, category) => total + category.albums.length, 0);
  }

  function renderDashboard() {
    $("[data-admin-project-count]").textContent = data.projects.length;
    $("[data-admin-album-count]").textContent = albumCount();
    $("[data-admin-categories]").innerHTML = data.categories.map((category, index) => `
      <tr><td>${category.name}</td><td>${categoryProjectCount(category.id)}</td><td>Visible</td><td>Not uploaded</td><td>${index + 1}</td></tr>
    `).join("");
    $("[data-admin-projects]").innerHTML = data.projects.length ? data.projects.map((project) => {
      const category = data.categories.find((item) => item.id === project.category);
      return `<tr><td>${project.title}</td><td>${category?.name || "Unassigned"}</td><td>${project.price || "Pending"}</td><td>${project.delivery || "Pending"}</td><td>Pending</td></tr>`;
    }).join("") : `<tr><td colspan="5">No real projects have been added yet.</td></tr>`;
  }

  function showDashboard() {
    $("[data-login-screen]").hidden = true;
    $("[data-admin-shell]").hidden = false;
    renderDashboard();
  }

  function showLogin() {
    $("[data-login-screen]").hidden = false;
    $("[data-admin-shell]").hidden = true;
  }

  $("[data-login-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    const status = $("[data-login-status]");

    if (email === ADMIN_EMAIL && await sha256(password) === ADMIN_PASSWORD_HASH) {
      sessionStorage.setItem(SESSION_KEY, "active");
      status.textContent = "";
      formElement.reset();
      showDashboard();
      return;
    }

    status.textContent = "Invalid admin email or password.";
  });

  $("[data-logout]").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  if (sessionStorage.getItem(SESSION_KEY) === "active") showDashboard();
  else showLogin();
})();
