(function () {
  const SESSION_KEY = "jgw_admin_session";
  const STORAGE_KEY = "jgw_portfolio_projects";
  const REVIEWS_KEY = "jgw_client_reviews";
  const data = window.JGW_DATA;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  let backendReady = false;

  if (sessionStorage.getItem(SESSION_KEY) !== "active") {
    window.location.replace("login.html");
    return;
  }

  function normalizeImageUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    const driveMatch = value.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1600`;
    const imgurPageMatch = value.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)(?:[?#].*)?$/i);
    if (imgurPageMatch) return `https://i.imgur.com/${imgurPageMatch[1]}.jpg`;
    return value;
  }

  function imgurEmbedUrl(url) {
    const value = String(url || "").trim();
    const match = value.match(/^https?:\/\/(?:www\.)?imgur\.com\/(a|gallery)\/([a-zA-Z0-9]+)(?:[?#].*)?$/i);
    return match ? `https://imgur.com/${match[1]}/${match[2]}/embed?pub=true` : "";
  }

  function mediaTypeForUrl(url) {
    return imgurEmbedUrl(url) || /\/embed\?pub=true/i.test(String(url || "")) ? "embed" : "image";
  }

  function safeUrl(url) {
    const value = imgurEmbedUrl(url) || normalizeImageUrl(url);
    return /^https?:\/\//i.test(value) ? value : "";
  }

  function safeDirectImageUrl(url) {
    if (imgurEmbedUrl(url)) {
      throw new Error("For review screenshots, use a direct image link instead of an Imgur album link.");
    }
    const value = normalizeImageUrl(url);
    return /^https?:\/\//i.test(value) ? value : "";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]);
  }

  function categoryName(categoryId) {
    return data.categories.find((category) => category.id === categoryId)?.name || "Unassigned";
  }

  function normalizeProject(project, index = 0) {
    const embed = imgurEmbedUrl(project.image);
    const image = embed || normalizeImageUrl(project.image);
    const category = project.category || data.categories[0]?.id || "breakmat";
    return {
      id: project.id || `admin-${Date.now()}-${index}`,
      category,
      album: String(project.album || `${categoryName(category)} Uploads`).trim(),
      title: String(project.title || "Untitled project").trim(),
      description: String(project.description || "").trim(),
      price: Number(project.price || 0),
      delivery: String(project.delivery || "Pending").trim(),
      client: String(project.client || "").trim(),
      services: Array.isArray(project.services) ? project.services : [categoryName(category)],
      popularity: Number(project.popularity || 1),
      date: project.date || new Date().toISOString().slice(0, 10),
      order: Number(project.order || index + 1),
      height: project.height || "360px",
      image,
      mediaType: project.mediaType || mediaTypeForUrl(image)
    };
  }

  function readProjects() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizeProject) : [];
    } catch (error) {
      return [];
    }
  }

  function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.map(normalizeProject)));
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  async function loadBackendData() {
    try {
      const localProjects = readProjects();
      const localReviews = readReviews();
      const [projectPayload, reviewPayload] = await Promise.all([
        fetchJson("/api/projects"),
        fetchJson("/api/reviews")
      ]);
      const backendProjects = Array.isArray(projectPayload.projects) ? projectPayload.projects.map(normalizeProject) : [];
      const backendReviews = Array.isArray(reviewPayload.reviews) ? reviewPayload.reviews : [];
      const mergedProjects = Array.from(new Map([...backendProjects, ...localProjects].map((project) => [project.id, project])).values());
      const mergedReviews = Array.from(new Map([...backendReviews, ...localReviews].map((review) => [review.id, review])).values());
      saveProjects(mergedProjects);
      saveReviews(mergedReviews);
      backendReady = true;
      await Promise.all([
        ...localProjects.map((project) => saveProjectOnline(project)),
        ...localReviews.map((review) => saveReviewOnline(review))
      ]);
    } catch (error) {
      backendReady = false;
    }
  }

  async function saveProjectOnline(project) {
    await fetchJson("/api/projects", { method: "POST", body: JSON.stringify({ project }) });
    backendReady = true;
  }

  async function deleteProjectOnline(id) {
    await fetchJson(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    backendReady = true;
  }

  async function saveReviewOnline(review) {
    await fetchJson("/api/reviews", { method: "POST", body: JSON.stringify({ review }) });
    backendReady = true;
  }

  async function deleteReviewOnline(id) {
    await fetchJson(`/api/reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    backendReady = true;
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

  function encodeMobilePortfolio() {
    const payload = JSON.stringify({ version: 1, projects: readProjects(), reviews: readReviews() });
    const bytes = new TextEncoder().encode(payload);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function copyMobilePortfolioLink() {
    const status = $("[data-mobile-link-status]");
    if (!readProjects().length && !readReviews().length) {
      status.textContent = "Add at least one project or review before creating the mobile link.";
      return;
    }
    const publicPath = location.pathname.replace(/(?:admin(?:\.html)?|login(?:\.html)?)\/?$/i, "");
    const link = `${location.origin}${publicPath || "/"}#jgw-sync=${encodeMobilePortfolio()}`;
    try {
      await navigator.clipboard.writeText(link);
      status.textContent = "Mobile link copied. Send it to your phone and open it once.";
    } catch (error) {
      window.prompt("Copy this mobile portfolio link:", link);
      status.textContent = "Send the copied link to your phone and open it once.";
    }
  }

  function allProjects() {
    return [...data.projects.map(normalizeProject), ...readProjects()];
  }

  function albumNames(projects = readProjects()) {
    return [...new Set(projects.map((project) => project.album).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function projectMediaMarkup(project, className = "") {
    if (!project.image) return `<div class="admin-card-placeholder ${className}">No image</div>`;
    if (project.mediaType === "embed") {
      return `<iframe class="${className}" src="${escapeHtml(project.image)}" title="${escapeHtml(project.title)}" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
    }
    return `<img class="${className}" src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)}" loading="lazy">`;
  }

  function renderCategoryOptions() {
    const options = data.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("");
    $("[data-admin-category-options]").innerHTML = options;
    $("[data-project-filter-category]").innerHTML = `<option value="">All sections</option>${options}`;
  }

  function renderAlbumControls() {
    const projects = readProjects();
    const albums = albumNames(projects);
    $("[data-album-suggestions]").innerHTML = albums.map((album) => `<option value="${escapeHtml(album)}"></option>`).join("");
    $("[data-project-filter-album]").innerHTML = `<option value="">All albums</option>${albums.map((album) => `<option value="${escapeHtml(album)}">${escapeHtml(album)}</option>`).join("")}`;
    $("[data-admin-albums]").innerHTML = albums.length ? albums.map((album) => {
      const count = projects.filter((project) => project.album === album).length;
      return `<button type="button" data-album-chip="${escapeHtml(album)}"><strong>${escapeHtml(album)}</strong><span>${count} item${count === 1 ? "" : "s"}</span></button>`;
    }).join("") : `<span>No albums yet. Add an album name when uploading a project.</span>`;
  }

  function renderStats() {
    const projects = readProjects();
    const reviews = readReviews();
    const usage = Math.min(100, Math.round(((localStorage.getItem(STORAGE_KEY) || "").length + (localStorage.getItem(REVIEWS_KEY) || "").length) / 50000));
    $("[data-admin-project-count]").textContent = projects.length;
    $("[data-admin-album-count]").textContent = albumNames(projects).length;
    $("[data-admin-review-count]").textContent = reviews.length;
    $("[data-admin-storage]").textContent = `${usage}%`;
  }

  function renderCategories() {
    const projects = allProjects();
    $("[data-admin-categories]").innerHTML = data.categories.map((category, index) => {
      const categoryProjects = projects.filter((project) => project.category === category.id);
      const albums = albumNames(categoryProjects);
      return `<tr>
        <td><strong>${escapeHtml(category.name)}</strong><br><span>${escapeHtml(category.description)}</span></td>
        <td>${categoryProjects.length}</td>
        <td>Visible</td>
        <td>${albums.length ? albums.map(escapeHtml).join(", ") : "No albums yet"}</td>
        <td>${index + 1}</td>
      </tr>`;
    }).join("");
  }

  function filteredProjects() {
    const term = String($("[data-project-search]").value || "").trim().toLowerCase();
    const category = $("[data-project-filter-category]").value;
    const album = $("[data-project-filter-album]").value;
    return readProjects()
      .filter((project) => !category || project.category === category)
      .filter((project) => !album || project.album === album)
      .filter((project) => {
        const haystack = [project.title, project.album, project.client, project.description, categoryName(project.category), project.price, project.delivery].join(" ").toLowerCase();
        return !term || haystack.includes(term);
      })
      .sort((a, b) => (a.order || 9999) - (b.order || 9999) || new Date(b.date) - new Date(a.date));
  }

  function renderProjects() {
    const projects = filteredProjects();
    const grid = $("[data-admin-projects]");
    $("[data-admin-empty]").hidden = projects.length > 0;
    grid.innerHTML = projects.map((project) => `<article class="admin-project-card" data-project-id="${escapeHtml(project.id)}">
      <div class="admin-project-media">${projectMediaMarkup(project)}</div>
      <div class="admin-project-body">
        <div>
          <p class="admin-pill">${escapeHtml(categoryName(project.category))}</p>
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.album)}</p>
        </div>
        <dl>
          <div><dt>Price</dt><dd>${money.format(Number(project.price || 0))}</dd></div>
          <div><dt>Delivery</dt><dd>${escapeHtml(project.delivery || "Pending")}</dd></div>
          <div><dt>Client</dt><dd>${escapeHtml(project.client || "Not set")}</dd></div>
        </dl>
        <p>${escapeHtml(project.description || "No description yet.")}</p>
        <div class="admin-card-actions">
          <button class="button secondary" type="button" data-edit-project="${escapeHtml(project.id)}">Edit</button>
          <button class="button ghost admin-delete" type="button" data-delete-project="${escapeHtml(project.id)}">Delete</button>
        </div>
      </div>
    </article>`).join("");
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
    renderStats();
    renderCategoryOptions();
    renderAlbumControls();
    renderCategories();
    renderProjects();
    renderReviews();
    updatePreview();
  }

  function projectFromForm(form) {
    const id = String(form.get("id") || "").trim() || `admin-${Date.now()}`;
    const image = safeUrl(form.get("image"));
    if (!image) throw new Error("Please paste a valid Google Drive, Imgur album, or direct image link that starts with http or https.");
    const category = String(form.get("category") || data.categories[0]?.id || "breakmat");
    const album = String(form.get("album") || `${categoryName(category)} Uploads`).trim();
    const price = Number(form.get("price") || 0);
    const order = Number(form.get("order") || 0);
    return normalizeProject({
      id,
      category,
      album,
      title: String(form.get("title") || "Untitled project").trim(),
      description: String(form.get("description") || "").trim(),
      price: Number.isFinite(price) ? price : 0,
      delivery: String(form.get("delivery") || "Pending").trim(),
      client: String(form.get("client") || "").trim(),
      services: [categoryName(category)],
      popularity: 1,
      date: new Date().toISOString().slice(0, 10),
      order: Number.isFinite(order) && order > 0 ? order : readProjects().length + 1,
      height: "360px",
      image,
      mediaType: mediaTypeForUrl(image)
    });
  }

  function resetProjectForm(message = "") {
    const form = $("[data-project-form]");
    form.reset();
    $("[data-project-id]").value = "";
    $("[data-project-form-mode]").textContent = "Add portfolio image";
    $("[data-project-save]").textContent = "Save Image Project";
    $("[data-cancel-edit]").hidden = true;
    $("[data-project-status]").textContent = message;
    updatePreview();
  }

  function editProject(projectId) {
    const project = readProjects().find((item) => item.id === projectId);
    if (!project) return;
    const form = $("[data-project-form]");
    form.elements.id.value = project.id;
    form.elements.title.value = project.title;
    form.elements.category.value = project.category;
    form.elements.album.value = project.album;
    form.elements.image.value = project.image;
    form.elements.price.value = Number(project.price || 0);
    form.elements.delivery.value = project.delivery;
    form.elements.client.value = project.client;
    form.elements.order.value = project.order || "";
    form.elements.description.value = project.description;
    $("[data-project-form-mode]").textContent = "Editing portfolio image";
    $("[data-project-save]").textContent = "Update Image Project";
    $("[data-cancel-edit]").hidden = false;
    $("[data-project-status]").textContent = "Editing selected project. Save to update the live portfolio in this browser.";
    updatePreview();
    $("#upload").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updatePreview() {
    const form = $("[data-project-form]");
    if (!form) return;
    const image = safeUrl(form.elements.image.value);
    const category = form.elements.category.value;
    const title = form.elements.title.value.trim() || "Project title";
    const album = form.elements.album.value.trim() || "Album name";
    const price = Number(form.elements.price.value || 0);
    const previewProject = normalizeProject({ title, category, album, price, image, mediaType: mediaTypeForUrl(image) });
    $("[data-preview-title]").textContent = title;
    $("[data-preview-meta]").textContent = `${categoryName(category)} / ${album} / ${money.format(price)}`;
    $("[data-preview-media]").innerHTML = image ? projectMediaMarkup(previewProject) : `<div class="admin-card-placeholder">Paste an image link to preview it here.</div>`;
  }

  $("[data-project-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("[data-project-status]");
    try {
      const project = projectFromForm(new FormData(event.currentTarget));
      const projects = readProjects();
      const existingIndex = projects.findIndex((item) => item.id === project.id);
      if (existingIndex >= 0) projects[existingIndex] = project;
      else projects.unshift(project);
      saveProjects(projects);
      await saveProjectOnline(project);
      resetProjectForm(existingIndex >= 0 ? "Project updated online. It will show on every device." : "Image project saved online. It will show on every device.");
      renderDashboard();
    } catch (error) {
      status.textContent = `${error.message} If DATABASE_URL is not added to Vercel yet, it will only save on this browser.`;
    }
  });

  $("[data-project-form]").addEventListener("input", updatePreview);
  $("[data-copy-mobile-link]").addEventListener("click", copyMobilePortfolioLink);
  $("[data-cancel-edit]").addEventListener("click", () => resetProjectForm("Edit cancelled."));

  $("[data-admin-projects]").addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-project]");
    if (editButton) {
      editProject(editButton.dataset.editProject);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-project]");
    if (!deleteButton) return;
    if (!confirm("Delete this portfolio project?")) return;
    saveProjects(readProjects().filter((project) => project.id !== deleteButton.dataset.deleteProject));
    try {
      await deleteProjectOnline(deleteButton.dataset.deleteProject);
    } catch (error) {
      console.warn("Project was deleted locally, but backend delete failed.");
    }
    renderDashboard();
  });

  $("[data-project-search]").addEventListener("input", renderProjects);
  $("[data-project-filter-category]").addEventListener("change", renderProjects);
  $("[data-project-filter-album]").addEventListener("change", renderProjects);
  $("[data-admin-albums]").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-album-chip]");
    if (!chip) return;
    $("[data-project-filter-album]").value = chip.dataset.albumChip;
    renderProjects();
    $("#projects").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("[data-review-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("[data-review-status]");
    try {
      const form = new FormData(event.currentTarget);
      const photo = safeDirectImageUrl(form.get("photo"));
      const reviewText = String(form.get("review") || "").trim();
      if (!photo && !reviewText) throw new Error("Please add a review message or a client satisfaction image link.");
      const reviews = readReviews();
      const review = {
        id: `review-${Date.now()}`,
        name: String(form.get("name") || "Client").trim(),
        rating: Number(form.get("rating") || 5),
        review: reviewText,
        role: "Client Review",
        photo
      };
      reviews.unshift(review);
      saveReviews(reviews);
      await saveReviewOnline(review);
      event.currentTarget.reset();
      status.textContent = "Client review saved online. It will show on every device.";
      renderDashboard();
    } catch (error) {
      status.textContent = `${error.message} If DATABASE_URL is not added to Vercel yet, it will only save on this browser.`;
    }
  });

  $("[data-admin-reviews]").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-review]");
    if (!button) return;
    if (!confirm("Delete this review?")) return;
    saveReviews(readReviews().filter((review) => review.id !== button.dataset.deleteReview));
    try {
      await deleteReviewOnline(button.dataset.deleteReview);
    } catch (error) {
      console.warn("Review was deleted locally, but backend delete failed.");
    }
    renderDashboard();
  });

  $("[data-logout]").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  });

  loadBackendData().then(renderDashboard);
})();
