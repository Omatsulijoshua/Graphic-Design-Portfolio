(function () {
  const data = window.JGW_DATA;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const whatsappText = "Hello JOSHGRAPHIX_WORLD,%0AI saw your portfolio and I'm interested in your services.";
  const whatsappUrl = (extra = "") => data.contact.whatsapp
    ? `https://wa.me/${data.contact.whatsapp}?text=${whatsappText}${extra ? "%0A" + encodeURIComponent(extra) : ""}`
    : "";

  const STORAGE_KEY = "jgw_portfolio_projects";
  const REVIEWS_KEY = "jgw_client_reviews";
  const REACTIONS_KEY = "jgw_project_reactions";
  const CART_KEY = "jgw_saved_design_cart";
  const ACCOUNT_KEY = "jgw_shop_account";
  const API_BASE_URL = (window.JGW_API_BASE_URL || "https://joshgraphics-portfolio-api.onrender.com").replace(/\/$/, "");

  function importSharedPortfolio() {
    const prefix = "#jgw-sync=";
    if (!location.hash.startsWith(prefix)) return;
    try {
      const encoded = location.hash.slice(prefix.length).replace(/-/g, "+").replace(/_/g, "/");
      const padded = encoded + "=".repeat((4 - encoded.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      if (Array.isArray(payload.projects)) localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.projects));
      if (Array.isArray(payload.reviews)) localStorage.setItem(REVIEWS_KEY, JSON.stringify(payload.reviews));
      history.replaceState(null, "", location.pathname + location.search);
    } catch (error) {
      console.warn("The shared portfolio link could not be imported.");
    }
  }

  importSharedPortfolio();

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]);
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

  function projectMedia(project) {
    const embed = imgurEmbedUrl(project.image);
    if (project.mediaType === "embed" || embed || /\/embed\?pub=true/i.test(project.image || "")) {
      return { type: "embed", url: embed || project.image };
    }
    return { type: "image", url: normalizeImageUrl(project.image) };
  }

  function projectMediaMarkup(project, title) {
    const media = projectMedia(project);
    if (media.type === "embed" && media.url) {
      return `
        <div class="project-art image-art embed-art" style="--height:${project.height || "360px"}">
          <iframe src="${escapeHtml(media.url)}" title="${title}" loading="lazy" referrerpolicy="no-referrer"></iframe>
        </div>
      `;
    }
    if (media.url) {
      return `
        <div class="project-art image-art" style="--height:${project.height || "360px"}">
          <img src="${escapeHtml(media.url)}" alt="${title}" loading="lazy">
        </div>
      `;
    }
    const initials = title.split(" ").map((part) => part[0]).join("").slice(0, 3);
    return `
      <div class="project-art" style="--art:${project.art || "linear-gradient(135deg,#6a0dad,#d9a441)"};--height:${project.height || "360px"}">
        <span>${initials}</span>
      </div>
    `;
  }

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map((item) => String(item).includes(":") ? String(item) : cartPhotoId(item)) : [];
    } catch (error) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify([...new Set(cart)]));
  }

  function readAccount() {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function findProject(projectId) {
    return data.projects.find((project) => project.id === projectId);
  }

  function albumId(categoryId, albumTitle) {
    return `${categoryId || "design"}::${albumTitle || "Portfolio"}`;
  }

  function cartAlbumId(album) {
    return `album:${album.id}`;
  }

  function cartPhotoId(projectId) {
    return `photo:${projectId}`;
  }

  function albumProducts() {
    const groups = new Map();
    data.projects.forEach((project) => {
      const category = data.categories.find((item) => item.id === project.category);
      const title = project.album || `${category?.name || "Design"} Album`;
      const id = albumId(project.category, title);
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          title,
          categoryId: project.category,
          categoryName: category?.name || "Design",
          description: category?.description || "Premium design album",
          projects: [],
          latestDate: project.date || "",
          minPrice: Number(project.price || 0)
        });
      }
      const album = groups.get(id);
      album.projects.push(project);
      album.latestDate = [album.latestDate, project.date || ""].sort().pop();
      const price = Number(project.price || 0);
      album.minPrice = album.minPrice ? Math.min(album.minPrice, price || album.minPrice) : price;
    });
    return Array.from(groups.values());
  }

  function findAlbum(albumKey) {
    return albumProducts().find((album) => album.id === albumKey);
  }

  function albumTotal(album) {
    return album.projects.reduce((total, project) => total + Number(project.price || 0), 0);
  }

  function saveAlbum(albumKey) {
    const cart = readCart();
    const id = cartAlbumId({ id: albumKey });
    if (!cart.includes(id)) cart.unshift(id);
    saveCart(cart);
    renderCart();
    renderPricing();
  }

  function saveDesign(projectId) {
    const cart = readCart();
    const id = cartPhotoId(projectId);
    if (!cart.includes(id)) cart.unshift(id);
    saveCart(cart);
    renderCart();
    renderPricing();
  }

  function readStoredReviews() {
    try {
      const parsed = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map((review) => ({ ...review, photo: normalizeImageUrl(review.photo) })) : [];
    } catch (error) {
      return [];
    }
  }

  function readReactions() {
    try {
      return JSON.parse(localStorage.getItem(REACTIONS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveReactions(reactions) {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(reactions));
  }

  function reactionCounts(projectId) {
    const defaults = { like: 0, dislike: 0, fire: 0 };
    return { ...defaults, ...(readReactions()[projectId] || {}) };
  }

  function reactionMarkup(projectId) {
    const counts = reactionCounts(projectId);
    return `
      <div class="reaction-row" data-reactions-for="${escapeHtml(projectId)}">
        <button type="button" data-reaction="like" aria-label="Like">👍🏻 <span>${counts.like}</span></button>
        <button type="button" data-reaction="dislike" aria-label="Dislike">👎🏻 <span>${counts.dislike}</span></button>
        <button type="button" data-reaction="fire" aria-label="Fire">🔥 <span>${counts.fire}</span></button>
      </div>
    `;
  }

  function readStoredProjects() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map((project) => ({
        ...project,
        image: projectMedia(project).url,
        mediaType: projectMedia(project).type,
        price: Number(project.price || 0),
        services: Array.isArray(project.services) ? project.services : [project.service || "Design"]
      }));
    } catch (error) {
      return [];
    }
  }

  data.projects = [...data.projects, ...readStoredProjects()];
  data.testimonials = [...data.testimonials, ...readStoredReviews()];
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  async function fetchJson(path) {
    const urls = API_BASE_URL ? [`${API_BASE_URL}${path}`, path] : [path];
    let lastError;
    for (const url of urls) {
      try {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async function loadBackendData() {
    try {
      const [projectPayload, reviewPayload] = await Promise.all([
        fetchJson("/api/projects"),
        fetchJson("/api/reviews")
      ]);
      if (Array.isArray(projectPayload.projects) && projectPayload.projects.length) {
        data.projects = projectPayload.projects.map((project) => ({
          ...project,
          image: projectMedia(project).url,
          mediaType: projectMedia(project).type,
          price: Number(project.price || 0),
          services: Array.isArray(project.services) ? project.services : [project.service || "Design"]
        }));
      }
      if (Array.isArray(reviewPayload.reviews) && reviewPayload.reviews.length) {
        data.testimonials = reviewPayload.reviews.map((review) => ({ ...review, photo: normalizeImageUrl(review.photo) }));
      }
    } catch (error) {
      console.warn("Using browser-saved portfolio data because the backend is not available yet.");
    }
  }

  function renderServices() {
    const grid = $("[data-services]");
    grid.innerHTML = data.services.map(([name, description]) => `
      <article class="service-card">
        <div class="service-icon" aria-hidden="true">${name.slice(0, 2).toUpperCase()}</div>
        <h3>${name}</h3>
        <p>${description}</p>
      </article>
    `).join("");

    const serviceOptions = $("[data-service-options]");
    serviceOptions.innerHTML = data.services.map(([name]) => `<label><input type="checkbox" name="service" value="${escapeHtml(name)}"> <span>${escapeHtml(name)}</span></label>`).join("");
  }

  function categoryProjectCount(categoryId) {
    return data.projects.filter((project) => project.category === categoryId).length;
  }

  function renderCategories() {
    const grid = $("[data-categories]");
    grid.innerHTML = data.categories.map((category) => `
      <article class="category-card" tabindex="0" role="button" data-category-id="${category.id}" style="--cover:${category.cover}">
        <div>
          <strong>${category.name}</strong>
          <span>${categoryProjectCount(category.id)} Projects</span>
          <span>Click to View</span>
        </div>
      </article>
    `).join("");
  }

  function renderShopControls() {
    const categorySelect = $("[data-shop-category]");
    if (!categorySelect) return;
    categorySelect.innerHTML = `
      <option value="">All album sections</option>
      ${data.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("")}
    `;
  }

  function sortProjects(projects) {
    const sort = $("#sortSelect").value;
    const cloned = [...projects];
    const byDate = (a, b) => new Date(b.date) - new Date(a.date);
    if (sort === "oldest") return cloned.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sort === "priceLow") return cloned.sort((a, b) => a.price - b.price);
    if (sort === "priceHigh") return cloned.sort((a, b) => b.price - a.price);
    if (sort === "newest") return cloned.sort(byDate);
    return cloned.sort((a, b) => b.popularity - a.popularity);
  }

  let currentCategoryId = "breakmat";
  let currentAlbum = "";

  function filteredProjects(categoryId = currentCategoryId) {
    const term = $("#searchInput").value.trim().toLowerCase();
    return sortProjects(data.projects.filter((project) => {
      const category = data.categories.find((item) => item.id === project.category);
      const haystack = [project.title, project.description, project.album, project.client, project.services.join(" "), category?.name, project.price].join(" ").toLowerCase();
      return (!categoryId || project.category === categoryId) && (!currentAlbum || project.album === currentAlbum) && (!term || haystack.includes(term));
    }));
  }

  function renderGallery(categoryId = currentCategoryId) {
    const panel = $("[data-gallery-panel]");
    currentCategoryId = categoryId || currentCategoryId;
    const selected = data.categories.find((category) => category.id === currentCategoryId) || data.categories[0];
    currentCategoryId = selected.id;
    const projects = filteredProjects(selected.id);
    panel.hidden = false;
    $("[data-gallery-title]").textContent = selected.name;
    $("[data-gallery-summary]").textContent = selected.description;
    $("[data-gallery-kicker]").textContent = currentAlbum ? `${projects.length} samples in ${currentAlbum}` : `${categoryProjectCount(selected.id)} live samples shown`;
    const categoryProjects = data.projects.filter((project) => project.category === selected.id);
    const storedAlbums = [...new Set(categoryProjects.map((project) => project.album).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const configuredAlbums = selected.albums.map((album) => album.title);
    const albumTitles = [...new Set([...configuredAlbums, ...storedAlbums])];
    $("[data-albums]").innerHTML = albumTitles.length ? `
      <button class="album-chip ${currentAlbum ? "" : "active"}" type="button" data-album-filter="">
        <strong>All ${selected.name}</strong>
        <p>${categoryProjects.length} projects</p>
      </button>
      ${albumTitles.map((albumTitle) => {
        const albumData = selected.albums.find((album) => album.title === albumTitle);
        const count = categoryProjects.filter((project) => project.album === albumTitle).length;
        return `
          <button class="album-chip ${currentAlbum === albumTitle ? "active" : ""}" type="button" data-album-filter="${escapeHtml(albumTitle)}">
            <strong>${escapeHtml(albumTitle)}</strong>
            <p>${albumData ? escapeHtml(albumData.description) : `${count} project${count === 1 ? "" : "s"}`}</p>
            <p>${albumData ? `${escapeHtml(albumData.date)} / ${escapeHtml(albumData.type)}` : "Uploaded from admin"}</p>
          </button>
        `;
      }).join("")}
    ` : `<article class="album-chip"><strong>No albums yet</strong><p>Add album names when uploading images from Admin</p></article>`;
    const categoryPrices = categoryProjects.map((project) => Number(project.price || 0)).filter((price) => price > 0);
    $("[data-gallery-pricing]").innerHTML = categoryPrices.length
      ? `<strong>Pricing</strong><span>Starting from ${money.format(Math.min(...categoryPrices))}</span>`
      : `<strong>Pricing</strong><span>Add pricing when uploading image projects from admin.</span>`;
    $("[data-projects]").innerHTML = projects.map((project) => {
      const title = escapeHtml(project.title);
      const album = escapeHtml(project.album || "Portfolio");
      return `
        <article class="project-card" data-project-id="${escapeHtml(project.id)}">
          ${projectMediaMarkup(project, title)}
          <div class="project-info">
            <h3>${title}</h3>
            <p>${album}</p>
            <p class="price">${money.format(Number(project.price || 0))}</p>
            <button class="button secondary save-design" type="button" data-save-design="${escapeHtml(project.id)}">Save Design</button>
            ${reactionMarkup(project.id)}
          </div>
        </article>
      `;
    }).join("") || `<p>No real projects have been added yet.</p>`;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  let activeProjectIndex = 0;
  let activeProjectSet = [];

  function projectImage(project) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#6a0dad'/><stop offset='.55' stop-color='#2a0648'/><stop offset='1' stop-color='#d9a441'/></linearGradient></defs><rect width='1400' height='1000' fill='url(#g)'/><circle cx='1080' cy='210' r='190' fill='rgba(255,255,255,.14)'/><rect x='150' y='210' width='760' height='470' rx='18' fill='rgba(255,255,255,.12)' stroke='rgba(255,255,255,.35)'/><text x='190' y='430' fill='white' font-family='Arial' font-size='72' font-weight='800'>${project.title}</text><text x='190' y='535' fill='#d9a441' font-family='Arial' font-size='38'>JOSHGRAPHIX_WORLD</text></svg>`;
    return projectMedia(project).url || `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function openProject(projectId) {
    activeProjectSet = filteredProjects(currentCategoryId);
    activeProjectIndex = activeProjectSet.findIndex((project) => project.id === projectId);
    if (activeProjectIndex < 0) activeProjectIndex = 0;
    updateModal();
    $("[data-modal]").hidden = false;
    document.body.classList.add("modal-open");
  }

  function updateModal() {
    const project = activeProjectSet[activeProjectIndex];
    if (!project) return;
    const category = data.categories.find((item) => item.id === project.category);
    const media = projectMedia(project);
    const modalImage = $("[data-modal-image]");
    const modalEmbed = $("[data-modal-embed]");
    modalImage.hidden = media.type === "embed";
    modalEmbed.hidden = media.type !== "embed";
    if (media.type === "embed") {
      modalEmbed.src = media.url;
      modalEmbed.title = project.title;
      modalImage.removeAttribute("src");
    } else {
      modalEmbed.removeAttribute("src");
      modalImage.src = projectImage(project);
      modalImage.alt = project.title;
    }
    $("[data-modal-category]").textContent = `${category.name} Â· ${project.album}`;
    $("[data-modal-title]").textContent = project.title;
    $("[data-modal-description]").textContent = project.description;
    $("[data-modal-price]").textContent = money.format(project.price);
    $("[data-modal-delivery]").textContent = project.delivery;
    $("[data-modal-client]").textContent = project.client;
    $("[data-modal-services]").textContent = project.services.join(", ");
    $("[data-modal-reactions]").innerHTML = reactionMarkup(project.id);
    $("[data-modal-whatsapp]").href = whatsappUrl(`Project: ${project.title} (${money.format(project.price)})`);
  }

  function closeModal() {
    $("[data-modal]").hidden = true;
    document.body.classList.remove("modal-open");
  }

  function renderPricing() {
    const search = String($("[data-shop-search]")?.value || "").trim().toLowerCase();
    const categoryFilter = $("[data-shop-category]")?.value || "";
    const sort = $("[data-shop-sort]")?.value || "newest";
    const cart = readCart();
    let albums = albumProducts()
      .filter((album) => !categoryFilter || album.categoryId === categoryFilter)
      .filter((album) => {
        const haystack = [album.title, album.categoryName, album.description, album.minPrice, album.projects.map((project) => project.title).join(" ")].join(" ").toLowerCase();
        return !search || haystack.includes(search);
      });

    if (sort === "priceLow") albums.sort((a, b) => a.minPrice - b.minPrice);
    else if (sort === "priceHigh") albums.sort((a, b) => b.minPrice - a.minPrice);
    else if (sort === "name") albums.sort((a, b) => a.title.localeCompare(b.title));
    else albums.sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));

    $("[data-pricing]").innerHTML = albums.length ? albums.map((album) => {
      const title = escapeHtml(album.title);
      const saved = cart.includes(cartAlbumId(album));
      const previews = album.projects.slice(0, 4);
      return `
      <article class="pricing-card shop-card album-product-card" data-shop-album="${escapeHtml(album.id)}">
        <div class="album-product-media">
          ${previews.map((project) => `<div>${projectMediaMarkup(project, escapeHtml(project.title))}</div>`).join("")}
        </div>
        <div class="shop-card-body">
          <span>${escapeHtml(album.categoryName)}</span>
          <h3>${title}</h3>
          <p>${album.projects.length} photo${album.projects.length === 1 ? "" : "s"} in this album</p>
          <strong>From ${money.format(Number(album.minPrice || 0))}</strong>
          <div class="shop-card-actions">
            <button class="button primary" type="button" data-save-album="${escapeHtml(album.id)}">${saved ? "Album Saved" : "Add Album to Cart"}</button>
            <button class="button ghost" type="button" data-view-album="${escapeHtml(album.id)}">View Album</button>
          </div>
        </div>
      </article>
    `;
    }).join("") : `<article class="pricing-card shop-empty"><h3>No albums posted yet</h3><p>Add portfolio images from Admin and give them album names. Each album will appear here as a product.</p><strong>Pending</strong></article>`;
    renderCart();
  }

  function renderCart() {
    const account = readAccount();
    const cartItems = readCart().map((item) => {
      if (item.startsWith("album:")) return { type: "album", album: findAlbum(item.slice(6)), id: item };
      if (item.startsWith("photo:")) return { type: "photo", project: findProject(item.slice(6)), id: item };
      return null;
    }).filter((item) => item && (item.album || item.project));
    const summary = $("[data-cart-summary]");
    const accountStatus = $("[data-account-status]");
    const accountInput = $("[data-account-form] input[name='name']");
    if (account && accountInput && !accountInput.value) accountInput.value = account.name || "";
    if (accountStatus) accountStatus.textContent = account?.name ? `Saved for ${account.name}` : "Create a simple browser account to keep saved albums on this phone.";
    if (summary) summary.textContent = cartItems.length ? `${cartItems.length} saved item${cartItems.length === 1 ? "" : "s"}` : "No albums saved yet";
    $("[data-cart-items]").innerHTML = cartItems.length ? cartItems.map((item) => {
      if (item.type === "album") {
        const album = item.album;
        const preview = album.projects[0];
        return `
          <article class="cart-item">
            <div>${preview ? projectMediaMarkup(preview, escapeHtml(album.title)) : ""}</div>
            <section>
              <strong>${escapeHtml(album.title)}</strong>
              <span>Album / ${album.projects.length} photo${album.projects.length === 1 ? "" : "s"} / From ${money.format(album.minPrice || 0)}</span>
              <button class="button ghost" type="button" data-remove-cart="${escapeHtml(item.id)}">Remove</button>
            </section>
          </article>
        `;
      }
      const project = item.project;
      return `
        <article class="cart-item">
          <div>${projectMediaMarkup(project, escapeHtml(project.title))}</div>
          <section>
            <strong>${escapeHtml(project.title)}</strong>
            <span>Photo / ${escapeHtml(project.album || "Portfolio")} / ${money.format(Number(project.price || 0))}</span>
            <button class="button ghost" type="button" data-remove-cart="${escapeHtml(item.id)}">Remove</button>
          </section>
        </article>
      `;
    }).join("") : `<p class="cart-empty">Saved albums and photos will appear here.</p>`;
  }

  function renderTestimonials(index = 0) {
    if (!data.testimonials.length) {
      $("[data-testimonial]").dataset.index = "0";
      $("[data-testimonial]").innerHTML = `
        <div class="stars">Pending</div>
        <blockquote>No client reviews or satisfaction images have been added yet.</blockquote>
        <footer><strong>JOSHGRAPHIX_WORLD</strong></footer>
      `;
      return;
    }
    const item = data.testimonials[index % data.testimonials.length];
    $("[data-testimonial]").dataset.index = index;
    $(`[data-testimonial]`).innerHTML = `
      ${item.photo ? `<img class="testimonial-photo" src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name || "Client review")}" loading="lazy">` : ""}
      <div class="stars">${"★".repeat(Number(item.rating || 5))}</div>
      <blockquote>"${escapeHtml(item.review || "Client satisfaction image uploaded.")}"</blockquote>
      <footer><strong>${escapeHtml(item.name || "Client")}</strong> - ${escapeHtml(item.role || "Review")}</footer>
    `;
  }

  function renderFaqAndContact() {
    $("[data-faq]").innerHTML = data.faq.map(([question, answer]) => `
      <details>
        <summary>${question}</summary>
        <p>${answer}</p>
      </details>
    `).join("");
    $("[data-socials]").innerHTML = data.contact.socials.map((social) => `<a href="#" aria-label="${social}">${social}</a>`).join("");
    $$("[data-whatsapp]").forEach((link) => {
      if (data.contact.whatsapp) {
        link.href = whatsappUrl();
      } else {
        link.href = `mailto:${data.contact.email}`;
        link.textContent = "Email";
      }
    });
  }

  function animateCounters() {
    const counters = $$("[data-counter]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.counter);
        const suffix = el.dataset.suffix || "+";
        if (target === 0) {
          el.textContent = el.dataset.suffix ? `0${el.dataset.suffix}` : "0";
          observer.unobserve(el);
          return;
        }
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 48));
        const tick = () => {
          current = Math.min(target, current + step);
          el.textContent = current + suffix;
          if (current < target) requestAnimationFrame(tick);
        };
        tick();
        observer.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach((counter) => observer.observe(counter));
  }

  function bindEvents() {
    $("[data-menu-toggle]").addEventListener("click", (event) => {
      event.stopPropagation();
      $("[data-nav]").classList.toggle("open");
    });
    $("[data-nav]").addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target.closest("a")) $("[data-nav]").classList.remove("open");
    });
    document.addEventListener("click", (event) => {
      const nav = $("[data-nav]");
      if (!nav.classList.contains("open")) return;
      if (event.target.closest("[data-nav], [data-menu-toggle]")) return;
      nav.classList.remove("open");
    });
    $("[data-categories]").addEventListener("click", (event) => {
      const card = event.target.closest("[data-category-id]");
      if (card) {
        $("[data-nav]").classList.remove("open");
        currentAlbum = "";
        renderGallery(card.dataset.categoryId);
      }
    });
    $("[data-categories]").addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-category-id]")) {
        currentAlbum = "";
        renderGallery(event.target.dataset.categoryId);
      }
    });
    $("#searchInput").addEventListener("input", () => renderGallery(currentCategoryId));
    $("#sortSelect").addEventListener("change", () => renderGallery(currentCategoryId));
    $("[data-close-gallery]").addEventListener("click", () => { $("[data-gallery-panel]").hidden = true; });
    $("[data-albums]").addEventListener("click", (event) => {
      const chip = event.target.closest("[data-album-filter]");
      if (!chip) return;
      currentAlbum = chip.dataset.albumFilter;
      renderGallery(currentCategoryId);
    });
    $("[data-projects]").addEventListener("click", (event) => {
      if (event.target.closest("[data-reaction], [data-save-design]")) return;
      const card = event.target.closest("[data-project-id]");
      if (card) openProject(card.dataset.projectId);
    });
    $("[data-pricing]").addEventListener("click", (event) => {
      const albumButton = event.target.closest("[data-save-album]");
      if (albumButton) {
        saveAlbum(albumButton.dataset.saveAlbum);
        return;
      }
      const viewAlbumButton = event.target.closest("[data-view-album]");
      if (viewAlbumButton) {
        const album = findAlbum(viewAlbumButton.dataset.viewAlbum);
        if (!album) return;
        currentCategoryId = album.categoryId;
        currentAlbum = album.title;
        renderGallery(album.categoryId);
        return;
      }
      const albumCard = event.target.closest("[data-shop-album]");
      if (albumCard) {
        const album = findAlbum(albumCard.dataset.shopAlbum);
        if (!album) return;
        currentCategoryId = album.categoryId;
        currentAlbum = album.title;
        renderGallery(album.categoryId);
        return;
      }
      const saveButton = event.target.closest("[data-save-design]");
      if (saveButton) {
        saveDesign(saveButton.dataset.saveDesign);
        return;
      }
      const viewButton = event.target.closest("[data-view-design]");
      const card = event.target.closest("[data-shop-project]");
      const projectId = viewButton?.dataset.viewDesign || card?.dataset.shopProject;
      if (!projectId) return;
      const project = findProject(projectId);
      if (!project) return;
      currentCategoryId = project.category;
      currentAlbum = project.album || "";
      activeProjectSet = filteredProjects(currentCategoryId);
      activeProjectIndex = activeProjectSet.findIndex((item) => item.id === projectId);
      if (activeProjectIndex < 0) activeProjectIndex = 0;
      updateModal();
      $("[data-modal]").hidden = false;
      document.body.classList.add("modal-open");
    });
    ["[data-shop-search]", "[data-shop-category]", "[data-shop-sort]"].forEach((selector) => {
      const element = $(selector);
      if (element) element.addEventListener("input", renderPricing);
      if (element) element.addEventListener("change", renderPricing);
    });
    $("[data-account-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") || "").trim();
      if (name) localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ name }));
      renderCart();
    });
    $("[data-cart-items]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-cart]");
      if (!button) return;
      saveCart(readCart().filter((id) => id !== button.dataset.removeCart));
      renderCart();
      renderPricing();
    });
    $("[data-clear-cart]").addEventListener("click", () => {
      saveCart([]);
      renderCart();
      renderPricing();
    });
    $("[data-modal-save]").addEventListener("click", () => {
      const project = activeProjectSet[activeProjectIndex];
      if (project) saveDesign(project.id);
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reaction]");
      if (!button) return;
      const group = button.closest("[data-reactions-for]");
      if (!group) return;
      const projectId = group.dataset.reactionsFor;
      const reaction = button.dataset.reaction;
      const reactions = readReactions();
      reactions[projectId] = { like: 0, dislike: 0, fire: 0, ...(reactions[projectId] || {}) };
      reactions[projectId][reaction] += 1;
      saveReactions(reactions);
      group.outerHTML = reactionMarkup(projectId);
    });
    $$("[data-close-modal]").forEach((node) => node.addEventListener("click", closeModal));
    $("[data-slide-prev]").addEventListener("click", () => { activeProjectIndex = (activeProjectIndex - 1 + activeProjectSet.length) % activeProjectSet.length; updateModal(); });
    $("[data-slide-next]").addEventListener("click", () => { activeProjectIndex = (activeProjectIndex + 1) % activeProjectSet.length; updateModal(); });
    $("[data-fullscreen]").addEventListener("click", () => {
      const target = $("[data-modal-embed]").hidden ? $("[data-modal-image]") : $("[data-modal-embed]");
      target.requestFullscreen?.();
    });
    $("[data-share]").addEventListener("click", async () => {
      const project = activeProjectSet[activeProjectIndex];
      if (navigator.share) await navigator.share({ title: project.title, text: project.description, url: location.href });
      else navigator.clipboard?.writeText(location.href);
    });
    $("[data-floating-whatsapp]").addEventListener("click", () => {
      if (data.contact.whatsapp) window.open(whatsappUrl(), "_blank", "noopener");
      else window.location.href = `mailto:${data.contact.email}`;
    });
    $("[data-testimonial-prev]").addEventListener("click", () => {
      if (data.testimonials.length) renderTestimonials((Number($("[data-testimonial]").dataset.index) - 1 + data.testimonials.length) % data.testimonials.length);
    });
    $("[data-testimonial-next]").addEventListener("click", () => {
      if (data.testimonials.length) renderTestimonials((Number($("[data-testimonial]").dataset.index) + 1) % data.testimonials.length);
    });
    $("[data-contact-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const selectedServices = form.getAll("service").join(", ") || "Not specified";
      const message = `Name: ${form.get("name")}%0APhone: ${form.get("phone")}%0AService: ${selectedServices}%0ABudget: ${form.get("budget")}%0AMessage: ${form.get("message")}`;
      if (data.contact.whatsapp) {
        $("[data-form-status]").textContent = "Opening WhatsApp with your inquiry...";
        window.open(whatsappUrl(message), "_blank", "noopener");
      } else {
        $("[data-form-status]").textContent = "Opening email with your inquiry...";
        window.location.href = `mailto:${data.contact.email}?subject=Design inquiry&body=${message}`;
      }
    });
    document.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".project-card, .project-viewer")) event.preventDefault();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  async function init() {
    await loadBackendData();
    renderServices();
    renderCategories();
    renderShopControls();
    renderPricing();
    renderTestimonials();
    renderFaqAndContact();
    bindEvents();
    animateCounters();
  }

  init();
})();







