(function () {
  const SESSION_KEY = "jgw_admin_session";
  const STORAGE_KEY = "jgw_portfolio_projects";
  const REVIEWS_KEY = "jgw_client_reviews";
  const data = window.JGW_DATA;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const $ = (selector) => document.querySelector(selector);

  if (sessionStorage.getItem(SESSION_KEY) !== "active") {
    window.location.replace("login.html");
    return;
  }

  function normalizeImageUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    const driveMatch = value.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1600`;
    if (/imgur\.com\/(?:a|gallery)\//i.test(value)) return "";
    const imgurPageMatch = value.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)(?:[?#].*)?$/i);
    if (imgurPageMatch) return `https://i.imgur.com/${imgurPageMatch[1]}.jpg`;
    return value;
  }

  function safeUrl(url) {
    if (/imgur\.com\/(?:a|gallery)\//i.test(String(url || ""))) {
      throw new Error("Imgur album links cannot display here. Open the image, copy the direct image link, and paste a link like https://i.imgur.com/name.jpg.");
    }
    const value = normalizeImageUrl(url);
    return /^https?:\/\//i.test(value) ? value : "";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]);
  }

  function readProjects() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map((project) => ({ ...project, image: normalizeImageUrl(project.image) })) : [];
    } catch (error) {
      return [];
    }
  }

  function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  function readReviews() {
    try {
      const parsed = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveReviews(reviews) {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  }

  function allProjects() {
    return [...data.projects, ...readProjects()];
  }

  function categoryProjectCount(categoryId) {
    return allProjects().filter((project) => project.category === categoryId).length;
  }

  function albumCount() {
    return data.categories.reduce((total, category) => total + category.albums.length, 0);
  }

  function renderCategoryOptions() {
    $("[data-admin-category-options]").innerHTML = data.categories.map((category) => `
      <option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>
    `).join("");
  }

  function renderReviews() {
    const reviews = readReviews();
    const body = $("[data-admin-reviews]");
    if (!body) return;
    body.innerHTML = reviews.length ? reviews.map((review) => `<tr>
      <td><strong>${escapeHtml(review.name || "Client")}</strong><br>${escapeHtml(review.review || "Client satisfaction image uploaded.")}</td>
      <td>${"*".repeat(Number(review.rating || 5))}</td>
      <td>${review.photo ? `<img class="admin-thumb" src="${escapeHtml(review.photo)}" alt="">` : "No image"}</td>
      <td><button class="button ghost admin-delete" type="button" data-delete-review="${escapeHtml(review.id)}">Delete</button></td>
    </tr>`).join("") : `<tr><td colspan="4">No client reviews or satisfaction images have been added yet.</td></tr>`;
  }

  function renderDashboard() {
    const storedProjects = readProjects();
    const projects = allProjects();
    $("[data-admin-project-count]").textContent = projects.length;
    $("[data-admin-album-count]").textContent = albumCount();
    $("[data-admin-categories]").innerHTML = data.categories.map((category, index) => `
      <tr><td>${escapeHtml(category.name)}</td><td>${categoryProjectCount(category.id)}</td><td>Visible</td><td>Editable link</td><td>${index + 1}</td></tr>
    `).join("");
    $("[data-admin-projects]").innerHTML = storedProjects.length ? storedProjects.map((project) => {
      const category = data.categories.find((item) => item.id === project.category);
      return `<tr>
        <td>${project.image ? `<img class="admin-thumb" src="${escapeHtml(project.image)}" alt="">` : ""}${escapeHtml(project.title)}</td>
        <td>${escapeHtml(category?.name || "Unassigned")}</td>
        <td>${money.format(Number(project.price || 0))}</td>
        <td>${escapeHtml(project.delivery || "Pending")}</td>
        <td><button class="button ghost admin-delete" type="button" data-delete-project="${escapeHtml(project.id)}">Delete</button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="5">No image-link projects have been added yet.</td></tr>`;
    renderReviews();
  }

  function addProject(form) {
    const image = safeUrl(form.get("image"));
    if (!image) throw new Error("Please paste a valid Google Drive or image link that starts with http or https.");

    const category = String(form.get("category") || "breakmat");
    const categoryData = data.categories.find((item) => item.id === category) || data.categories[0];
    const title = String(form.get("title") || "Untitled project").trim();
    const price = Number(form.get("price") || 0);
    const now = new Date();
    const project = {
      id: `admin-${Date.now()}`,
      category,
      album: `${categoryData.name} Uploads`,
      title,
      description: String(form.get("description") || "").trim(),
      price: Number.isFinite(price) ? price : 0,
      delivery: String(form.get("delivery") || "Pending").trim(),
      client: String(form.get("client") || "").trim(),
      services: [categoryData.name],
      popularity: 1,
      date: now.toISOString().slice(0, 10),
      height: "360px",
      image
    };

    const projects = readProjects();
    projects.unshift(project);
    saveProjects(projects);
  }

  function addReview(form) {
    const photo = safeUrl(form.get("photo"));
    const reviewText = String(form.get("review") || "").trim();
    if (!photo && !reviewText) throw new Error("Please add a review message or a client satisfaction image link.");
    const review = {
      id: `review-${Date.now()}`,
      name: String(form.get("name") || "Client").trim(),
      rating: Number(form.get("rating") || 5),
      review: reviewText,
      role: "Client Review",
      photo
    };
    const reviews = readReviews();
    reviews.unshift(review);
    saveReviews(reviews);
  }

  $("[data-project-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const status = $("[data-project-status]");
    try {
      addProject(new FormData(event.currentTarget));
      event.currentTarget.reset();
      status.textContent = "Image project saved. Open the public portfolio in this browser to see it.";
      renderDashboard();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  $("[data-review-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const status = $("[data-review-status]");
    try {
      addReview(new FormData(event.currentTarget));
      event.currentTarget.reset();
      status.textContent = "Client review saved. Open the public portfolio in this browser to see it.";
      renderReviews();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  $("[data-admin-projects]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-project]");
    if (!button) return;
    const projects = readProjects().filter((project) => project.id !== button.dataset.deleteProject);
    saveProjects(projects);
    renderDashboard();
  });

  $("[data-admin-reviews]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-review]");
    if (!button) return;
    const reviews = readReviews().filter((review) => review.id !== button.dataset.deleteReview);
    saveReviews(reviews);
    renderReviews();
  });

  $("[data-logout]").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  });

  renderCategoryOptions();
  renderDashboard();
})();
