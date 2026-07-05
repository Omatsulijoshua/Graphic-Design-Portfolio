(function () {
  const SESSION_KEY = "jgw_admin_session";
  const data = window.JGW_DATA;

  const $ = (selector) => document.querySelector(selector);

  if (sessionStorage.getItem(SESSION_KEY) !== "active") {
    window.location.replace("login.html");
    return;
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

  $("[data-logout]").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  });

  renderDashboard();
})();
