/**
 * Catracho Coconut Ponche — Tienda local
 * Catálogo, favoritos, autenticación, carrito, checkout y comprobantes.
 * Toda la persistencia vive en localStorage. No hay backend ni envío de datos.
 */

(function () {
  "use strict";

  /* ==========================================================================
     1. Catálogo y configuración
     ========================================================================== */

  const PRODUCTS = [
    {
      id: "ponche-clasico",
      key: "p1",
      category: "cups",
      priceHNL: 65,
      priceUSD: 2.6,
      image: "assets/img/ponche-cup-jar.webp",
      rating: 4.9,
      reviews: 128,
      canAddAlcohol: true,
      customizable: true
    },
    {
      id: "ponche-yuscaran",
      key: "p2",
      category: "cups",
      priceHNL: 85,
      priceUSD: 3.4,
      image: "assets/img/real-product-cup-close.jpg",
      rating: 4.8,
      reviews: 74,
      canAddAlcohol: false,
      customizable: true
    },
    {
      id: "ponche-cacao-atucun",
      key: "p3",
      category: "cups",
      priceHNL: 80,
      priceUSD: 3.2,
      image: "assets/img/cup-top-view.webp",
      rating: 4.9,
      reviews: 96,
      canAddAlcohol: true,
      customizable: true
    },
    {
      id: "pack-familiar",
      key: "p4",
      category: "combos",
      priceHNL: 290,
      priceUSD: 11.6,
      image: "assets/img/real-product-cup-jar.jpg",
      rating: 5,
      reviews: 41,
      canAddAlcohol: true,
      customizable: true
    },
    {
      id: "tarro-manzanas",
      key: "p5",
      category: "snacks",
      priceHNL: 55,
      priceUSD: 2.2,
      image: "assets/img/dehydrated-apples-cutout.webp",
      rating: 4.7,
      reviews: 63,
      canAddAlcohol: false,
      customizable: false
    }
  ];

  const MODIFIERS = {
    yuscaran: { price: 15, shortKey: "mod.yuscaran" },
    apples: { price: 10, shortKey: "mod.apples" },
    cookies: { price: 10, shortKey: "mod.cookies" }
  };
  const MODIFIER_ORDER = ["yuscaran", "apples", "cookies"];

  const DELIVERY = {
    unah: { fee: 0, labelKey: "delivery.unah", etaKey: "delivery.unahEta", requiresAddress: false },
    center: { fee: 15, labelKey: "delivery.center", etaKey: "delivery.centerEta", requiresAddress: true },
    express: { fee: 30, labelKey: "delivery.express", etaKey: "delivery.expressEta", requiresAddress: true }
  };

  const VALID_COUPONS = { UNAH2026: 10, PONCHE10: 10, CATRACHO15: 15 };
  const VIEWS = ["menu", "heritage", "craft", "calculator", "team", "account"];

  const STORAGE = {
    users: "ccp:users:v1",
    session: "ccp:session:v1",
    cart: "ccp:cart:v1",
    orders: "ccp:orders:v1",
    favorites: "ccp:favorites:v1",
    coupon: "ccp:coupon:v1",
    prefs: "ccp:prefs:v1",
    sequence: "ccp:orderSequence:v1",
    lang: "catracho_store_lang"
  };

  const DEMO_USER = {
    name: "Cliente Demo",
    email: "demo@catracho.hn",
    phone: "9999-9999",
    password: "demo1234"
  };

  /* Número de WhatsApp de la tienda.
     Déjalo vacío mientras no exista un número real. Si lo configuras,
     aparecen los botones para enviar el comprobante por WhatsApp. */
  const STORE_WHATSAPP = "";

  const MAX_QTY = 99;

  /* ==========================================================================
     2. Estado de la aplicación
     ========================================================================== */

  const state = {
    view: "menu",
    filter: "all",
    query: "",
    sort: "featured",
    cart: [],
    coupon: null,
    favorites: new Set(),
    session: null,
    delivery: "unah",
    prefs: {},
    checkoutStep: 1,
    productModal: null,
    lastOrder: null,
    pendingCheckout: false,
    authIntent: null,
    authMode: "login",
    accountTab: "summary",
    lastFocused: null
  };

  /* ==========================================================================
     3. Utilidades generales
     ========================================================================== */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      toast(t("toast.storageError"), "error");
      return false;
    }
  }

  function formatHNL(value) {
    const number = Number(value) || 0;
    const formatter = new Intl.NumberFormat(currentLang === "en" ? "en-US" : "es-HN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return "L " + formatter.format(number);
  }

  function formatDate(iso, withTime) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso || "");
    const locale = currentLang === "en" ? "en-US" : "es-HN";
    return withTime
      ? date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
      : date.toLocaleDateString(locale, { dateStyle: "medium" });
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function normalizePhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("504")) digits = digits.slice(3);
    return digits;
  }

  function isValidPhone(value) {
    return /^\d{8}$/.test(normalizePhone(value));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
  }

  function isValidPassword(value) {
    return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(String(value || ""));
  }

  function randomSalt() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /* ==========================================================================
     4. Persistencia y migración
     ========================================================================== */

  function migrateLegacyData() {
    const hasNewCart = localStorage.getItem(STORAGE.cart) != null;
    if (!hasNewCart) {
      const legacy = readJSON("catracho_cart", null);
      if (Array.isArray(legacy) && legacy.length) {
        const converted = legacy.map((item) => {
          const labels = Array.isArray(item.labels) ? item.labels.join(" ").toLowerCase() : "";
          return {
            productId: item.productId,
            qty: item.qty,
            modifiers: {
              yuscaran: labels.includes("yuscar") || labels.includes("yusc"),
              apples: labels.includes("manzana"),
              cookies: labels.includes("galleta")
            }
          };
        });
        const sanitized = sanitizeCart(converted);
        if (sanitized.length) writeJSON(STORAGE.cart, sanitized);
      }
    }

    try {
      localStorage.removeItem("catracho_cart");
      localStorage.removeItem("catracho_sb_collapsed");
    } catch (error) {
      /* Sin acción: la migración es best-effort. */
    }
  }

  function loadPreferences() {
    const prefs = readJSON(STORAGE.prefs, {});
    state.prefs = prefs && typeof prefs === "object" ? prefs : {};
    state.delivery = DELIVERY[state.prefs.delivery] ? state.prefs.delivery : "unah";
  }

  function savePreferences() {
    state.prefs.delivery = state.delivery;
    writeJSON(STORAGE.prefs, state.prefs);
  }

  function normalizeCoupon(raw) {
    if (!raw) return null;
    const code = String(typeof raw === "string" ? raw : raw.code || "").toUpperCase();
    const percent = VALID_COUPONS[code];
    return percent ? { code, percent } : null;
  }

  function loadSession() {
    const session = readJSON(STORAGE.session, null);
    if (!session || !session.userId || !session.expiresAt) return null;
    if (Date.now() > Number(session.expiresAt)) {
      try {
        localStorage.removeItem(STORAGE.session);
      } catch (error) {
        /* Sin acción. */
      }
      return null;
    }
    return session;
  }

  function currentUser() {
    if (!state.session) return null;
    const users = readJSON(STORAGE.users, []);
    if (!Array.isArray(users)) return null;
    const user = users.find((candidate) => candidate && candidate.id === state.session.userId);
    if (!user) {
      state.session = null;
      try {
        localStorage.removeItem(STORAGE.session);
      } catch (error) {
        /* Sin acción. */
      }
      return null;
    }
    return user;
  }

  /* ==========================================================================
     5. Acceso al catálogo
     ========================================================================== */

  function getProduct(id) {
    return PRODUCTS.find((product) => product.id === id) || null;
  }

  function productName(product) {
    return product ? t(product.key + ".name") : "";
  }

  function productDescription(product) {
    return product ? t(product.key + ".desc") : "";
  }

  function productBadge(product) {
    return product ? t(product.key + ".badge") : "";
  }

  function productSpecs(product) {
    return product ? t(product.key + ".specs") : "";
  }

  function modifierLabel(code) {
    const modifier = MODIFIERS[code];
    return modifier ? t(modifier.shortKey) : code;
  }

  function modifierPrice(code) {
    return MODIFIERS[code] ? MODIFIERS[code].price : 0;
  }

  function normalizeModifiers(raw) {
    const result = {};
    if (!raw || typeof raw !== "object") return result;
    MODIFIER_ORDER.forEach((code) => {
      if (raw[code]) result[code] = true;
    });
    return result;
  }

  function modifiersToArray(modifiers) {
    return MODIFIER_ORDER.filter((code) => modifiers && modifiers[code]);
  }

  function modifiersFromArray(codes) {
    const result = {};
    (Array.isArray(codes) ? codes : []).forEach((code) => {
      if (MODIFIERS[code]) result[code] = true;
    });
    return result;
  }

  function cartKey(productId, modifiers) {
    return productId + "|" + modifiersToArray(modifiers).join(",");
  }

  function itemUnitPrice(item) {
    const product = getProduct(item.productId);
    if (!product) return 0;
    return (
      product.priceHNL +
      MODIFIER_ORDER.reduce((sum, code) => sum + (item.modifiers && item.modifiers[code] ? modifierPrice(code) : 0), 0)
    );
  }

  /* ==========================================================================
     6. Carrito
     ========================================================================== */

  function sanitizeCart(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    const seen = new Set();

    raw.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const product = getProduct(item.productId);
      if (!product) return;
      const qty = clamp(parseInt(item.qty, 10) || 1, 1, MAX_QTY);
      const modifiers = normalizeModifiers(item.modifiers);
      const key = cartKey(product.id, modifiers);

      if (seen.has(key)) {
        const existing = result.find((entry) => entry.key === key);
        if (existing) existing.qty = clamp(existing.qty + qty, 1, MAX_QTY);
        return;
      }

      seen.add(key);
      result.push({ key, productId: product.id, qty, modifiers });
    });

    return result;
  }

  function loadCart() {
    state.cart = sanitizeCart(readJSON(STORAGE.cart, []));
  }

  function saveCart() {
    writeJSON(STORAGE.cart, state.cart);
    updateBadges();
    renderCart();
  }

  function cartDetailed() {
    return state.cart
      .map((item) => {
        const product = getProduct(item.productId);
        if (!product) return null;
        const unitPrice = itemUnitPrice(item);
        return {
          ...item,
          product,
          name: productName(product),
          unitPrice,
          lineTotal: unitPrice * item.qty,
          modifierLabels: modifiersToArray(item.modifiers).map(modifierLabel)
        };
      })
      .filter(Boolean);
  }

  function cartCount() {
    return state.cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function cartTotals() {
    const items = cartDetailed();
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const percent = state.coupon ? state.coupon.percent : 0;
    const discount = percent ? (subtotal * percent) / 100 : 0;
    const delivery = DELIVERY[state.delivery] || DELIVERY.unah;
    const deliveryFee = delivery.fee;
    const total = Math.max(0, subtotal - discount + deliveryFee);
    return { subtotal, discount, deliveryFee, total, count: cartCount(), items };
  }

  function addToCart(productId, modifiers, qty, options) {
    const product = getProduct(productId);
    if (!product) return false;

    const amount = clamp(parseInt(qty, 10) || 1, 1, MAX_QTY);
    const normalized = normalizeModifiers(modifiers);
    const key = cartKey(product.id, normalized);
    const existing = state.cart.find((item) => item.key === key);

    if (existing) {
      existing.qty = clamp(existing.qty + amount, 1, MAX_QTY);
    } else {
      state.cart.push({ key, productId: product.id, qty: amount, modifiers: normalized });
    }

    saveCart();

    const opts = options || {};
    if (!opts.silent) {
      toast(t("toast.added"), "success");
    }
    if (opts.open !== false) {
      openCart();
    }
    return true;
  }

  function changeCartQty(key, delta) {
    const item = state.cart.find((entry) => entry.key === key);
    if (!item) return;
    item.qty = clamp(item.qty + Number(delta || 0), 0, MAX_QTY);
    if (item.qty <= 0) {
      removeCartItem(key);
      return;
    }
    saveCart();
  }

  function removeCartItem(key) {
    state.cart = state.cart.filter((item) => item.key !== key);
    saveCart();
    toast(t("toast.removed"), "info");
  }

  function applyCoupon() {
    const input = $("#couponInput");
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    const percent = VALID_COUPONS[code];

    if (!percent) {
      toast(t("toast.couponErr"), "error");
      return;
    }

    state.coupon = { code, percent };
    writeJSON(STORAGE.coupon, state.coupon);
    input.value = "";
    toast(t("toast.couponOk", { percent }), "success");
    renderCart();
  }

  function removeCoupon() {
    state.coupon = null;
    try {
      localStorage.removeItem(STORAGE.coupon);
    } catch (error) {
      /* Sin acción. */
    }
    renderCart();
  }

  /* ==========================================================================
     7. Favoritos
     ========================================================================== */

  function loadFavorites() {
    const raw = readJSON(STORAGE.favorites, []);
    const list = Array.isArray(raw) ? raw : [];
    state.favorites = new Set(list.filter((id) => getProduct(id)));
  }

  function saveFavorites() {
    writeJSON(STORAGE.favorites, Array.from(state.favorites));
  }

  function toggleFavorite(productId) {
    const product = getProduct(productId);
    if (!product) return;

    if (state.favorites.has(productId)) {
      state.favorites.delete(productId);
      toast(t("toast.favoriteRemoved"), "info");
    } else {
      state.favorites.add(productId);
      toast(t("toast.favoriteAdded"), "success");
    }

    saveFavorites();
    updateBadges();
    refreshFavoriteButtons();

    if ($("#favoritesModal").classList.contains("active")) renderFavoritesModal();
    if (state.view === "account") renderAccount();
  }

  function favoriteAdd(productId) {
    const product = getProduct(productId);
    if (!product) return;
    addToCart(product.id, {}, 1, { silent: true, open: false });
    toast(t("toast.added"), "success");
    closeOverlay("favoritesModal");
    openCart();
  }

  /* ==========================================================================
     8. Indicadores y carrito
     ========================================================================== */

  function updateBadges() {
    const count = cartCount();
    const favCount = state.favorites.size;

    const cartBadge = $("#cartCount");
    if (cartBadge) {
      cartBadge.textContent = count;
      cartBadge.hidden = count === 0;
      if (count > 0) {
        cartBadge.classList.remove("pop");
        void cartBadge.offsetWidth;
        cartBadge.classList.add("pop");
      }
    }

    const favBadge = $("#favoritesCount");
    if (favBadge) {
      favBadge.textContent = favCount;
      favBadge.hidden = favCount === 0;
    }
  }

  function renderCart() {
    const list = $("#cartItems");
    const footer = $("#cartFooter");
    const countEl = $("#cartItemCount");
    if (!list || !footer) return;

    const count = cartCount();
    if (countEl) {
      countEl.textContent = count === 0 ? "" : count === 1 ? t("cart.itemsCountOne") : t("cart.itemsCount", { n: count });
    }

    if (!state.cart.length) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon"><i class="fa-solid fa-mug-hot" aria-hidden="true"></i></span>
          <h3>${escapeHtml(t("cart.emptyTitle"))}</h3>
          <p>${escapeHtml(t("cart.emptyDesc"))}</p>
          <button class="btn btn-secondary" type="button" data-action="switch-view" data-view="menu">
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>${escapeHtml(t("cart.viewMenu"))}
          </button>
        </div>`;
      footer.hidden = true;
      return;
    }

    list.innerHTML = cartDetailed()
      .map((item) => {
        const modifiers = item.modifierLabels.length
          ? `<div class="cart-item-mods">${escapeHtml(item.modifierLabels.join(" · "))}</div>`
          : "";
        return `
          <article class="cart-item">
            <img src="${escapeHtml(item.product.image)}" alt="${escapeHtml(item.name)}" width="62" height="62" loading="lazy">
            <div class="cart-item-info">
              <h3>${escapeHtml(item.name)}</h3>
              ${modifiers}
              <div class="cart-item-price">${formatHNL(item.unitPrice)} <small>${escapeHtml(t("cart.each"))}</small></div>
            </div>
            <div class="cart-item-controls">
              <div class="qty-stepper">
                <button type="button" data-action="cart-qty" data-key="${escapeHtml(item.key)}" data-delta="-1" aria-label="−"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
                <span>${item.qty}</span>
                <button type="button" data-action="cart-qty" data-key="${escapeHtml(item.key)}" data-delta="1" aria-label="+"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
              </div>
              <button class="cart-remove" type="button" data-action="cart-remove" data-key="${escapeHtml(item.key)}">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>${escapeHtml(t("cart.remove"))}
              </button>
            </div>
          </article>`;
      })
      .join("");

    footer.hidden = false;

    const deliverySelect = $("#cartDelivery");
    if (deliverySelect) deliverySelect.value = state.delivery;

    const loginNote = $("#cartLoginNote");
    if (loginNote) loginNote.hidden = Boolean(currentUser());

    const feedback = $("#couponFeedback");
    const feedbackText = $("#couponFeedbackText");
    if (feedback && feedbackText) {
      feedback.hidden = !state.coupon;
      if (state.coupon) {
        feedbackText.textContent = t("cart.couponApplied", {
          code: state.coupon.code,
          percent: state.coupon.percent
        });
      }
    }

    renderCartTotals();
  }

  function renderCartTotals() {
    const totals = cartTotals();
    const subtotal = $("#cartSubtotal");
    const discountLine = $("#cartDiscountLine");
    const discount = $("#cartDiscount");
    const deliveryFee = $("#cartDeliveryFee");
    const total = $("#cartTotal");

    if (subtotal) subtotal.textContent = formatHNL(totals.subtotal);
    if (discountLine) discountLine.hidden = totals.discount <= 0;
    if (discount) discount.textContent = "− " + formatHNL(totals.discount);
    if (deliveryFee) deliveryFee.textContent = totals.deliveryFee === 0 ? t("delivery.free") : formatHNL(totals.deliveryFee);
    if (total) total.textContent = formatHNL(totals.total);
  }

  function openCart() {
    renderCart();
    openOverlay("cartDrawer");
  }

  function closeCart() {
    closeOverlay("cartDrawer");
  }

  /* ==========================================================================
     9. Catálogo
     ========================================================================== */

  function filteredProducts() {
    let list = PRODUCTS.filter((product) => state.filter === "all" || product.category === state.filter);

    if (state.query.trim()) {
      const query = state.query.trim().toLowerCase();
      list = list.filter((product) => {
        const haystack = [
          productName(product),
          productDescription(product),
          productSpecs(product),
          productBadge(product)
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });
    }

    const sorted = list.slice();
    if (state.sort === "price-asc") sorted.sort((a, b) => a.priceHNL - b.priceHNL);
    else if (state.sort === "price-desc") sorted.sort((a, b) => b.priceHNL - a.priceHNL);
    else if (state.sort === "name") {
      sorted.sort((a, b) => productName(a).localeCompare(productName(b), currentLang));
    } else {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return sorted;
  }

  function productCard(product, index) {
    const name = escapeHtml(productName(product));
    const description = escapeHtml(productDescription(product));
    const specs = escapeHtml(productSpecs(product));
    const badge = escapeHtml(productBadge(product));
    const favorite = state.favorites.has(product.id);
    const favoriteLabel = favorite ? t("catalog.favoriteRemove") : t("catalog.favoriteAdd");

    const secondaryAction = `<button class="btn btn-secondary btn-icon" type="button" data-action="customize" data-id="${product.id}" aria-label="${escapeHtml(t("catalog.customize"))}" title="${escapeHtml(t("catalog.customize"))}"><i class="fa-solid fa-sliders" aria-hidden="true"></i></button>`;

    return `
      <article class="product-card" style="--i:${index % 4}">
        <div class="product-media">
          <img src="${escapeHtml(product.image)}" alt="${name}" loading="lazy" width="600" height="450">
          <span class="product-badge">${badge}</span>
          <button class="fav-btn ${favorite ? "active" : ""}" type="button" data-action="toggle-favorite" data-id="${product.id}" aria-label="${escapeHtml(favoriteLabel)}" aria-pressed="${favorite}">
            <i class="${favorite ? "fa-solid" : "fa-regular"} fa-heart" aria-hidden="true"></i>
          </button>
        </div>
        <div class="product-body">
          <div class="product-rating">
            <span class="stars" aria-hidden="true">
              <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
            </span>
            <span>${product.rating.toFixed(1)} · ${escapeHtml(t("catalog.reviews", { n: product.reviews }))}</span>
          </div>
          <h3 class="product-title">${name}</h3>
          <p class="product-desc">${description}</p>
          <div class="product-specs">${specs}</div>
          <div class="product-price">
            <strong>${formatHNL(product.priceHNL)}</strong>
            <span>$${product.priceUSD.toFixed(2)} USD</span>
          </div>
          <div class="product-actions">
            <button class="btn btn-primary" type="button" data-action="add-to-cart" data-id="${product.id}">
              <i class="fa-solid fa-plus" aria-hidden="true"></i><span>${escapeHtml(t("catalog.add"))}</span>
            </button>
            ${secondaryAction}
          </div>
        </div>
      </article>`;
  }

  function renderProducts() {
    const grid = $("#productGrid");
    const empty = $("#catalogEmpty");
    const results = $("#resultsCount");
    if (!grid) return;

    const list = filteredProducts();
    grid.innerHTML = list.map((product, index) => productCard(product, index)).join("");
    if (empty) empty.hidden = list.length > 0;
    if (results) {
      results.textContent = list.length === 1 ? t("catalog.resultsOne") : t("catalog.results", { n: list.length });
    }

    $$(".cat-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.cat === state.filter);
    });

    const sortSelect = $("#sortSelect");
    if (sortSelect) sortSelect.value = state.sort;

    observeReveals();
  }

  /* ==========================================================================
     10. Modal de producto
     ========================================================================== */

  function openProduct(productId) {
    const product = getProduct(productId);
    if (!product) return;
    state.productModal = { id: product.id, qty: 1, modifiers: {} };
    renderProductModal();
    openOverlay("productModal");
  }

  function renderProductModal() {
    const container = $("#productModalBody");
    if (!container || !state.productModal) return;
    const product = getProduct(state.productModal.id);
    if (!product) return;

    const modifiers = state.productModal.modifiers;
    const modifierButtons = [];

    if (product.customizable) {
      if (product.canAddAlcohol) {
        modifierButtons.push(renderModifierButton("yuscaran", modifiers));
      }
      modifierButtons.push(renderModifierButton("apples", modifiers));
      modifierButtons.push(renderModifierButton("cookies", modifiers));
    }

    const modifierSection = modifierButtons.length
      ? `<div class="field-label" style="margin:4px 0 7px;">${escapeHtml(t("cust.options"))}</div>
         <p class="step-sub" style="margin:0 0 8px;">${escapeHtml(t("cust.optionsHint"))}</p>
         <div class="modifier-list">${modifierButtons.join("")}</div>`
      : "";

    container.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="eyebrow">${escapeHtml(productBadge(product))}</span>
          <h2 id="productModalTitle">${escapeHtml(productName(product))}</h2>
        </div>
        <button class="icon-btn ghost" type="button" data-action="close-product" aria-label="${escapeHtml(t("cust.close"))}">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>
      <div class="product-detail">
        <div class="product-detail-media">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(productName(product))}" width="700" height="900">
        </div>
        <div class="product-detail-body">
          <div class="product-rating">
            <span class="stars" aria-hidden="true"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></span>
            <span>${product.rating.toFixed(1)} · ${escapeHtml(t("catalog.reviews", { n: product.reviews }))}</span>
          </div>
          <p class="product-detail-desc">${escapeHtml(productDescription(product))}</p>
          <div class="product-detail-specs">${escapeHtml(productSpecs(product))}</div>
          <div class="product-detail-price">
            <strong>${formatHNL(product.priceHNL)}</strong>
            <span>$${product.priceUSD.toFixed(2)} USD</span>
          </div>
          ${modifierSection}
          <div class="product-detail-footer">
            <div class="qty-control">
              <button type="button" data-action="pm-qty" data-delta="-1" aria-label="−"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
              <span id="pmQty">${state.productModal.qty}</span>
              <button type="button" data-action="pm-qty" data-delta="1" aria-label="+"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            </div>
            <div class="product-detail-total">
              <span>${escapeHtml(t("cust.total"))}</span>
              <strong id="pmTotal">${formatHNL(product.priceHNL * state.productModal.qty)}</strong>
            </div>
            <button class="btn btn-primary btn-lg" type="button" data-action="pm-add" style="flex:1;min-width:180px;">
              <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>${escapeHtml(t("cust.add"))}
            </button>
          </div>
        </div>
      </div>`;
  }

  function renderModifierButton(code, selected) {
    const modifier = MODIFIERS[code];
    const active = Boolean(selected[code]);
    return `
      <button class="modifier-option ${active ? "selected" : ""}" type="button" data-action="pm-modifier" data-mod="${code}" aria-pressed="${active}">
        <span><i class="fa-solid ${active ? "fa-circle-check" : "fa-circle-plus"}" aria-hidden="true"></i> ${escapeHtml(t("cust." + code))}</span>
        <strong>+ ${formatHNL(modifier.price)}</strong>
      </button>`;
  }

  function updateProductModalTotal() {
    if (!state.productModal) return;
    const product = getProduct(state.productModal.id);
    if (!product) return;
    const unit =
      product.priceHNL +
      MODIFIER_ORDER.reduce((sum, code) => sum + (state.productModal.modifiers[code] ? modifierPrice(code) : 0), 0);
    const total = $("#pmTotal");
    const qty = $("#pmQty");
    if (qty) qty.textContent = state.productModal.qty;
    if (total) total.textContent = formatHNL(unit * state.productModal.qty);
  }

  function toggleProductModifier(code) {
    if (!state.productModal || !MODIFIERS[code]) return;
    state.productModal.modifiers[code] = !state.productModal.modifiers[code];
    const button = document.querySelector(`[data-action="pm-modifier"][data-mod="${code}"]`);
    if (button) {
      button.classList.toggle("selected", Boolean(state.productModal.modifiers[code]));
      button.setAttribute("aria-pressed", String(Boolean(state.productModal.modifiers[code])));
      const icon = button.querySelector("i");
      if (icon) icon.className = state.productModal.modifiers[code] ? "fa-solid fa-circle-check" : "fa-solid fa-circle-plus";
    }
    updateProductModalTotal();
  }

  function changeProductQty(delta) {
    if (!state.productModal) return;
    state.productModal.qty = clamp(state.productModal.qty + Number(delta || 0), 1, MAX_QTY);
    updateProductModalTotal();
  }

  function addProductModalToCart() {
    if (!state.productModal) return;
    const product = getProduct(state.productModal.id);
    if (!product) return;
    const { id, qty, modifiers } = state.productModal;
    closeOverlay("productModal");
    addToCart(id, modifiers, qty, { silent: false, open: true });
  }

  /* ==========================================================================
     11. Modal de favoritos
     ========================================================================== */

  function renderFavoritesModal() {
    const list = $("#favoritesList");
    if (!list) return;

    const favorites = Array.from(state.favorites).map(getProduct).filter(Boolean);
    if (!favorites.length) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon"><i class="fa-regular fa-heart" aria-hidden="true"></i></span>
          <h3>${escapeHtml(t("favorites.emptyTitle"))}</h3>
          <p>${escapeHtml(t("favorites.emptyDesc"))}</p>
          <button class="btn btn-secondary" type="button" data-action="favorites-view-menu">
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>${escapeHtml(t("favorites.viewMenu"))}
          </button>
        </div>`;
      return;
    }

    list.innerHTML = `<div class="favorites-list">${favorites
      .map(
        (product) => `
        <article class="favorite-row">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(productName(product))}" width="58" height="58" loading="lazy">
          <div class="favorite-row-info">
            <strong>${escapeHtml(productName(product))}</strong>
            <span>${formatHNL(product.priceHNL)}</span>
          </div>
          <div class="favorite-row-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="favorite-add" data-id="${product.id}" aria-label="${escapeHtml(t("favorites.add"))}" title="${escapeHtml(t("favorites.add"))}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            <button class="btn btn-secondary btn-sm" type="button" data-action="toggle-favorite" data-id="${product.id}" aria-label="${escapeHtml(t("favorites.remove"))}" title="${escapeHtml(t("favorites.remove"))}"><i class="fa-solid fa-heart-crack" aria-hidden="true"></i></button>
          </div>
        </article>`
      )
      .join("")}</div>`;
  }

  function openFavorites() {
    renderFavoritesModal();
    openOverlay("favoritesModal");
  }

  /* ==========================================================================
     12. Navegación y overlays
     ========================================================================== */

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openOverlay(id) {
    closeNav();
    closeSearch();
    const overlay = document.getElementById(id);
    if (!overlay) return;
    state.lastFocused = document.activeElement;
    overlay.classList.add("active");
    document.body.classList.add("modal-open");
    window.setTimeout(() => {
      const focusable = overlay.querySelector(FOCUSABLE);
      if (focusable) focusable.focus();
    }, 60);
  }

  function closeOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove("active");
    if (!document.querySelector(".overlay.active")) {
      document.body.classList.remove("modal-open");
    }
    if (state.lastFocused && document.contains(state.lastFocused)) {
      try {
        state.lastFocused.focus();
      } catch (error) {
        /* Sin acción. */
      }
    }
  }

  function closeByName(name) {
    const map = {
      cart: "cartDrawer",
      auth: "authModal",
      product: "productModal",
      favorites: "favoritesModal",
      checkout: "checkoutModal",
      ticket: "ticketModal",
      lightbox: "lightboxModal"
    };
    if (map[name]) closeOverlay(map[name]);
  }

  function switchView(view, options) {
    if (!VIEWS.includes(view)) return;
    const opts = options || {};
    state.view = view;

    $$(".view-panel").forEach((panel) => {
      const active = panel.id === "view-" + view;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });

    $$("[data-nav-view]").forEach((link) => {
      const active = link.dataset.navView === view;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    closeNav();
    if (!opts.keepSearch) closeSearch();

    if (view === "account") renderAccount();
    if (view === "calculator") updateEventBatch($("#eventInput") ? $("#eventInput").value : 24);

    if (opts.updateHash !== false) {
      const hash = "#" + view;
      try {
        if (opts.replace) history.replaceState(null, "", hash);
        else if (window.location.hash !== hash) history.pushState(null, "", hash);
      } catch (error) {
        /* file:// puede bloquear history; la vista sigue funcionando. */
      }
    }

    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: "smooth" });

    window.requestAnimationFrame(() => {
      const panel = document.getElementById("view-" + view);
      if (!panel) return;
      panel.querySelectorAll("[data-reveal]").forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight) element.classList.add("is-visible");
      });
    });
  }

  function toggleNav() {
    const header = $("#siteHeader");
    if (!header) return;
    const open = header.classList.toggle("nav-open");
    document.body.classList.toggle("nav-open", open);
    const toggle = $(".menu-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
  }

  function closeNav() {
    const header = $("#siteHeader");
    if (!header) return;
    header.classList.remove("nav-open");
    document.body.classList.remove("nav-open");
    const toggle = $(".menu-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  function toggleSearch() {
    const header = $("#siteHeader");
    if (!header) return;
    const open = header.classList.toggle("search-open");
    if (open) {
      closeNav();
      const input = $("#searchInput");
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function closeSearch() {
    const header = $("#siteHeader");
    if (header) header.classList.remove("search-open");
  }

  function openAccount() {
    if (currentUser()) switchView("account");
    else openAuth("login", "account");
  }

  function scrollToCatalog() {
    if (state.view !== "menu") switchView("menu", { keepScroll: true });
    const catalog = $("#menu-catalog");
    if (catalog) {
      window.setTimeout(() => {
        catalog.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }

  function openLightbox(src, titleKey, descKey) {
    const image = $("#lightboxImg");
    const title = $("#lightboxTitle");
    const desc = $("#lightboxDesc");
    if (image) image.src = src;
    if (title) title.textContent = titleKey ? t(titleKey) : "";
    if (desc) desc.textContent = descKey ? t(descKey) : "";
    openOverlay("lightboxModal");
  }

  /* ==========================================================================
     13. Toasts y animaciones
     ========================================================================== */

  function toast(message, type) {
    const shelf = $("#toastShelf");
    if (!shelf) return;
    const kind = type || "info";
    const icons = {
      success: "fa-solid fa-check",
      error: "fa-solid fa-triangle-exclamation",
      info: "fa-solid fa-circle-info"
    };

    const element = document.createElement("div");
    element.className = "toast " + kind;
    element.innerHTML = `<i class="${icons[kind] || icons.info}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
    shelf.appendChild(element);

    window.setTimeout(() => {
      element.classList.add("leaving");
      window.setTimeout(() => element.remove(), 240);
    }, 3200);
  }

  let revealObserver = null;

  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    document.body.classList.add("reveal-ready");
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    observeReveals();
  }

  function observeReveals() {
    if (!revealObserver) return;
    $$("[data-reveal]:not(.is-visible)").forEach((element) => revealObserver.observe(element));
  }

  /* ==========================================================================
     14. Autenticación local
     ========================================================================== */

  function sha256Fallback(text) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }

    let ascii = "";
    const bytes = new TextEncoder().encode(text);
    for (let i = 0; i < bytes.length; i++) ascii += String.fromCharCode(bytes[i]);

    const maxWord = Math.pow(2, 32);
    let result = "";
    const words = [];
    const asciiBitLength = ascii.length * 8;

    let hash = (sha256Fallback.h = sha256Fallback.h || []);
    const k = (sha256Fallback.k = sha256Fallback.k || []);
    let primeCounter = k.length;
    const isComposite = {};

    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += "\x80";
    while (ascii.length % 64 - 56) ascii += "\x00";

    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);

      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];
        const wi =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0;
        w[i] = wi;

        const temp1 =
          (hash[7] +
            (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
            ((e & hash[5]) ^ (~e & hash[6])) +
            k[i] +
            wi) |
          0;
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }

    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  async function hashPassword(password, salt) {
    const input = salt + ":" + password;
    if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
      try {
        const data = new TextEncoder().encode(input);
        const digest = await window.crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      } catch (error) {
        /* Fallback local para contextos sin Web Crypto. */
      }
    }
    return sha256Fallback(input);
  }

  async function ensureDemoUser() {
    const users = readJSON(STORAGE.users, []);
    const list = Array.isArray(users) ? users : [];
    if (list.some((user) => user && user.email === DEMO_USER.email)) return;

    const salt = randomSalt();
    const passHash = await hashPassword(DEMO_USER.password, salt);
    list.push({
      id: uid("usr"),
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      phone: DEMO_USER.phone,
      salt,
      passHash,
      createdAt: new Date().toISOString()
    });
    writeJSON(STORAGE.users, list);
  }

  function saveSession(user, remember) {
    const ttl = remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    const session = {
      userId: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      remember: Boolean(remember)
    };
    writeJSON(STORAGE.session, session);
    state.session = session;
  }

  function updateAccountUI() {
    const user = currentUser();
    const label = $("#accountLabel");
    const avatar = $("#accountAvatar");
    const button = $("#accountBtn");

    if (user) {
      if (label) label.textContent = String(user.name || "").split(/\s+/)[0] || t("nav.account");
      if (avatar) avatar.textContent = getInitials(user.name);
      if (button) {
        button.setAttribute("aria-label", t("nav.account") + ": " + user.name);
        button.setAttribute("title", user.name);
      }
    } else {
      if (label) label.textContent = t("nav.login");
      if (avatar) avatar.innerHTML = '<i class="fa-solid fa-user" aria-hidden="true"></i>';
      if (button) {
        button.setAttribute("aria-label", t("nav.login"));
        button.setAttribute("title", t("nav.login"));
      }
    }
  }

  function clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll(".field-error").forEach((element) => {
      element.hidden = true;
      element.textContent = "";
    });
    form.querySelectorAll("input, select, textarea").forEach((input) => {
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
    });
    form.querySelectorAll(".form-alert").forEach((alert) => {
      alert.hidden = true;
      alert.textContent = "";
    });
  }

  function setFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) {
      input.classList.toggle("invalid", Boolean(message));
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
  }

  function showFormAlert(id, message) {
    const alert = document.getElementById(id);
    if (!alert) return;
    alert.textContent = message;
    alert.hidden = !message;
  }

  function setLoading(button, loading) {
    if (!button) return;
    button.classList.toggle("loading", Boolean(loading));
    button.disabled = Boolean(loading);
  }

  function setAuthMode(mode) {
    state.authMode = mode === "register" ? "register" : "login";
    const login = state.authMode === "login";

    const loginForm = $("#loginForm");
    const registerForm = $("#registerForm");
    if (loginForm) loginForm.hidden = !login;
    if (registerForm) registerForm.hidden = login;

    $$(".auth-tab").forEach((tab) => {
      const active = tab.dataset.mode === state.authMode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    const title = $("#authTitle");
    const sub = $("#authSub");
    if (title) title.textContent = t(login ? "auth.loginTitle" : "auth.registerTitle");
    if (sub) sub.textContent = t(login ? "auth.loginSub" : "auth.registerSub");

    clearFormErrors(loginForm);
    clearFormErrors(registerForm);
  }

  function openAuth(mode, intent) {
    state.authIntent = intent || null;
    setAuthMode(mode || "login");
    openOverlay("authModal");
    window.setTimeout(() => {
      const field = state.authMode === "login" ? $("#loginEmail") : $("#registerName");
      if (field) field.focus();
    }, 90);
  }

  function afterAuth() {
    const intent = state.authIntent;
    state.authIntent = null;
    updateAccountUI();

    if (intent === "checkout" || state.pendingCheckout) {
      state.pendingCheckout = false;
      window.setTimeout(() => openCheckout(), 140);
      return;
    }
    if (intent === "account") {
      switchView("account");
      return;
    }
    if (state.view === "account") renderAccount();
  }

  function showGlobalLoader(message, durationMs = 600) {
    const loader = $("#globalLoader");
    const msgEl = $("#loaderMessage");
    if (!loader) return Promise.resolve();
    if (msgEl) msgEl.textContent = message || "Processing...";
    loader.classList.add("active");
    return new Promise((resolve) => {
      setTimeout(() => {
        loader.classList.remove("active");
        setTimeout(resolve, 180);
      }, durationMs);
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = $("#loginForm");
    clearFormErrors(form);

    const email = ($("#loginEmail").value || "").trim().toLowerCase();
    const password = $("#loginPassword").value || "";
    let valid = true;

    if (!isValidEmail(email)) {
      setFieldError("loginEmail", "loginEmailError", t("auth.errEmail"));
      valid = false;
    }
    if (!password) {
      setFieldError("loginPassword", "loginPasswordError", t("checkout.required"));
      valid = false;
    }
    if (!valid) return;

    const button = $("#loginSubmit");
    setLoading(button, true);

    try {
      await ensureDemoUser();
      const users = readJSON(STORAGE.users, []);
      const list = Array.isArray(users) ? users : [];
      const user = list.find((candidate) => candidate && candidate.email === email);
      const passHash = user ? await hashPassword(password, user.salt) : "";

      if (!user || passHash !== user.passHash) {
        showFormAlert("loginAlert", t("auth.errCredentials"));
        return;
      }

      await showGlobalLoader("Signing into Catracho Club...", 500);

      saveSession(user, $("#loginRemember").checked);
      updateAccountUI();
      closeOverlay("authModal");
      toast(t("toast.loginWelcome", { name: String(user.name).split(/\s+/)[0] }), "success");
      afterAuth();
    } finally {
      setLoading(button, false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const form = $("#registerForm");
    clearFormErrors(form);

    const name = ($("#registerName").value || "").trim();
    const email = ($("#registerEmail").value || "").trim().toLowerCase();
    const phone = ($("#registerPhone").value || "").trim();
    const password = $("#registerPassword").value || "";
    const confirm = $("#registerConfirm").value || "";
    const terms = $("#registerTerms").checked;

    let valid = true;
    if (name.length < 3) {
      setFieldError("registerName", "registerNameError", t("auth.errName"));
      valid = false;
    }
    if (!isValidEmail(email)) {
      setFieldError("registerEmail", "registerEmailError", t("auth.errEmail"));
      valid = false;
    }
    if (!isValidPhone(phone)) {
      setFieldError("registerPhone", "registerPhoneError", t("auth.errPhone"));
      valid = false;
    }
    if (!isValidPassword(password)) {
      setFieldError("registerPassword", "registerPasswordError", t("auth.errPassword"));
      valid = false;
    }
    if (password !== confirm) {
      setFieldError("registerConfirm", "registerConfirmError", t("auth.errConfirm"));
      valid = false;
    }
    if (!terms) {
      setFieldError("registerTerms", "registerTermsError", t("auth.errTerms"));
      valid = false;
    }
    if (!valid) return;

    const button = $("#registerSubmit");
    setLoading(button, true);

    try {
      await ensureDemoUser();
      const users = readJSON(STORAGE.users, []);
      const list = Array.isArray(users) ? users : [];

      if (list.some((candidate) => candidate && candidate.email === email)) {
        setFieldError("registerEmail", "registerEmailError", t("auth.errDuplicate"));
        return;
      }

      const salt = randomSalt();
      const passHash = await hashPassword(password, salt);
      const user = {
        id: uid("usr"),
        name,
        email,
        phone,
        salt,
        passHash,
        createdAt: new Date().toISOString()
      };

      list.push(user);
      if (!writeJSON(STORAGE.users, list)) return;

      await showGlobalLoader("Creating your member pass...", 600);

      saveSession(user, true);
      updateAccountUI();
      closeOverlay("authModal");
      toast(t("toast.registered"), "success");
      afterAuth();
    } finally {
      setLoading(button, false);
    }
  }

  async function logout() {
    await showGlobalLoader("Signing out...", 450);
    state.session = null;
    state.accountTab = "summary";
    try {
      localStorage.removeItem(STORAGE.session);
    } catch (error) {
      /* Sin acción. */
    }
    updateAccountUI();
    toast(t("toast.loggedOut"), "info");
    if (state.view === "account") renderAccount();
    renderCart();
  }

  /* ==========================================================================
     15. Cuenta e historial
     ========================================================================== */

  function getOrdersForUser(userId) {
    const orders = readJSON(STORAGE.orders, []);
    const list = Array.isArray(orders) ? orders : [];
    return list
      .filter((order) => order && order.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function orderItemName(item) {
    const product = getProduct(item.productId);
    return product ? productName(product) : item.name || item.productId;
  }

  function memberCode(user) {
    const created = new Date(user && user.createdAt ? user.createdAt : Date.now());
    const year = Number.isNaN(created.getTime()) ? new Date().getFullYear() : created.getFullYear();
    const raw = String((user && user.id) || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    const tail = (raw.slice(-4) || "0000").padStart(4, "0");
    return "CCP-" + year + "-" + tail;
  }

  function memberStatusChip(order) {
    const statusKey = "status." + (order.status || "recibido");
    return `<span class="member-status"><span class="member-status-dot" aria-hidden="true"></span>${escapeHtml(t(statusKey))}</span>`;
  }

  function orderStop(order) {
    const items = (Array.isArray(order.items) ? order.items : [])
      .map(
        (item) => `
        <li class="order-stop-line">
          <span>${item.qty}× ${escapeHtml(orderItemName(item))}</span>
          <strong>${formatHNL(item.lineTotal != null ? item.lineTotal : item.unitPrice * item.qty)}</strong>
        </li>`
      )
      .join("");

    const delivery = DELIVERY[order.deliveryId] ? t(DELIVERY[order.deliveryId].labelKey) : "";
    const payment = t("checkout." + (order.paymentMethod || "cash"));

    return `
      <li class="order-stop">
        <span class="order-stop-dot" aria-hidden="true"><i class="fa-solid fa-bag-shopping"></i></span>
        <article class="order-stop-body">
          <header class="order-stop-head">
            <div>
              <p class="order-stop-date">${escapeHtml(formatDate(order.createdAt, true))}</p>
              <h3>#${escapeHtml(order.id)}</h3>
            </div>
            ${memberStatusChip(order)}
          </header>
          <ul class="order-stop-items">${items}</ul>
          <footer class="order-stop-foot">
            <div>
              <strong class="order-stop-total">${formatHNL(order.totals ? order.totals.total : 0)}</strong>
              <span class="order-stop-meta">${escapeHtml(delivery)} · ${escapeHtml(payment)}</span>
            </div>
            <div class="order-stop-actions">
              <button class="btn btn-secondary btn-sm" type="button" data-action="order-ticket" data-order="${escapeHtml(order.id)}">
                <i class="fa-solid fa-receipt" aria-hidden="true"></i>${escapeHtml(t("account.viewTicket"))}
              </button>
              <button class="btn btn-primary btn-sm" type="button" data-action="reorder" data-order="${escapeHtml(order.id)}">
                <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>${escapeHtml(t("account.reorder"))}
              </button>
            </div>
          </footer>
        </article>
      </li>`;
  }

  function memberFavRow(product) {
    return `
      <li class="member-fav-row">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(productName(product))}" width="52" height="52" loading="lazy">
        <div class="member-fav-info">
          <strong>${escapeHtml(productName(product))}</strong>
          <span>${formatHNL(product.priceHNL)}</span>
        </div>
        <div class="member-fav-actions">
          <button type="button" data-action="favorite-add" data-id="${product.id}" aria-label="${escapeHtml(t("favorites.add"))}" title="${escapeHtml(t("favorites.add"))}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          <button type="button" data-action="toggle-favorite" data-id="${product.id}" aria-label="${escapeHtml(t("favorites.remove"))}" title="${escapeHtml(t("favorites.remove"))}"><i class="fa-solid fa-heart-crack" aria-hidden="true"></i></button>
        </div>
      </li>`;
  }

  function memberEmpty(icon, titleKey, descKey, buttonKey) {
    return `
      <div class="empty-state" style="padding:36px 16px;">
        <span class="empty-icon"><i class="${icon}" aria-hidden="true"></i></span>
        <h3>${escapeHtml(t(titleKey))}</h3>
        <p>${escapeHtml(t(descKey))}</p>
        <button class="btn btn-secondary" type="button" data-action="switch-view" data-view="menu">${escapeHtml(t(buttonKey))}</button>
      </div>`;
  }

  function renderAccountSummary(orders, favorites) {
    const latest = orders[0];
    let spotlight;

    if (latest) {
      const list = Array.isArray(latest.items) ? latest.items : [];
      const lines = list.slice(0, 4).map((item) => `
        <li>
          <span>${item.qty}× ${escapeHtml(orderItemName(item))}</span>
          <strong>${formatHNL(item.lineTotal != null ? item.lineTotal : item.unitPrice * item.qty)}</strong>
        </li>`).join("");
      const more = list.length > 4
        ? `<li><span>${escapeHtml(t("account.itemsMore", { n: list.length - 4 }))}</span><strong></strong></li>`
        : "";
      const delivery = DELIVERY[latest.deliveryId] ? t(DELIVERY[latest.deliveryId].labelKey) : "";

      spotlight = `
        <article class="member-spotlight">
          <div class="member-spotlight-head">
            <div>
              <p class="member-block-kicker">${escapeHtml(t("account.latestTitle"))}</p>
              <h3>#${escapeHtml(latest.id)}</h3>
              <p class="member-spotlight-date">${escapeHtml(formatDate(latest.createdAt, true))}</p>
            </div>
            ${memberStatusChip(latest)}
          </div>
          <div class="member-spotlight-total">${formatHNL(latest.totals ? latest.totals.total : 0)}</div>
          <p class="member-spotlight-meta">${escapeHtml(delivery)} · ${escapeHtml(t("checkout." + (latest.paymentMethod || "cash")))}</p>
          <ul class="member-spotlight-lines">${lines}${more}</ul>
          <div class="member-spotlight-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="reorder" data-order="${escapeHtml(latest.id)}">
              <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>${escapeHtml(t("account.reorder"))}
            </button>
            <button class="btn btn-secondary btn-sm" type="button" data-action="order-ticket" data-order="${escapeHtml(latest.id)}">
              <i class="fa-solid fa-receipt" aria-hidden="true"></i>${escapeHtml(t("account.viewTicket"))}
            </button>
            <button class="btn btn-secondary btn-sm" type="button" data-action="account-tab" data-tab="orders">
              <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>${escapeHtml(t("account.viewHistory"))}
            </button>
          </div>
        </article>`;
    } else {
      spotlight = `
        <article class="member-spotlight member-spotlight-empty">
          <p class="member-block-kicker">${escapeHtml(t("account.latestTitle"))}</p>
          <h3>${escapeHtml(t("account.latestEmpty"))}</h3>
          <p>${escapeHtml(t("account.latestEmptyDesc"))}</p>
          <button class="btn btn-primary" type="button" data-action="switch-view" data-view="menu">
            <i class="fa-solid fa-mug-hot" aria-hidden="true"></i>${escapeHtml(t("cart.viewMenu"))}
          </button>
        </article>`;
    }

    const quickLink = (tab, icon, titleKey, descKey) => `
      <button class="member-quick-link" type="button" data-action="account-tab" data-tab="${tab}">
        <i class="${icon}" aria-hidden="true"></i>
        <span><strong>${escapeHtml(t(titleKey))}</strong><small>${escapeHtml(t(descKey))}</small></span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </button>`;

    return `
      <div class="member-summary">
        ${spotlight}
        <aside class="member-aside">
          <section class="member-quick">
            <h3>${escapeHtml(t("account.quickTitle"))}</h3>
            <div class="member-quick-list">
              <button class="member-quick-link" type="button" data-action="switch-view" data-view="menu">
                <i class="fa-solid fa-mug-hot" aria-hidden="true"></i>
                <span><strong>${escapeHtml(t("account.quickMenu"))}</strong><small>${escapeHtml(t("account.quickMenuDesc"))}</small></span>
                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
              ${quickLink("favorites", "fa-regular fa-heart", "account.quickFavs", "account.quickFavsDesc")}
              ${quickLink("profile", "fa-solid fa-id-card", "account.quickProfile", "account.quickProfileDesc")}
            </div>
          </section>
          <section class="member-quick member-quick-note">
            <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            <div>
              <h3>${escapeHtml(t("account.localNoteTitle"))}</h3>
              <p>${escapeHtml(t("account.localNote"))}</p>
            </div>
          </section>
        </aside>
      </div>`;
  }

  function renderAccountOrders(orders) {
    if (!orders.length) {
      return `<section class="member-block">${memberEmpty("fa-solid fa-receipt", "account.ordersEmpty", "account.ordersEmptyDesc", "cart.viewMenu")}</section>`;
    }

    return `
      <section class="member-block">
        <header class="member-block-head">
          <div>
            <p class="member-block-kicker">${escapeHtml(t("account.ordersKicker"))}</p>
            <h2>${escapeHtml(t("account.ordersTitle"))}</h2>
          </div>
          <span class="member-block-count">${orders.length === 1 ? escapeHtml(t("account.itemsOne")) : escapeHtml(t("account.items", { n: orders.length }))}</span>
        </header>
        <ol class="order-timeline">${orders.map(orderStop).join("")}</ol>
      </section>`;
  }

  function renderAccountFavorites(favorites) {
    if (!favorites.length) {
      return `<section class="member-block">${memberEmpty("fa-regular fa-heart", "account.favoritesEmpty", "account.favoritesEmptyDesc", "favorites.viewMenu")}</section>`;
    }

    return `
      <section class="member-block">
        <header class="member-block-head">
          <div>
            <p class="member-block-kicker">${escapeHtml(t("account.favKicker"))}</p>
            <h2>${escapeHtml(t("account.favoritesTitle"))}</h2>
          </div>
          <span class="member-block-count">${favorites.length}</span>
        </header>
        <ul class="member-fav-grid">${favorites.map(memberFavRow).join("")}</ul>
      </section>`;
  }

  function renderAccountProfile(user, orders) {
    const row = (labelKey, value) => `
      <div class="profile-sheet-row">
        <dt>${escapeHtml(t(labelKey))}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>`;

    return `
      <section class="profile-sheet">
        <header class="profile-sheet-head">
          <div>
            <p class="member-block-kicker">${escapeHtml(t("account.profileTitle"))}</p>
            <h2>${escapeHtml(user.name)}</h2>
          </div>
          <span class="member-local-badge"><i class="fa-solid fa-lock" aria-hidden="true"></i>${escapeHtml(t("account.localBadge"))}</span>
        </header>
        <dl class="profile-sheet-list">
          ${row("account.sheetName", user.name)}
          ${row("account.sheetEmail", user.email)}
          ${row("account.sheetPhone", user.phone || t("account.noPhone"))}
          ${row("account.sheetOrders", String(orders.length))}
          ${row("account.sheetSince", formatDate(user.createdAt, false))}
          ${row("account.sheetSession", t("account.sheetSessionValue"))}
          ${row("account.sheetStorage", t("account.sheetStorageValue"))}
        </dl>
        <footer class="profile-sheet-foot">
          <p class="profile-sheet-note">${escapeHtml(t("account.profileNote"))}</p>
          <button class="btn btn-secondary" type="button" data-action="logout">
            <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>${escapeHtml(t("account.logout"))}
          </button>
        </footer>
      </section>`;
  }

  function renderAccountTab(tab, orders, favorites, user) {
    if (tab === "orders") return renderAccountOrders(orders);
    if (tab === "favorites") return renderAccountFavorites(favorites);
    if (tab === "profile") return renderAccountProfile(user, orders);
    return renderAccountSummary(orders, favorites);
  }

  function renderAccount() {
    const wrap = $("#accountContent");
    if (!wrap) return;
    const user = currentUser();

    if (!user) {
      state.accountTab = "summary";
      wrap.innerHTML = `
        <div class="member-invite">
          <div class="member-invite-copy">
            <p class="member-kicker"><i class="fa-solid fa-mug-hot" aria-hidden="true"></i>${escapeHtml(t("account.kicker"))}</p>
            <h2>${escapeHtml(t("account.guestTitle"))}</h2>
            <p>${escapeHtml(t("account.guestDesc"))}</p>
            <div class="member-invite-actions">
              <button class="btn btn-primary btn-lg" type="button" data-action="open-auth" data-mode="login">
                <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>${escapeHtml(t("account.loginBtn"))}
              </button>
              <button class="btn btn-secondary btn-lg" type="button" data-action="open-auth" data-mode="register">
                <i class="fa-solid fa-user-plus" aria-hidden="true"></i>${escapeHtml(t("account.registerBtn"))}
              </button>
            </div>
          </div>
          <div class="member-invite-steps">
            <p class="member-invite-steps-title">${escapeHtml(t("account.guestStepsTitle"))}</p>
            <ol>
              <li><b>01</b><p>${escapeHtml(t("account.guestStep1"))}</p></li>
              <li><b>02</b><p>${escapeHtml(t("account.guestStep2"))}</p></li>
              <li><b>03</b><p>${escapeHtml(t("account.guestStep3"))}</p></li>
            </ol>
          </div>
        </div>`;
      return;
    }

    const orders = getOrdersForUser(user.id);
    const favorites = Array.from(state.favorites).map(getProduct).filter(Boolean);
    const spent = orders.reduce((sum, order) => sum + Number(order.totals ? order.totals.total : 0), 0);
    const tab = ["summary", "orders", "favorites", "profile"].includes(state.accountTab) ? state.accountTab : "summary";
    state.accountTab = tab;

    const tabs = [
      { id: "summary", label: "account.tabSummary", icon: "fa-solid fa-gauge-high" },
      { id: "orders", label: "account.tabOrders", icon: "fa-solid fa-receipt" },
      { id: "favorites", label: "account.tabFavorites", icon: "fa-regular fa-heart" },
      { id: "profile", label: "account.tabProfile", icon: "fa-solid fa-id-card" }
    ];

    wrap.innerHTML = `
      <div class="member-hub">
        <header class="member-pass">
          <div class="member-pass-top">
            <div class="member-avatar" aria-hidden="true">
              <span>${escapeHtml(getInitials(user.name))}</span>
              <i class="fa-solid fa-seedling"></i>
            </div>
            <div class="member-id">
              <p class="member-kicker"><i class="fa-solid fa-mug-hot" aria-hidden="true"></i><span>${escapeHtml(t("account.kicker"))} ·</span><span class="member-code">${escapeHtml(memberCode(user))}</span></p>
              <h2>${escapeHtml(user.name)}</h2>
              <p class="member-contact">
                <span><i class="fa-regular fa-envelope" aria-hidden="true"></i>${escapeHtml(user.email)}</span>
                <span><i class="fa-solid fa-phone" aria-hidden="true"></i>${escapeHtml(user.phone || t("account.noPhone"))}</span>
              </p>
            </div>
            <div class="member-pass-actions">
              <button class="btn btn-secondary btn-sm" type="button" data-action="logout">
                <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>${escapeHtml(t("account.logout"))}
              </button>
            </div>
          </div>
          <div class="member-strip">
            <div class="member-metric"><span>${escapeHtml(t("account.statsOrders"))}</span><strong>${orders.length}</strong></div>
            <div class="member-metric"><span>${escapeHtml(t("account.statsSpent"))}</span><strong>${formatHNL(spent)}</strong></div>
            <div class="member-metric"><span>${escapeHtml(t("account.statsFavorites"))}</span><strong>${favorites.length}</strong></div>
            <div class="member-metric"><span>${escapeHtml(t("account.memberSinceLabel"))}</span><strong>${escapeHtml(formatDate(user.createdAt, false))}</strong></div>
          </div>
        </header>

        <div class="member-nav">
          <div class="member-tabs" role="tablist" aria-label="${escapeHtml(t("account.tabsLabel"))}">
            ${tabs.map((item) => `
              <button class="member-tab" type="button" role="tab" id="memberTab-${item.id}" aria-controls="memberPanel" aria-selected="${tab === item.id}" tabindex="${tab === item.id ? "0" : "-1"}" data-action="account-tab" data-tab="${item.id}">
                <i class="${item.icon}" aria-hidden="true"></i><span>${escapeHtml(t(item.label))}</span>
              </button>`).join("")}
          </div>
          <span class="member-storage-tag"><i class="fa-solid fa-lock" aria-hidden="true"></i>${escapeHtml(t("account.localBadge"))}</span>
        </div>

        <div class="member-panel" id="memberPanel" role="tabpanel" tabindex="0" aria-labelledby="memberTab-${tab}">
          ${renderAccountTab(tab, orders, favorites, user)}
        </div>
      </div>`;
  }

  function setAccountTab(tab, focusTab) {
    state.accountTab = ["summary", "orders", "favorites", "profile"].includes(tab) ? tab : "summary";
    if (state.view === "account") renderAccount();
    if (focusTab) {
      const next = document.querySelector(`.member-tab[data-tab="${state.accountTab}"]`);
      if (next) next.focus();
    }
  }

  /* ==========================================================================
     16. Checkout
     ========================================================================== */

  function nextOrderId() {
    const year = new Date().getFullYear();
    let sequence = readJSON(STORAGE.sequence, { year, n: 0 });
    if (!sequence || sequence.year !== year) sequence = { year, n: 0 };
    sequence.n = (parseInt(sequence.n, 10) || 0) + 1;
    writeJSON(STORAGE.sequence, sequence);
    return "CCP-" + year + "-" + String(sequence.n).padStart(4, "0");
  }

  function saveOrder(order) {
    const stored = readJSON(STORAGE.orders, []);
    const list = Array.isArray(stored) ? stored : [];
    list.unshift(order);
    if (list.length > 200) list.length = 200;
    return writeJSON(STORAGE.orders, list);
  }

  function getOrderById(orderId) {
    const stored = readJSON(STORAGE.orders, []);
    const list = Array.isArray(stored) ? stored : [];
    return list.find((order) => order && order.id === orderId) || null;
  }

  function prefillCheckout() {
    const user = currentUser();
    if (!user) return;
    const name = $("#chkName");
    const phone = $("#chkPhone");
    const email = $("#chkEmail");
    const address = $("#chkAddress");
    const schedule = $("#chkSchedule");
    const notes = $("#chkNotes");

    if (name) name.value = user.name || "";
    if (phone) phone.value = user.phone || "";
    if (email) email.value = user.email || "";
    if (address) address.value = state.prefs.address || "";
    if (schedule) schedule.value = state.prefs.schedule || "1";
    if (notes) notes.value = "";
  }

  function syncDeliveryUI() {
    const delivery = DELIVERY[state.delivery] ? state.delivery : "unah";
    state.delivery = delivery;

    $$('input[name="deliveryOption"]').forEach((input) => {
      input.checked = input.value === delivery;
    });

    $$("#deliveryOptions .option-card").forEach((card) => {
      const input = card.querySelector("input");
      card.classList.toggle("selected", Boolean(input && input.checked));
    });

    const addressGroup = $("#addressGroup");
    if (addressGroup) addressGroup.hidden = !DELIVERY[delivery].requiresAddress;

    const cartSelect = $("#cartDelivery");
    if (cartSelect) cartSelect.value = delivery;
  }

  function updatePaymentUI() {
    const selected = document.querySelector('input[name="paymentOption"]:checked');
    const method = selected ? selected.value : "cash";

    $$("#paymentOptions .option-card").forEach((card) => {
      const input = card.querySelector("input");
      card.classList.toggle("selected", Boolean(input && input.checked));
    });

    const cardFields = $("#cardFields");
    if (cardFields) cardFields.hidden = method !== "card";
  }

  function renderCheckoutStep() {
    $$("[data-checkout-step]").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.checkoutStep) === state.checkoutStep);
    });

    $$("#checkoutSteps li").forEach((item) => {
      const step = Number(item.dataset.step);
      item.classList.toggle("active", step === state.checkoutStep);
      item.classList.toggle("completed", step < state.checkoutStep);
    });

    const back = $("#checkoutBack");
    const next = $("#checkoutNext");
    const confirm = $("#checkoutConfirm");
    if (back) back.hidden = state.checkoutStep === 1;
    if (next) next.hidden = state.checkoutStep === 3;
    if (confirm) confirm.hidden = state.checkoutStep !== 3;

    if (state.checkoutStep === 2) syncDeliveryUI();
    if (state.checkoutStep === 3) updatePaymentUI();

    const main = $(".checkout-main");
    if (main) main.scrollTop = 0;
  }

  function renderCheckoutSummary() {
    const container = $("#checkoutSummaryItems");
    if (!container) return;
    const totals = cartTotals();

    container.innerHTML = totals.items
      .map(
        (item) => `
        <div class="summary-item">
          <img src="${escapeHtml(item.product.image)}" alt="${escapeHtml(item.name)}" width="42" height="42" loading="lazy">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${item.qty} × ${formatHNL(item.unitPrice)}</small>
          </div>
          <span>${formatHNL(item.lineTotal)}</span>
        </div>`
      )
      .join("");

    const subtotal = $("#checkoutSubtotal");
    const discountLine = $("#checkoutDiscountLine");
    const discount = $("#checkoutDiscount");
    const deliveryFee = $("#checkoutDeliveryFee");
    const total = $("#checkoutTotal");

    if (subtotal) subtotal.textContent = formatHNL(totals.subtotal);
    if (discountLine) discountLine.hidden = totals.discount <= 0;
    if (discount) discount.textContent = "− " + formatHNL(totals.discount);
    if (deliveryFee) deliveryFee.textContent = totals.deliveryFee === 0 ? t("delivery.free") : formatHNL(totals.deliveryFee);
    if (total) total.textContent = formatHNL(totals.total);
  }

  function openCheckout() {
    if (!currentUser()) {
      state.pendingCheckout = true;
      openAuth("login", "checkout");
      toast(t("toast.loginToCheckout"), "info");
      return;
    }

    if (!state.cart.length) {
      toast(t("toast.emptyCart"), "error");
      return;
    }

    closeCart();
    prefillCheckout();

    state.checkoutStep = 1;
    const success = $("#checkoutSuccess");
    const form = $("#checkoutForm");
    const steps = $("#checkoutSteps");
    if (success) success.hidden = true;
    if (form) form.hidden = false;
    if (steps) steps.hidden = false;

    const terms = $("#chkTerms");
    if (terms) terms.checked = false;

    const cashOption = document.querySelector('input[name="paymentOption"][value="cash"]');
    if (cashOption) cashOption.checked = true;

    ["cardNumber", "cardName", "cardExpiry", "cardCvv"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });

    clearFormErrors(form);
    syncDeliveryUI();
    updatePaymentUI();
    renderCheckoutStep();
    renderCheckoutSummary();
    openOverlay("checkoutModal");
  }

  function clearCheckoutErrors(step) {
    const panel = document.querySelector(`[data-checkout-step="${step}"]`);
    if (!panel) return;
    panel.querySelectorAll(".field-error").forEach((element) => {
      element.hidden = true;
      element.textContent = "";
    });
    panel.querySelectorAll("input, select, textarea").forEach((input) => {
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
    });
  }

  function validateCheckoutStep(step) {
    clearCheckoutErrors(step);
    let valid = true;

    if (step === 1) {
      const name = ($("#chkName").value || "").trim();
      const phone = ($("#chkPhone").value || "").trim();
      const email = ($("#chkEmail").value || "").trim();

      if (name.length < 3) {
        setFieldError("chkName", "chkNameError", t("checkout.invalidName"));
        valid = false;
      }
      if (!isValidPhone(phone)) {
        setFieldError("chkPhone", "chkPhoneError", t("checkout.invalidPhone"));
        valid = false;
      }
      if (!isValidEmail(email)) {
        setFieldError("chkEmail", "chkEmailError", t("checkout.invalidEmail"));
        valid = false;
      }
    }

    if (step === 2) {
      const selected = document.querySelector('input[name="deliveryOption"]:checked');
      if (selected) state.delivery = selected.value;
      const address = ($("#chkAddress").value || "").trim();

      if (DELIVERY[state.delivery] && DELIVERY[state.delivery].requiresAddress && address.length < 8) {
        setFieldError("chkAddress", "chkAddressError", t("checkout.invalidAddress"));
        valid = false;
      }
    }

    if (step === 3) {
      const payment = document.querySelector('input[name="paymentOption"]:checked');
      const method = payment ? payment.value : "cash";

      if (method === "card") {
        const number = ($("#cardNumber").value || "").replace(/\D/g, "");
        const holder = ($("#cardName").value || "").trim();
        const expiry = ($("#cardExpiry").value || "").trim();
        const cvv = ($("#cardCvv").value || "").replace(/\D/g, "");

        if (holder.length < 3) {
          setFieldError("cardName", "cardNameError", t("checkout.invalidCardName"));
          valid = false;
        }
        if (!luhn(number)) {
          setFieldError("cardNumber", "cardNumberError", t("checkout.invalidCard"));
          valid = false;
        }
        if (!isValidExpiry(expiry)) {
          setFieldError("cardExpiry", "cardExpiryError", t("checkout.invalidExpiry"));
          valid = false;
        }
        if (!/^\d{3,4}$/.test(cvv)) {
          setFieldError("cardCvv", "cardCvvError", t("checkout.invalidCvv"));
          valid = false;
        }
      }

      const terms = $("#chkTerms");
      if (!terms || !terms.checked) {
        setFieldError("chkTerms", "chkTermsError", t("checkout.termsRequired"));
        valid = false;
      }
    }

    if (!valid) {
      const firstInvalid = document.querySelector(".checkout-step-panel.active .invalid");
      if (firstInvalid) {
        try {
          firstInvalid.focus();
        } catch (error) {
          /* Sin acción. */
        }
      }
    }

    return valid;
  }

  function checkoutNext() {
    if (!validateCheckoutStep(state.checkoutStep)) return;
    if (state.checkoutStep < 3) {
      state.checkoutStep += 1;
      renderCheckoutStep();
    }
  }

  function checkoutBack() {
    if (state.checkoutStep > 1) {
      state.checkoutStep -= 1;
      renderCheckoutStep();
    }
  }

  function readCheckoutData() {
    const selectedPayment = document.querySelector('input[name="paymentOption"]:checked');
    const cardNumber = ($("#cardNumber").value || "").replace(/\D/g, "");
    return {
      name: ($("#chkName").value || "").trim(),
      phone: ($("#chkPhone").value || "").trim(),
      email: ($("#chkEmail").value || "").trim().toLowerCase(),
      address: ($("#chkAddress").value || "").trim(),
      notes: ($("#chkNotes").value || "").trim(),
      scheduleId: $("#chkSchedule").value || "1",
      deliveryId: state.delivery,
      paymentMethod: selectedPayment ? selectedPayment.value : "cash",
      cardLast4: selectedPayment && selectedPayment.value === "card" ? cardNumber.slice(-4) : ""
    };
  }

  function placeOrder(event) {
    event.preventDefault();
    if (state.checkoutStep !== 3) return;
    if (!validateCheckoutStep(3)) return;

    const totals = cartTotals();
    if (!totals.items.length) {
      toast(t("toast.emptyCart"), "error");
      return;
    }

    const data = readCheckoutData();
    const order = {
      id: nextOrderId(),
      userId: currentUser() ? currentUser().id : null,
      createdAt: new Date().toISOString(),
      status: "recibido",
      customer: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        notes: data.notes
      },
      deliveryId: data.deliveryId,
      scheduleId: data.scheduleId,
      paymentMethod: data.paymentMethod,
      cardLast4: data.cardLast4,
      items: totals.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        modifiers: modifiersToArray(item.modifiers)
      })),
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        couponCode: state.coupon ? state.coupon.code : ""
      }
    };

    const button = $("#checkoutConfirm");
    setLoading(button, true);

    const saved = saveOrder(order);
    if (!saved) {
      setLoading(button, false);
      toast(t("toast.orderError"), "error");
      return;
    }

    state.lastOrder = order;
    state.prefs.address = data.address;
    state.prefs.schedule = data.scheduleId;
    savePreferences();

    state.cart = [];
    state.coupon = null;
    writeJSON(STORAGE.cart, []);
    try {
      localStorage.removeItem(STORAGE.coupon);
    } catch (error) {
      /* Sin acción. */
    }
    updateBadges();
    renderCart();

    showGlobalLoader("Preparing your handcrafted order voucher...", 800).then(() => {
      setLoading(button, false);
      showCheckoutSuccess(order);
      toast(t("toast.orderPlaced", { id: order.id }), "success");
    });
  }

  function showCheckoutSuccess(order) {
    const form = $("#checkoutForm");
    const steps = $("#checkoutSteps");
    const success = $("#checkoutSuccess");
    if (form) form.hidden = true;
    if (steps) steps.hidden = true;
    if (!success) return;

    success.hidden = false;
    const id = $("#successOrderId");
    const eta = $("#successEta");
    if (id) id.textContent = "#" + order.id;
    if (eta) {
      const delivery = DELIVERY[order.deliveryId] || DELIVERY.unah;
      eta.textContent = t(delivery.etaKey);
    }

    const whatsapp = $("#successWhatsapp");
    if (whatsapp) whatsapp.hidden = !STORE_WHATSAPP;
  }

  function reorder(orderId) {
    const order = getOrderById(orderId);
    if (!order || !Array.isArray(order.items)) return;

    let added = 0;
    order.items.forEach((item) => {
      const product = getProduct(item.productId);
      if (!product) return;
      addToCart(product.id, modifiersFromArray(item.modifiers), item.qty, { silent: true, open: false });
      added += Number(item.qty) || 0;
    });

    if (!added) {
      toast(t("toast.emptyCart"), "error");
      return;
    }

    updateBadges();
    renderCart();
    toast(t("toast.reorder"), "success");
    openCart();
  }

  /* ==========================================================================
     17. Comprobante y WhatsApp
     ========================================================================== */

  function buildWhatsAppMessage(order) {
    if (!order || !order.customer || !order.totals || !Array.isArray(order.items)) return "";
    const delivery = DELIVERY[order.deliveryId] || DELIVERY.unah;
    const lines = [];
    lines.push("*PEDIDO — CATRACHO COCONUT PONCHE*");
    lines.push("Ref: *#" + order.id + "*");
    lines.push("Cliente: *" + order.customer.name + "*");
    lines.push("Teléfono: " + order.customer.phone);
    lines.push("Entrega: *" + t(delivery.labelKey) + "*");
    lines.push("Horario: " + t("delivery.schedule" + (order.scheduleId || "1")));
    if (order.customer.address) lines.push("Dirección: " + order.customer.address);
    if (order.customer.notes) lines.push("Indicaciones: " + order.customer.notes);
    lines.push("");
    lines.push("*DETALLE DEL PEDIDO:*");
    order.items.forEach((item) => {
      lines.push("• " + item.qty + "× " + orderItemName(item) + " — " + formatHNL(item.lineTotal));
      if (item.modifiers && item.modifiers.length) {
        lines.push("   (" + item.modifiers.map(modifierLabel).join(", ") + ")");
      }
    });
    lines.push("");
    lines.push("Subtotal: " + formatHNL(order.totals.subtotal));
    if (order.totals.discount > 0) {
      lines.push("Descuento: −" + formatHNL(order.totals.discount));
    }
    lines.push("Entrega: " + (order.totals.deliveryFee === 0 ? t("delivery.free") : formatHNL(order.totals.deliveryFee)));
    lines.push("*TOTAL: " + formatHNL(order.totals.total) + "*");
    lines.push("");
    lines.push("_Pedido registrado localmente · UNAH Comayagua._");
    return lines.join("\n");
  }

  function sendOrderWhatsApp(order) {
    if (!order) return;
    if (!STORE_WHATSAPP) {
      toast(t("toast.whatsappMissing"), "error");
      return;
    }
    const message = buildWhatsAppMessage(order);
    if (!message) return;
    const phone = STORE_WHATSAPP.replace(/\D/g, "");
    const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderTicket(order) {
    const container = $("#ticketContent");
    if (!container || !order || !order.customer || !order.totals) return;

    const delivery = DELIVERY[order.deliveryId] || DELIVERY.unah;
    const paymentLabel =
      t("checkout." + (order.paymentMethod || "cash")) + (order.cardLast4 ? " · •••• " + order.cardLast4 : "");

    const items = (order.items || [])
      .map((item) => {
        const modifiers = item.modifiers && item.modifiers.length
          ? `<small>${escapeHtml(item.modifiers.map(modifierLabel).join(" · "))}</small>`
          : "";
        return `
          <div class="ticket-item">
            <div><strong>${item.qty}× ${escapeHtml(orderItemName(item))}</strong>${modifiers}</div>
            <strong>${formatHNL(item.lineTotal)}</strong>
          </div>`;
      })
      .join("");

    const discountRow =
      order.totals.discount > 0
        ? `<div class="ticket-total-row"><span>${escapeHtml(t("ticket.discount"))}${order.totals.couponCode ? " (" + escapeHtml(order.totals.couponCode) + ")" : ""}</span><strong>− ${formatHNL(order.totals.discount)}</strong></div>`
        : "";

    container.innerHTML = `
      <div class="ticket-brand">
        <img src="assets/img/logo-160.webp" alt="Catracho Ponche" width="48" height="48">
        <h3>Catracho Coconut Ponche</h3>
        <p>UNAH Comayagua · Inglés Técnico · 2026</p>
      </div>
      <div class="ticket-meta">
        <div><span>${escapeHtml(t("ticket.ref"))}</span><strong>#${escapeHtml(order.id)}</strong></div>
        <div><span>${escapeHtml(t("ticket.date"))}</span><strong>${escapeHtml(formatDate(order.createdAt, true))}</strong></div>
        <div><span>${escapeHtml(t("ticket.customer"))}</span><strong>${escapeHtml(order.customer.name)}</strong></div>
        <div><span>${escapeHtml(t("ticket.phone"))}</span><strong>${escapeHtml(order.customer.phone)}</strong></div>
        <div><span>${escapeHtml(t("ticket.delivery"))}</span><strong>${escapeHtml(t(delivery.labelKey))}</strong></div>
        <div><span>${escapeHtml(t("ticket.schedule"))}</span><strong>${escapeHtml(t("delivery.schedule" + (order.scheduleId || "1")))}</strong></div>
        <div><span>${escapeHtml(t("ticket.payment"))}</span><strong>${escapeHtml(paymentLabel)}</strong></div>
        ${order.customer.address ? `<div><span>${escapeHtml(t("delivery.addressLabel"))}</span><strong>${escapeHtml(order.customer.address)}</strong></div>` : ""}
        ${order.customer.notes ? `<div><span>${escapeHtml(t("ticket.notes"))}</span><strong>${escapeHtml(order.customer.notes)}</strong></div>` : ""}
      </div>
      <div class="ticket-items">${items}</div>
      <div class="ticket-totals">
        <div class="ticket-total-row"><span>${escapeHtml(t("ticket.subtotal"))}</span><strong>${formatHNL(order.totals.subtotal)}</strong></div>
        ${discountRow}
        <div class="ticket-total-row"><span>${escapeHtml(t("ticket.deliveryFee"))}</span><strong>${order.totals.deliveryFee === 0 ? escapeHtml(t("delivery.free")) : formatHNL(order.totals.deliveryFee)}</strong></div>
        <div class="ticket-total-row grand"><span>${escapeHtml(t("ticket.total"))}</span><strong>${formatHNL(order.totals.total)}</strong></div>
      </div>
      <p class="ticket-note">${escapeHtml(t("ticket.note"))}</p>
      <p class="ticket-thanks">${escapeHtml(t("ticket.thanks"))}</p>`;

    state.lastOrder = order;
    const whatsapp = $("#ticketWhatsapp");
    if (whatsapp) whatsapp.hidden = !STORE_WHATSAPP;
  }

  function openOrderTicket(orderId) {
    const order = getOrderById(orderId);
    if (!order) {
      toast(t("toast.orderError"), "error");
      return;
    }
    renderTicket(order);
    openOverlay("ticketModal");
  }

  function openLastOrderTicket() {
    if (!state.lastOrder) {
      toast(t("toast.emptyCart"), "error");
      return;
    }
    renderTicket(state.lastOrder);
    openOverlay("ticketModal");
  }

  function isValidExpiry(value) {
    const match = String(value || "").match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    const expiry = new Date(year, month, 1);
    return expiry > new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function luhn(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let alternate = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = Number(digits[i]);
      if (alternate) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  }

  /* ==========================================================================
     18. Calculadora de eventos
     ========================================================================== */

  function updateEventBatch(value) {
    const servings = clamp(parseInt(value, 10) || 1, 1, 500);

    const milk = (servings * 0.25).toFixed(1);
    const coconut = Math.round(servings * 35);
    const panela = Math.round(servings * 30);
    const cinnamon = Math.max(1, Math.round(servings * 0.4));
    const apples = servings;
    const cacao = Math.round(servings * 15);
    const packs = Math.floor(servings / 6);
    const units = servings % 6;
    const estimate = packs * 290 + units * 65;

    const set = (id, text) => {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    };

    set("evMilk", milk + " L");
    set("evCoconut", coconut + " g");
    set("evPanela", panela + " g");
    set("evCinnamon", cinnamon + " " + (currentLang === "es" ? "varas" : "sticks"));
    set("evApples", apples + " " + (currentLang === "es" ? "rodajas" : "slices"));
    set("evCacao", cacao + " g");
    set("evPacks", String(packs));
    set("evUnits", String(units));
    set("evTotal", formatHNL(estimate));

    const slider = $("#eventSlider");
    const input = $("#eventInput");
    if (slider && Number(slider.value) !== servings) slider.value = String(servings);
    if (input && Number(input.value) !== servings) input.value = String(servings);
  }

  function addEventBatch() {
    const input = $("#eventInput");
    const servings = clamp(parseInt(input ? input.value : 24, 10) || 1, 1, 500);
    const packs = Math.floor(servings / 6);
    const units = servings % 6;

    if (packs > 0) addToCart("pack-familiar", {}, packs, { silent: true, open: false });
    if (units > 0) addToCart("ponche-clasico", {}, units, { silent: true, open: false });

    updateBadges();
    renderCart();
    toast(t("toast.batchAdded", { n: servings }), "success");
    openCart();
  }

  /* ==========================================================================
     19. Búsqueda, filtros y helpers de UI
     ========================================================================== */

  function setQuery(value) {
    state.query = value || "";
    const form = $("#headerSearch");
    if (form) form.classList.toggle("has-value", Boolean(state.query.trim()));

    if (state.query.trim() && state.view !== "menu") {
      switchView("menu", { keepSearch: true });
    }
    renderProducts();
  }

  function clearSearch() {
    const input = $("#searchInput");
    if (input) input.value = "";
    setQuery("");
    if (input) input.focus();
  }

  function setFilter(category) {
    state.filter = category;
    renderProducts();
  }

  function clearFilters() {
    state.filter = "all";
    state.query = "";
    state.sort = "featured";
    const input = $("#searchInput");
    const form = $("#headerSearch");
    const sort = $("#sortSelect");
    if (input) input.value = "";
    if (form) form.classList.remove("has-value");
    if (sort) sort.value = "featured";
    renderProducts();
  }

  function refreshFavoriteButtons() {
    $$(".fav-btn[data-id]").forEach((button) => {
      const active = state.favorites.has(button.dataset.id);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? t("catalog.favoriteRemove") : t("catalog.favoriteAdd"));
      const icon = button.querySelector("i");
      if (icon) icon.className = (active ? "fa-solid" : "fa-regular") + " fa-heart";
    });
  }

  function formatCardNumber(input) {
    const digits = input.value.replace(/\D/g, "").slice(0, 19);
    input.value = digits.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatCardExpiry(input) {
    const digits = input.value.replace(/\D/g, "").slice(0, 4);
    input.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  }

  function formatCardCvv(input) {
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const overlays = $$(".overlay.active");
    if (!overlays.length) return;
    const overlay = overlays[overlays.length - 1];
    const focusables = $$(FOCUSABLE, overlay).filter(
      (element) => !element.disabled && element.getClientRects().length > 0
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!overlay.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ==========================================================================
     20. Delegación de eventos
     ========================================================================== */

  function handleDocumentClick(event) {
    const overlay = event.target.closest(".overlay");
    if (overlay && event.target === overlay && overlay.dataset.close) {
      closeByName(overlay.dataset.close);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) {
      if (!event.target.closest(".primary-nav") && !event.target.closest(".menu-toggle")) {
        closeNav();
      }
      if (!event.target.closest(".site-header")) {
        closeSearch();
      }
      return;
    }

    const action = actionElement.dataset.action;
    const id = actionElement.dataset.id;
    const key = actionElement.dataset.key;

    if (actionElement.tagName === "A" && actionElement.getAttribute("href")) {
      event.preventDefault();
    }

    switch (action) {
      case "switch-view":
        if ($("#cartDrawer").classList.contains("active")) closeCart();
        switchView(actionElement.dataset.view);
        break;

      case "scroll-catalog":
        scrollToCatalog();
        break;

      case "open-cart":
        openCart();
        break;

      case "close-cart":
        closeCart();
        break;

      case "open-account":
        openAccount();
        break;

      case "account-tab":
        setAccountTab(actionElement.dataset.tab, true);
        break;

      case "open-auth":
        openAuth(actionElement.dataset.mode || "login", state.view === "account" ? "account" : null);
        break;

      case "close-auth":
        closeOverlay("authModal");
        break;

      case "auth-tab":
        setAuthMode(actionElement.dataset.mode);
        break;

      case "demo-fill": {
        setAuthMode("login");
        const email = $("#loginEmail");
        const password = $("#loginPassword");
        if (email) email.value = DEMO_USER.email;
        if (password) password.value = DEMO_USER.password;
        const form = $("#loginForm");
        if (form && typeof form.requestSubmit === "function") form.requestSubmit();
        break;
      }

      case "toggle-password": {
        const input = document.getElementById(actionElement.dataset.target);
        if (!input) break;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        const icon = actionElement.querySelector("i");
        if (icon) icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
        actionElement.setAttribute("aria-label", t(show ? "auth.hidePassword" : "auth.showPassword"));
        break;
      }

      case "toggle-language":
        if (typeof toggleLanguage === "function") toggleLanguage();
        break;

      case "open-favorites":
        openFavorites();
        break;

      case "close-favorites":
        closeOverlay("favoritesModal");
        break;

      case "favorites-view-menu":
        closeOverlay("favoritesModal");
        switchView("menu");
        break;

      case "filter":
        setFilter(actionElement.dataset.cat || "all");
        break;

      case "clear-filters":
        clearFilters();
        break;

      case "toggle-favorite":
        toggleFavorite(id);
        break;

      case "add-to-cart":
        addToCart(id, {}, 1, { silent: false, open: true });
        break;

      case "customize":
        openProduct(id);
        break;

      case "close-product":
        closeOverlay("productModal");
        break;

      case "pm-modifier":
        toggleProductModifier(actionElement.dataset.mod);
        break;

      case "pm-qty":
        changeProductQty(actionElement.dataset.delta);
        break;

      case "pm-add":
        addProductModalToCart();
        break;

      case "favorite-add":
        favoriteAdd(id);
        break;

      case "cart-qty":
        changeCartQty(key, actionElement.dataset.delta);
        break;

      case "cart-remove":
        removeCartItem(key);
        break;

      case "apply-coupon":
        applyCoupon();
        break;

      case "remove-coupon":
        removeCoupon();
        break;

      case "checkout":
        openCheckout();
        break;

      case "close-checkout":
        closeOverlay("checkoutModal");
        break;

      case "checkout-next":
        checkoutNext();
        break;

      case "checkout-back":
        checkoutBack();
        break;

      case "success-ticket":
        closeOverlay("checkoutModal");
        window.setTimeout(openLastOrderTicket, 150);
        break;

      case "success-continue":
        closeOverlay("checkoutModal");
        switchView("menu");
        break;

      case "success-whatsapp":
        sendOrderWhatsApp(state.lastOrder);
        break;

      case "order-ticket":
        openOrderTicket(actionElement.dataset.order);
        break;

      case "reorder":
        reorder(actionElement.dataset.order);
        break;

      case "logout":
        logout();
        break;

      case "open-lightbox":
        openLightbox(actionElement.dataset.src, actionElement.dataset.titleKey, actionElement.dataset.descKey);
        break;

      case "close-lightbox":
        closeOverlay("lightboxModal");
        break;

      case "print-ticket":
        window.print();
        break;

      case "close-ticket":
        closeOverlay("ticketModal");
        break;

      case "ticket-whatsapp":
        sendOrderWhatsApp(state.lastOrder);
        break;

      case "add-batch":
        addEventBatch();
        break;

      case "toggle-nav":
        toggleNav();
        break;

      case "toggle-search":
        toggleSearch();
        break;

      case "clear-search":
        clearSearch();
        break;

      default:
        break;
    }
  }

  /* ==========================================================================
     21. Eventos globales
     ========================================================================== */

  function clearFieldError(target) {
    if (!target || !target.classList || !target.classList.contains("invalid")) return;
    target.classList.remove("invalid");
    target.removeAttribute("aria-invalid");
    const error = document.getElementById(target.id + "Error");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  }

  function handleFormSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === "headerSearch") {
      event.preventDefault();
      const input = $("#searchInput");
      setQuery(input ? input.value : "");
      if (window.matchMedia && window.matchMedia("(max-width: 1120px)").matches) closeSearch();
      return;
    }

    if (form.id === "loginForm") {
      handleLogin(event).catch(() => showFormAlert("loginAlert", t("toast.storageError")));
      return;
    }

    if (form.id === "registerForm") {
      handleRegister(event).catch(() => showFormAlert("registerAlert", t("toast.storageError")));
      return;
    }

    if (form.id === "checkoutForm") {
      placeOrder(event);
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "searchInput") {
      setQuery(target.value);
      return;
    }

    if (target.id === "eventInput" || target.id === "eventSlider") {
      updateEventBatch(target.value);
      return;
    }

    if (target.id === "cardNumber") {
      formatCardNumber(target);
      clearFieldError(target);
      return;
    }

    if (target.id === "cardExpiry") {
      formatCardExpiry(target);
      clearFieldError(target);
      return;
    }

    if (target.id === "cardCvv") {
      formatCardCvv(target);
      clearFieldError(target);
      return;
    }

    clearFieldError(target);
  }

  function handleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "sortSelect") {
      state.sort = target.value;
      renderProducts();
      return;
    }

    if (target.id === "cartDelivery" || target.name === "deliveryOption") {
      state.delivery = DELIVERY[target.value] ? target.value : "unah";
      savePreferences();
      syncDeliveryUI();
      renderCartTotals();
      renderCheckoutSummary();
      return;
    }

    if (target.name === "paymentOption") {
      updatePaymentUI();
      return;
    }

    if (target.id === "eventInput" || target.id === "eventSlider") {
      updateEventBatch(target.value);
      return;
    }

    if (target.type === "checkbox") clearFieldError(target);
  }

  function handleKeydown(event) {
    const activeOverlays = $$(".overlay.active");

    if (event.key === "Escape") {
      if (activeOverlays.length) {
        closeOverlay(activeOverlays[activeOverlays.length - 1].id);
        return;
      }
      const header = $("#siteHeader");
      if (header && (header.classList.contains("nav-open") || header.classList.contains("search-open"))) {
        closeNav();
        closeSearch();
        return;
      }
    }

    const memberTab = event.target && event.target.closest ? event.target.closest(".member-tab") : null;
    if (memberTab && ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const tabs = $$(".member-tab");
      if (!tabs.length) return;
      const index = tabs.indexOf(memberTab);
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else nextIndex = tabs.length - 1;
      const next = tabs[nextIndex];
      if (next) setAccountTab(next.dataset.tab, true);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
      event.preventDefault();
      const header = $("#siteHeader");
      const input = $("#searchInput");
      if (!header || !input) return;
      header.classList.add("search-open");
      input.focus();
      input.select();
      return;
    }

    if (event.key === "/" && !isTypingTarget(event.target) && !activeOverlays.length) {
      event.preventDefault();
      const header = $("#siteHeader");
      const input = $("#searchInput");
      if (header) header.classList.add("search-open");
      if (input) input.focus();
      return;
    }

    if (activeOverlays.length) trapFocus(event);
  }

  function handleScroll() {
    const header = $("#siteHeader");
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }

  function readHashView() {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    return VIEWS.includes(hash) ? hash : "menu";
  }

  function handlePopState() {
    switchView(readHashView(), { updateHash: false });
  }

  function handleStorage(event) {
    if (!event.key) return;

    if (event.key === STORAGE.cart) {
      loadCart();
      updateBadges();
      renderCart();
      return;
    }

    if (event.key === STORAGE.favorites) {
      loadFavorites();
      updateBadges();
      renderProducts();
      if ($("#favoritesModal").classList.contains("active")) renderFavoritesModal();
      if (state.view === "account") renderAccount();
      return;
    }

    if (event.key === STORAGE.session || event.key === STORAGE.users) {
      state.session = loadSession();
      updateAccountUI();
      renderCart();
      if (state.view === "account") renderAccount();
      return;
    }

    if (event.key === STORAGE.coupon) {
      state.coupon = normalizeCoupon(readJSON(STORAGE.coupon, null));
      renderCart();
      renderCheckoutSummary();
    }
  }

  function syncLanguageUI() {
    if (typeof applyTranslations === "function") applyTranslations();
    updateAccountUI();
    renderProducts();
    renderCart();
    if (state.view === "account") renderAccount();
    if ($("#favoritesModal").classList.contains("active")) renderFavoritesModal();
    if ($("#checkoutModal").classList.contains("active")) renderCheckoutSummary();
    if (state.productModal && $("#productModal").classList.contains("active")) renderProductModal();
    if (state.lastOrder && $("#ticketModal").classList.contains("active")) renderTicket(state.lastOrder);
    updateEventBatch($("#eventInput") ? $("#eventInput").value : 24);
    syncDeliveryUI();
    updatePaymentUI();
  }

  function bindEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("submit", handleFormSubmit);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("storeLangChange", syncLanguageUI);
  }

  /* ==========================================================================
     22. Inicialización
     ========================================================================== */

  function init() {
    migrateLegacyData();
    loadPreferences();
    loadFavorites();
    loadCart();
    state.session = loadSession();
    state.coupon = normalizeCoupon(readJSON(STORAGE.coupon, null));

    if (typeof applyTranslations === "function") applyTranslations();

    bindEvents();
    initReveal();

    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    $$("#successWhatsapp, #ticketWhatsapp").forEach((button) => {
      button.hidden = !STORE_WHATSAPP;
    });

    updateAccountUI();
    updateBadges();
    renderProducts();
    renderCart();
    syncDeliveryUI();
    updatePaymentUI();
    updateEventBatch($("#eventInput") ? $("#eventInput").value : 24);

    switchView(readHashView(), { updateHash: false, keepScroll: true });
    handleScroll();

    ensureDemoUser().catch(() => {
      /* La cuenta demo es opcional; el registro manual sigue disponible. */
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
