import "./style.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`;

const appElement = document.querySelector("#app");

const state = {
  token: localStorage.getItem("promptshop-token") || "",
  user: null,
  prompts: [],
  orders: [],
  library: [],
  adminPrompts: [],
  adminOrders: [],
  adminDashboard: null,
  cart: JSON.parse(localStorage.getItem("promptshop-cart") || "[]"),
  authModal: null,
  adminVisible: false,
  editingPromptId: null,
  notice: null,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveCart() {
  localStorage.setItem("promptshop-cart", JSON.stringify(state.cart));
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function setNotice(type, message) {
  state.notice = { type, message };
  render();
  window.setTimeout(() => {
    if (state.notice?.message === message) {
      state.notice = null;
      render();
    }
  }, 3200);
}

function getPromptById(promptId) {
  return state.prompts.find((prompt) => prompt.id === promptId);
}

function cartItems() {
  return state.cart.map((promptId) => getPromptById(promptId)).filter(Boolean);
}

function cartTotal() {
  return cartItems().reduce((sum, prompt) => sum + Number(prompt.priceUsd), 0);
}

async function api(path, options = {}, requireAuth = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (requireAuth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok) {
    if (response.status === 401 && requireAuth) {
      logout(false);
    }
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function loginLocally(authPayload) {
  state.token = authPayload.token;
  state.user = authPayload.user;
  localStorage.setItem("promptshop-token", authPayload.token);
}

function logout(showNotice = true) {
  state.token = "";
  state.user = null;
  state.orders = [];
  state.library = [];
  state.adminPrompts = [];
  state.adminOrders = [];
  state.adminDashboard = null;
  state.adminVisible = false;
  localStorage.removeItem("promptshop-token");
  if (showNotice) {
    setNotice("success", "You are now logged out.");
  } else {
    render();
  }
}

async function fetchPublicData() {
  state.prompts = await api("/api/prompts", {}, false);
}

async function fetchPrivateData() {
  if (!state.token) {
    return;
  }
  state.user = await api("/api/me");
  const [orders, library] = await Promise.all([api("/api/orders/my"), api("/api/library")]);
  state.orders = orders;
  state.library = library;

  if (state.user.role === "ADMIN") {
    const [adminPrompts, adminOrders, dashboard] = await Promise.all([
      api("/api/admin/prompts"),
      api("/api/admin/orders"),
      api("/api/admin/dashboard"),
    ]);
    state.adminPrompts = adminPrompts;
    state.adminOrders = adminOrders;
    state.adminDashboard = dashboard;
  }
}

async function initialize() {
  try {
    await fetchPublicData();
    if (state.token) {
      await fetchPrivateData();
    }
  } catch (error) {
    setNotice("error", error.message);
  } finally {
    render();
  }
}

function authModalTemplate() {
  if (!state.authModal) {
    return "";
  }
  const isLogin = state.authModal === "login";
  return `
    <div class="modal-backdrop" data-action="close-auth">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${
        isLogin ? "Sign in" : "Create account"
      }" onclick="event.stopPropagation()">
        <button class="icon-button close-button" data-action="close-auth">×</button>
        <h3>${isLogin ? "Welcome back" : "Create your account"}</h3>
        <p>${isLogin ? "Sign in to unlock checkout and your prompt library." : "Registration is open for all demo users."}</p>
        <form id="${isLogin ? "login-form" : "register-form"}" class="auth-form">
          ${
            isLogin
              ? ""
              : `<label>Display name<input required name="displayName" maxlength="120" /></label>`
          }
          <label>Email<input required type="email" name="email" /></label>
          <label>Password<input required type="password" minlength="8" name="password" /></label>
          <button class="button button-primary" type="submit">${isLogin ? "Sign in" : "Create account"}</button>
        </form>
        <button class="link-button" data-action="${isLogin ? "open-register" : "open-login"}">
          ${isLogin ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  `;
}

function promptCardTemplate(prompt) {
  const inCart = state.cart.includes(prompt.id);
  return `
    <article class="prompt-card">
      <img src="${escapeHtml(prompt.imageUrl)}" alt="${escapeHtml(prompt.title)}" loading="lazy" />
      <div class="prompt-card-content">
        <span class="chip">${escapeHtml(prompt.category)}</span>
        <h3>${escapeHtml(prompt.title)}</h3>
        <p>${escapeHtml(prompt.shortDescription)}</p>
        <div class="prompt-footer">
          <strong>${formatUsd(prompt.priceUsd)}</strong>
          <button
            class="button ${inCart ? "button-muted" : "button-primary"}"
            data-action="toggle-cart"
            data-id="${prompt.id}"
          >
            ${inCart ? "Remove" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function cartTemplate() {
  const items = cartItems();
  if (items.length === 0) {
    return `
      <section class="panel cart-panel">
        <div class="section-head">
          <h2>Cart</h2>
          <span>0 items</span>
        </div>
        <p class="muted">Your cart is empty. Add premium prompts to continue.</p>
      </section>
    `;
  }

  return `
    <section class="panel cart-panel">
      <div class="section-head">
        <h2>Cart</h2>
        <span>${items.length} item${items.length > 1 ? "s" : ""}</span>
      </div>
      <ul class="cart-list">
        ${items
          .map(
            (item) => `
              <li>
                <div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${formatUsd(item.priceUsd)}</span>
                </div>
                <button class="icon-button" data-action="toggle-cart" data-id="${item.id}" aria-label="Remove from cart">×</button>
              </li>
            `
          )
          .join("")}
      </ul>
      <div class="checkout-row">
        <strong>${formatUsd(cartTotal())}</strong>
        <button class="button button-primary" data-action="checkout">Instant checkout</button>
      </div>
    </section>
  `;
}

function ordersTemplate() {
  if (!state.user) {
    return "";
  }
  return `
    <section class="panel">
      <div class="section-head">
        <h2>My orders</h2>
      </div>
      ${
        state.orders.length === 0
          ? `<p class="muted">No orders yet.</p>`
          : `<ul class="simple-list">
            ${state.orders
              .map(
                (order) => `
                  <li>
                    <div>
                      <strong>#${order.id} · ${order.status}</strong>
                      <span>${new Date(order.createdAt).toLocaleString()}</span>
                    </div>
                    <span>${formatUsd(order.totalUsd)}</span>
                  </li>
                `
              )
              .join("")}
          </ul>`
      }
    </section>
  `;
}

function libraryTemplate() {
  if (!state.user) {
    return "";
  }
  return `
    <section class="panel">
      <div class="section-head">
        <h2>My library</h2>
      </div>
      ${
        state.library.length === 0
          ? `<p class="muted">No purchased prompts yet.</p>`
          : `<div class="library-grid">
            ${state.library
              .map(
                (item) => `
                  <article class="library-card">
                    <h3>${escapeHtml(item.promptTitle)}</h3>
                    <p>${escapeHtml(item.promptContent)}</p>
                    <div class="library-actions">
                      <button class="button button-muted" data-action="copy-prompt" data-content="${encodeURIComponent(
                        item.promptContent
                      )}">
                        Copy
                      </button>
                      <button class="button button-muted" data-action="download-prompt" data-title="${encodeURIComponent(
                        item.promptTitle
                      )}" data-content="${encodeURIComponent(item.promptContent)}">
                        Download .txt
                      </button>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>`
      }
    </section>
  `;
}

function adminTemplate() {
  if (!state.user || state.user.role !== "ADMIN" || !state.adminVisible) {
    return "";
  }
  const editingPrompt = state.adminPrompts.find((prompt) => prompt.id === state.editingPromptId);
  const formPrompt = editingPrompt || {
    id: "",
    title: "",
    shortDescription: "",
    contentText: "",
    priceUsd: "",
    category: "",
    tags: "",
    imageUrl: "",
    published: true,
  };

  return `
    <section class="panel admin-panel">
      <div class="section-head">
        <h2>Admin console</h2>
        <button class="button button-muted" data-action="toggle-admin">Hide</button>
      </div>
      <div class="admin-metrics">
        <div><span>Total users</span><strong>${state.adminDashboard?.totalUsers ?? 0}</strong></div>
        <div><span>Total prompts</span><strong>${state.adminDashboard?.totalPrompts ?? 0}</strong></div>
        <div><span>Total orders</span><strong>${state.adminDashboard?.totalOrders ?? 0}</strong></div>
        <div><span>Revenue</span><strong>${formatUsd(state.adminDashboard?.totalRevenueUsd ?? 0)}</strong></div>
      </div>

      <form id="prompt-form" class="admin-form">
        <h3>${editingPrompt ? "Edit prompt" : "Create prompt"}</h3>
        <div class="form-grid">
          <label>Title<input required name="title" maxlength="140" value="${escapeHtml(formPrompt.title)}" /></label>
          <label>Price USD<input required name="priceUsd" type="number" min="0" step="0.01" value="${formPrompt.priceUsd}" /></label>
          <label>Category<input required name="category" maxlength="90" value="${escapeHtml(formPrompt.category)}" /></label>
          <label>Tags<input required name="tags" maxlength="220" value="${escapeHtml(formPrompt.tags)}" /></label>
        </div>
        <label>Image URL<input required name="imageUrl" maxlength="500" value="${escapeHtml(formPrompt.imageUrl)}" /></label>
        <label>Short description<textarea required name="shortDescription" maxlength="500">${escapeHtml(
          formPrompt.shortDescription
        )}</textarea></label>
        <label>Prompt content<textarea required name="contentText">${escapeHtml(formPrompt.contentText)}</textarea></label>
        <label class="inline-label"><input type="checkbox" name="published" ${
          formPrompt.published ? "checked" : ""
        } /> Published</label>
        <div class="inline-actions">
          <button class="button button-primary" type="submit">${editingPrompt ? "Save changes" : "Create prompt"}</button>
          ${
            editingPrompt
              ? `<button class="button button-muted" type="button" data-action="cancel-edit">Cancel</button>`
              : ""
          }
        </div>
      </form>

      <div class="table-wrap">
        <h3>Prompt catalog</h3>
        <table>
          <thead><tr><th>Prompt</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${state.adminPrompts
              .map(
                (prompt) => `
                  <tr>
                    <td>${escapeHtml(prompt.title)}</td>
                    <td>${formatUsd(prompt.priceUsd)}</td>
                    <td>${prompt.published ? "Published" : "Draft"}</td>
                    <td class="table-actions">
                      <button class="link-button" data-action="edit-prompt" data-id="${prompt.id}">Edit</button>
                      <button class="link-button danger" data-action="delete-prompt" data-id="${prompt.id}">Delete</button>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="table-wrap">
        <h3>Orders</h3>
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Total</th><th>Action</th></tr></thead>
          <tbody>
            ${state.adminOrders
              .map(
                (order) => `
                  <tr>
                    <td>#${order.id}</td>
                    <td>${order.status}</td>
                    <td>${formatUsd(order.totalUsd)}</td>
                    <td class="table-actions">
                      <select id="status-${order.id}">
                        ${["PENDING", "PAID", "CANCELLED"]
                          .map(
                            (status) =>
                              `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`
                          )
                          .join("")}
                      </select>
                      <button class="button button-muted" data-action="update-order-status" data-id="${order.id}">Save</button>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function appTemplate() {
  return `
    <div class="page-shell">
      <header class="topbar">
        <div class="brand">
          <span class="logo-dot"></span>
          <div>
            <strong>PromptShop</strong>
            <small>AI Prompt Marketplace</small>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="chip soft">${state.prompts.length} prompts</span>
          ${
            state.user
              ? `
                <span class="chip">${escapeHtml(state.user.role)}</span>
                <span class="user-name">${escapeHtml(state.user.displayName)}</span>
                ${
                  state.user.role === "ADMIN"
                    ? `<button class="button button-muted" data-action="toggle-admin">${
                        state.adminVisible ? "Close admin" : "Open admin"
                      }</button>`
                    : ""
                }
                <button class="button button-muted" data-action="logout">Logout</button>
              `
              : `
                <button class="button button-muted" data-action="open-login">Sign in</button>
                <button class="button button-primary" data-action="open-register">Create account</button>
              `
          }
        </div>
      </header>

      ${state.notice ? `<div class="notice ${state.notice.type}">${escapeHtml(state.notice.message)}</div>` : ""}

      <main class="content">
        <section class="hero">
          <p class="eyebrow">Beautifully crafted prompt products</p>
          <h1>Premium AI prompts for founders, creators, and teams.</h1>
          <p>
            Single-store MVP with instant demo checkout, polished visuals, and an admin console powered by Spring Boot.
          </p>
        </section>

        <section class="catalog">
          <div class="section-head">
            <h2>Catalog</h2>
            <span>${state.cart.length} in cart</span>
          </div>
          <div class="prompt-grid">
            ${state.prompts.map((prompt) => promptCardTemplate(prompt)).join("")}
          </div>
        </section>

        ${cartTemplate()}
        ${libraryTemplate()}
        ${ordersTemplate()}
        ${adminTemplate()}
      </main>
    </div>
    ${authModalTemplate()}
  `;
}

function render() {
  appElement.innerHTML = appTemplate();
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());
  const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
  const authPayload = await api(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false
  );
  loginLocally(authPayload);
  state.authModal = null;
  await fetchPrivateData();
  setNotice("success", mode === "login" ? "Signed in successfully." : "Account created.");
}

async function handlePromptSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = {
    title: formData.get("title"),
    shortDescription: formData.get("shortDescription"),
    contentText: formData.get("contentText"),
    priceUsd: Number(formData.get("priceUsd")),
    category: formData.get("category"),
    tags: formData.get("tags"),
    imageUrl: formData.get("imageUrl"),
    published: formData.get("published") === "on",
  };

  const isEditing = Boolean(state.editingPromptId);
  await api(
    isEditing ? `/api/admin/prompts/${state.editingPromptId}` : "/api/admin/prompts",
    {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    }
  );
  state.editingPromptId = null;
  await Promise.all([fetchPublicData(), fetchPrivateData()]);
  setNotice("success", isEditing ? "Prompt updated." : "Prompt created.");
}

appElement.addEventListener("submit", async (event) => {
  const form = event.target;
  try {
    if (form.id === "login-form") {
      await handleAuthSubmit(event, "login");
    } else if (form.id === "register-form") {
      await handleAuthSubmit(event, "register");
    } else if (form.id === "prompt-form") {
      await handlePromptSubmit(event);
    }
  } catch (error) {
    setNotice("error", error.message);
  }
});

appElement.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;

  try {
    if (action === "open-login") {
      state.authModal = "login";
      render();
      return;
    }
    if (action === "open-register") {
      state.authModal = "register";
      render();
      return;
    }
    if (action === "close-auth") {
      state.authModal = null;
      render();
      return;
    }
    if (action === "logout") {
      logout();
      return;
    }
    if (action === "toggle-admin") {
      state.adminVisible = !state.adminVisible;
      render();
      return;
    }
    if (action === "toggle-cart") {
      const promptId = Number(button.dataset.id);
      if (state.cart.includes(promptId)) {
        state.cart = state.cart.filter((id) => id !== promptId);
      } else {
        state.cart.push(promptId);
      }
      saveCart();
      render();
      return;
    }
    if (action === "checkout") {
      if (!state.user) {
        state.authModal = "login";
        render();
        return;
      }
      if (state.cart.length === 0) {
        setNotice("error", "Your cart is empty.");
        return;
      }
      await api("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify({ promptIds: state.cart }),
      });
      state.cart = [];
      saveCart();
      await fetchPrivateData();
      setNotice("success", "Checkout complete. Prompts unlocked in your library.");
      return;
    }
    if (action === "copy-prompt") {
      const content = decodeURIComponent(button.dataset.content);
      await navigator.clipboard.writeText(content);
      setNotice("success", "Prompt copied to clipboard.");
      return;
    }
    if (action === "download-prompt") {
      const title = decodeURIComponent(button.dataset.title);
      const content = decodeURIComponent(button.dataset.content);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      return;
    }
    if (action === "edit-prompt") {
      state.editingPromptId = Number(button.dataset.id);
      render();
      return;
    }
    if (action === "cancel-edit") {
      state.editingPromptId = null;
      render();
      return;
    }
    if (action === "delete-prompt") {
      const promptId = Number(button.dataset.id);
      await api(`/api/admin/prompts/${promptId}`, { method: "DELETE" });
      await Promise.all([fetchPublicData(), fetchPrivateData()]);
      setNotice("success", "Prompt deleted.");
      return;
    }
    if (action === "update-order-status") {
      const orderId = Number(button.dataset.id);
      const selectedStatus = document.querySelector(`#status-${orderId}`).value;
      await api(`/api/admin/orders/${orderId}/status?status=${selectedStatus}`, {
        method: "PATCH",
      });
      await fetchPrivateData();
      setNotice("success", "Order status updated.");
    }
  } catch (error) {
    setNotice("error", error.message);
  }
});

initialize();
