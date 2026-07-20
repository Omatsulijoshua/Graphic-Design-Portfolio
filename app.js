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

  function filteredProjects(categoryId = currentCategoryId) {
    const term = $("#searchInput").value.trim().toLowerCase();
    return sortProjects(data.projects.filter((project) => {
      const category = data.categories.find((item) => item.id === project.category);
      const haystack = [project.title, project.description, project.album, project.client, project.services.join(" "), category?.name, project.price].join(" ").toLowerCase();
      return (!categoryId || project.category === categoryId) && (!term || haystack.includes(term));
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
    $("[data-gallery-kicker]").textContent = `${categoryProjectCount(selected.id)} live samples shown`;
    $("[data-albums]").innerHTML = selected.albums.length ? selected.albums.map((album) => `
      <article class="album-chip">
        <strong>${album.title}</strong>
        <p>${album.description}</p>
        <p>${album.date} Â· ${album.type}</p>
      </article>
    `).join("") : `<article class="album-chip"><strong>No albums yet</strong><p>Add real albums from the future admin dashboard.</p></article>`;
    const categoryPrices = projects.map((project) => Number(project.price || 0)).filter((price) => price > 0);
    $("[data-gallery-pricing]").innerHTML = categoryPrices.length
      ? `<strong>Pricing</strong><span>Starting from ${money.format(Math.min(...categoryPrices))}</span>`
      : `<strong>Pricing</strong><span>Add pricing when uploading image projects from admin.</span>`;
    $("[data-projects]").innerHTML = projects.map((project) => {
      const title = escapeHtml(project.title);
      const album = escapeHtml(project.album || "Portfolio");
      const media = projectMedia(project);
      const initials = title.split(" ").map((part) => part[0]).join("").slice(0, 3);
      return `
        <article class="project-card" data-project-id="${escapeHtml(project.id)}">
          ${media.type === "embed" && media.url ? `
            <div class="project-art image-art embed-art" style="--height:${project.height || "360px"}">
              <iframe src="${escapeHtml(media.url)}" title="${title}" loading="lazy" referrerpolicy="no-referrer"></iframe>
            </div>
          ` : media.url ? `
            <div class="project-art image-art" style="--height:${project.height || "360px"}">
              <img src="${escapeHtml(media.url)}" alt="${title}" loading="lazy">
            </div>
          ` : `
            <div class="project-art" style="--art:${project.art || "linear-gradient(135deg,#6a0dad,#d9a441)"};--height:${project.height || "360px"}">
              <span>${initials}</span>
            </div>
          `}
          <div class="project-info">
            <h3>${title}</h3>
            <p>${album}</p>
            <p class="price">${money.format(Number(project.price || 0))}</p>
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
    const featured = data.projects.slice(0, 6);
    $("[data-pricing]").innerHTML = featured.length ? featured.map((project) => `
      <article class="pricing-card">
        <h3>${project.title}</h3>
        <p>${project.services.join(", ")}</p>
        <strong>${money.format(project.price)}</strong>
      </article>
    `).join("") : `<article class="pricing-card"><h3>No pricing samples yet</h3><p>Add real prices when your first portfolio projects are uploaded.</p><strong>Pending</strong></article>`;
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
        renderGallery(card.dataset.categoryId);
      }
    });
    $("[data-categories]").addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-category-id]")) renderGallery(event.target.dataset.categoryId);
    });
    $("#searchInput").addEventListener("input", () => renderGallery(currentCategoryId));
    $("#sortSelect").addEventListener("change", () => renderGallery(currentCategoryId));
    $("[data-close-gallery]").addEventListener("click", () => { $("[data-gallery-panel]").hidden = true; });
    $("[data-projects]").addEventListener("click", (event) => {
      if (event.target.closest("[data-reaction]")) return;
      const card = event.target.closest("[data-project-id]");
      if (card) openProject(card.dataset.projectId);
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

  renderServices();
  renderCategories();
  renderPricing();
  renderTestimonials();
  renderFaqAndContact();
  bindEvents();
  animateCounters();
})();







