(function () {
  const ADMIN_EMAIL = "joshuagraph07@gmail.com";
  const ADMIN_PASSWORD_HASH = "137a604c8ce7909d9ff2b1a41424fa52c4a9624f093dc12a6406d9a2cb077343";
  const SESSION_KEY = "jgw_admin_session";
  const data = window.JGW_DATA;

  const $ = (selector) => document.querySelector(selector);

  async function sha256(value) {
    if (!globalThis.crypto?.subtle) return sha256Fallback(value);

    try {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      return sha256Fallback(value);
    }
  }

  function sha256Fallback(value) {
    const rightRotate = (number, amount) => (number >>> amount) | (number << (32 - amount));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const words = [];
    const hash = [];
    const constants = [];
    const ascii = unescape(encodeURIComponent(value));
    let primeCounter = 0;
    let candidate = 2;

    const isPrime = (number) => {
      for (let divisor = 2; divisor * divisor <= number; divisor += 1) {
        if (number % divisor === 0) return false;
      }
      return true;
    };

    while (primeCounter < 64) {
      if (isPrime(candidate)) {
        if (primeCounter < 8) hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        constants[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter += 1;
      }
      candidate += 1;
    }

    for (let index = 0; index < ascii.length; index += 1) {
      words[index >> 2] |= ascii.charCodeAt(index) << ((3 - index) % 4) * 8;
    }
    words[ascii.length >> 2] |= 0x80 << ((3 - ascii.length) % 4) * 8;
    words[((ascii.length + 8) >> 6 << 4) + 15] = ascii.length * 8;

    for (let block = 0; block < words.length; block += 16) {
      const oldHash = hash.slice(0);
      const message = [];

      for (let index = 0; index < 64; index += 1) {
        const word = words[block + index];
        if (index < 16) {
          message[index] = word | 0;
        } else {
          const gamma0x = message[index - 15];
          const gamma1x = message[index - 2];
          message[index] = (
            message[index - 16] +
            (rightRotate(gamma0x, 7) ^ rightRotate(gamma0x, 18) ^ (gamma0x >>> 3)) +
            message[index - 7] +
            (rightRotate(gamma1x, 17) ^ rightRotate(gamma1x, 19) ^ (gamma1x >>> 10))
          ) | 0;
        }

        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const sigma0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
        const sigma1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
        const temp1 = hash[7] + sigma1 + ch + constants[index] + message[index];
        const temp2 = sigma0 + maj;

        hash[7] = hash[6];
        hash[6] = hash[5];
        hash[5] = hash[4];
        hash[4] = (hash[3] + temp1) | 0;
        hash[3] = hash[2];
        hash[2] = hash[1];
        hash[1] = hash[0];
        hash[0] = (temp1 + temp2) | 0;
      }

      for (let index = 0; index < 8; index += 1) hash[index] = (hash[index] + oldHash[index]) | 0;
    }

    return hash.map((valuePart) => {
      let output = "";
      for (let index = 3; index + 1; index -= 1) {
        const byte = (valuePart >> (index * 8)) & 255;
        output += (byte < 16 ? "0" : "") + byte.toString(16);
      }
      return output;
    }).join("");
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
    const password = String(form.get("password")).trim();
    const status = $("[data-login-status]");
    status.textContent = "Checking login...";

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


