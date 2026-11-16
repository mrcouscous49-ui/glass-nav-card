/*
 * Glass Nav Card — barre de navigation flottante en verre pour Home Assistant.
 * https://github.com/mrcouscous49-ui/glass-nav-card
 */

const VERSION = "0.1.0";
const DEFAULT_ACCENT = [212, 232, 138];

const STRINGS = {
  fr: {
    color: "Couleur d'accent",
    blur: "Flou de l'arrière-plan",
    opacity: "Opacité du verre",
    title: "Titre du menu",
    nav_placeholder: "Barre de navigation Glass : elle s'affiche sur le bord de l'écran (cette case n'est visible qu'en mode édition).",
    nav_icon: "Icône du menu",
    edit: "Modifier le tableau de bord",
    show_edit: "Bouton « Modifier le tableau de bord »",
    show_views: "Onglets de ce tableau de bord",
    show_panels: "Pages de la barre latérale de HA",
    hide_sidebar: "Masquer la barre latérale de HA",
    hide_header: "Masquer le bandeau d'onglets de HA",
    position: "Côté de l'écran",
    left: "Gauche",
    right: "Droite",
    mobile_bottom: "Barre en bas de l'écran sur téléphone",
  },
  en: {
    color: "Accent color",
    blur: "Background blur",
    opacity: "Glass opacity",
    title: "Menu title",
    nav_placeholder: "Glass navigation bar: it shows on the edge of the screen (this box is only visible in edit mode).",
    nav_icon: "Menu icon",
    edit: "Edit dashboard",
    show_edit: "\"Edit dashboard\" button",
    show_views: "This dashboard's views",
    show_panels: "Home Assistant sidebar pages",
    hide_sidebar: "Hide the Home Assistant sidebar",
    hide_header: "Hide the Home Assistant view tabs",
    position: "Screen side",
    left: "Left",
    right: "Right",
    mobile_bottom: "Bottom bar on phones",
  },
};

const tr = (hass, key) => {
  const lang = (hass?.language || navigator.language || "en").slice(0, 2);
  return (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key] || key;
};

const bool = (name) => ({ name, selector: { boolean: {} } });
const pairOf = (...items) => ({ type: "grid", name: "", schema: items });

const GLASS_CARD_CSS = `
  :host {
    display: block;
    height: 100%;
    --gc-backdrop: blur(15px) saturate(1.3);
    --gc-opacity: 0.1;
  }
  ha-card {
    position: relative;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    isolation: isolate;
    color: #fff;
    background: rgba(255, 255, 255, var(--gc-opacity)) !important;
    backdrop-filter: var(--gc-backdrop);
    -webkit-backdrop-filter: var(--gc-backdrop);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }
  [hidden] {
    display: none !important;
  }
`;

const applyGlass = (el, cfg) => {
  const blur = Number(cfg.blur ?? 15);
  el.style.setProperty("--gc-backdrop", blur > 0 ? `blur(${blur}px) saturate(1.3)` : "none");
  el.style.setProperty("--gc-opacity", String(Number(cfg.opacity ?? 10) / 100));
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fireEvent = (node, type, detail) =>
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));


/* ---------- Barre de navigation flottante ---------- */

// Icônes des pages intégrées de HA (le panneau ne fournit pas toujours la sienne).
const PANEL_ICONS = {
  lovelace: "mdi:view-dashboard",
  map: "mdi:map",
  energy: "mdi:lightning-bolt",
  logbook: "mdi:format-list-bulleted-type",
  history: "mdi:chart-box",
  "media-browser": "mdi:play-box-multiple",
  todo: "mdi:clipboard-list",
  calendar: "mdi:calendar",
  config: "mdi:cog",
  "developer-tools": "mdi:hammer",
};
const PANEL_SKIP = ["profile", "notifications", "developer-tools"];

// Styles injectés dans HA pour masquer sa barre latérale et son bandeau d'onglets
// (mêmes sélecteurs que kiosk-mode ; retirés dès qu'on quitte le tableau de bord).
const HIDE_SIDEBAR_MAIN_CSS = `
  :host { --ha-sidebar-width: 0px !important; --mdc-drawer-width: 0px !important; }
  partial-panel-resolver { --mdc-top-app-bar-width: 100% !important; }
  ha-drawer > ha-sidebar { display: none !important; }
`;
const HIDE_SIDEBAR_DRAWER_CSS = `wa-drawer, .sidebar-shell, aside.mdc-drawer { display: none !important; }`;
const HIDE_HEADER_CSS = `
  .header { display: none !important; }
  #view {
    min-height: 100vh !important;
    padding-top: calc(env(safe-area-inset-top, 0px) + var(--view-container-padding-top, 0px)) !important;
  }
`;

const NAV_STYLE = `
  :host {
    --nav-accent: 212, 232, 138;
    --gc-backdrop: blur(20px) saturate(1.3);
    --gc-opacity: 0.12;
    position: fixed;
    z-index: 5;
    top: 50%;
    left: calc(16px + env(safe-area-inset-left, 0px));
    transform: translateY(-50%);
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, sans-serif));
    color: #fff;
  }
  :host([side="right"]) { left: auto; right: calc(16px + env(safe-area-inset-right, 0px)); }
  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 56px;
    max-height: calc(100vh - 32px);
    overflow: hidden auto;
    scrollbar-width: none;
    padding: 10px 8px;
    box-sizing: border-box;
    border-radius: 28px;
    background: rgba(255, 255, 255, var(--gc-opacity));
    backdrop-filter: var(--gc-backdrop);
    -webkit-backdrop-filter: var(--gc-backdrop);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  nav::-webkit-scrollbar { display: none; }
  :host([open]) nav { width: 220px; }
  @media (hover: hover) {
    nav:hover { width: 220px; }
  }
  .it {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 40px;
    flex: none;
    padding: 0 8px;
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.25s, color 0.25s;
  }
  .it ha-icon { --mdc-icon-size: 22px; flex: none; }
  .it span { font-size: 14px; font-weight: 500; opacity: 0; transition: opacity 0.2s; }
  :host([open]) .it span { opacity: 1; }
  @media (hover: hover) {
    nav:hover .it span { opacity: 1; }
    .it:hover { background: rgba(255, 255, 255, 0.12); }
  }
  .it.active {
    background: rgb(var(--nav-accent));
    color: #1c1f14;
    box-shadow: 0 0 18px rgba(var(--nav-accent), 0.45);
  }
  .it.head { color: #fff; }
  .it.head span { font-size: 16px; font-weight: 700; }
  .sep { height: 1px; flex: none; margin: 4px 6px; background: rgba(255, 255, 255, 0.18); }

  /* Téléphone : barre horizontale en bas de l'écran. */
  @media (max-width: 600px) {
    :host([mobile="bottom"]) {
      top: auto;
      left: 50%;
      right: auto;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      max-width: calc(100vw - 24px);
    }
    :host([mobile="bottom"]) nav,
    :host([mobile="bottom"][open]) nav {
      flex-direction: row;
      width: auto;
      max-width: 100%;
      max-height: none;
      overflow: auto hidden;
      padding: 8px;
    }
    :host([mobile="bottom"]) .it { width: 40px; padding: 0; justify-content: center; }
    :host([mobile="bottom"]) .it span,
    :host([mobile="bottom"]) .it.head,
    :host([mobile="bottom"]) .sep { display: none; }
  }
`;

const navigateTo = (path) => {
  if (/^https?:\/\//.test(path)) {
    window.open(path, "_blank", "noopener");
    return;
  }
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};

// Barre unique, posée sur <body> pour échapper aux grilles et transformations du tableau de bord.
// Elle reste en place quand on change de vue, et disparaît quand on quitte le tableau de bord.
const GlassNav = {
  host: null,
  owner: null,
  base: null,
  hidden: [],
  bypass: false,

  attach(card) {
    if (!this.host) {
      this.host = document.createElement("div");
      this.host.className = "glass-nav";
      const root = this.host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${NAV_STYLE}</style><nav></nav>`;
      this.nav = root.querySelector("nav");
      this._bind();
      document.body.append(this.host);
      window.addEventListener("location-changed", this._onLocation);
      window.addEventListener("popstate", this._onLocation);
    }
    this.owner = card;
    this.base = location.pathname.split("/")[1];
    this.render();
    this.applyHide();
  },

  // Une carte retirée de la page : on garde la barre tant qu'on reste sur le même tableau de bord.
  detach(card) {
    if (this.owner !== card) return;
    setTimeout(() => {
      if (this.owner === card && !card.isConnected && location.pathname.split("/")[1] !== this.base) {
        this.destroy();
      }
    }, 0);
  },

  destroy() {
    this.restore();
    this.host?.remove();
    window.removeEventListener("location-changed", this._onLocation);
    window.removeEventListener("popstate", this._onLocation);
    this.host = this.owner = this.base = null;
  },

  _onLocation: () => {
    const g = GlassNav;
    setTimeout(() => {
      if (!g.host) return;
      if (location.pathname.split("/")[1] !== g.base && !g.owner?.isConnected) {
        g.destroy();
        return;
      }
      g.render();
      g.applyHide();
    }, 0);
  },

  _bind() {
    let timer = null;
    let long = false;
    this.nav.addEventListener("pointerdown", (ev) => {
      if (!ev.target.closest(".head")) return;
      long = false;
      timer = setTimeout(() => {
        // Appui long sur l'en-tête : réafficher les barres de HA (pour modifier le tableau de bord).
        long = true;
        this.bypass = !this.bypass;
        this.applyHide();
      }, 700);
    });
    const cancel = () => clearTimeout(timer);
    this.nav.addEventListener("pointerup", cancel);
    this.nav.addEventListener("pointerleave", cancel);
    this.nav.addEventListener("click", (ev) => {
      const it = ev.target.closest(".it");
      if (!it) return;
      ev.preventDefault();
      if (it.classList.contains("edit")) {
        this.host.removeAttribute("open");
        this.startEdit();
        return;
      }
      if (it.classList.contains("head")) {
        if (!long) this.host.toggleAttribute("open");
        return;
      }
      this.host.removeAttribute("open");
      navigateTo(it.dataset.path);
    });
  },

  items() {
    const card = this.owner;
    const cfg = card?._config || {};
    if (Array.isArray(cfg.items) && cfg.items.length) return [cfg.items];
    const hass = card?._hass;
    const groups = [];
    if (cfg.show_views !== false) {
      const views = card._dashboard()?.config?.views || [];
      const list = views
        .filter((v) => v.visible !== false && !v.subview)
        .map((v, i) => ({
          name: v.title || v.path || String(i + 1),
          icon: v.icon || "mdi:view-dashboard-variant",
          path: `/${this.base}/${v.path ?? i}`,
        }));
      if (list.length) groups.push(list);
    }
    if (cfg.show_panels !== false && hass?.panels) {
      const list = Object.values(hass.panels)
        .filter((p) => (p.title || p.component_name === "lovelace") && !PANEL_SKIP.includes(p.url_path))
        .filter((p) => !(p.component_name === "config" && !hass.user?.is_admin))
        .map((p) => ({
          name: (p.title && hass.localize?.(`panel.${p.title}`)) || p.title || hass.localize?.("panel.states") || p.url_path,
          icon: p.icon || PANEL_ICONS[p.component_name] || PANEL_ICONS[p.url_path] || "mdi:apps",
          path: `/${p.url_path}`,
        }))
        .sort((a, b) => (a.path === "/config") - (b.path === "/config"));
      if (list.length) groups.push(list);
    }
    return groups;
  },

  render() {
    if (!this.host || !this.owner) return;
    const cfg = this.owner._config;
    this.host.setAttribute("side", cfg.position === "right" ? "right" : "left");
    this.host.setAttribute("mobile", cfg.mobile_bottom === false ? "side" : "bottom");
    applyGlass(this.host, { blur: 20, opacity: 12, ...cfg });
    const c = Array.isArray(cfg.color) ? cfg.color : [212, 232, 138];
    this.host.style.setProperty("--nav-accent", c.join(", "));

    const groups = this.items();
    const here = decodeURI(location.pathname);
    // Lien actif : celui dont le chemin correspond le mieux à la page affichée.
    let best = null;
    for (const it of groups.flat()) {
      const p = String(it.path || "").replace(/\/$/, "");
      if (p && (here === p || here.startsWith(`${p}/`)) && (!best || p.length > best.length)) best = p;
    }
    const views = this.owner._dashboard()?.config?.views || [];
    // Racine du tableau de bord (« /dashboard-maison ») = première vue.
    if (!best && here.split("/").length === 2 && views.length) best = `/${this.base}/${views[0].path ?? 0}`;

    const link = (it) => {
      const p = String(it.path || "").replace(/\/$/, "");
      return `<a class="it ${p === best ? "active" : ""}" href="${esc(it.path)}" data-path="${esc(it.path)}">
        <ha-icon icon="${esc(it.icon || "mdi:circle-medium")}"></ha-icon><span>${esc(it.name)}</span></a>`;
    };
    const head = `<a class="it head">
      <ha-icon icon="${esc(cfg.icon || "mdi:menu")}"></ha-icon><span>${esc(cfg.title || "Menu")}</span></a>`;
    const lovelace = this.owner._dashboard();
    const canEdit = cfg.show_edit !== false && this.owner._hass?.user?.is_admin && lovelace?.setEditMode;
    const edit = canEdit
      ? `<div class="sep"></div><a class="it edit"><ha-icon icon="mdi:pencil"></ha-icon><span>${esc(tr(this.owner._hass, "edit"))}</span></a>`
      : "";
    const html = head + groups.map((g) => `<div class="sep"></div>${g.map(link).join("")}`).join("") + edit;
    if (html !== this._html) this.nav.innerHTML = this._html = html;
  },

  // Masque la barre latérale et les onglets de HA (sauf en mode édition ou après un appui long).
  applyHide() {
    const cfg = this.owner?._config || {};
    const editing = new URLSearchParams(location.search).has("edit") || !!this.owner?._dashboard()?.editMode;
    const off = this.bypass || editing;
    this.restore();
    if (off) return;
    const add = (root, css) => {
      if (!root) return;
      const st = document.createElement("style");
      st.dataset.glassNav = "";
      st.textContent = css;
      root.append(st);
      this.hidden.push(st);
    };
    if (cfg.hide_sidebar !== false) {
      const main = document.querySelector("home-assistant")?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot;
      add(main, HIDE_SIDEBAR_MAIN_CSS);
      add(main?.querySelector("ha-drawer")?.shadowRoot, HIDE_SIDEBAR_DRAWER_CSS);
    }
    if (cfg.hide_header !== false) add(this.owner?._huiRoot()?.shadowRoot, HIDE_HEADER_CSS);
  },

  // Bouton crayon : barres HA réaffichées + mode édition ; on remasque à la sortie du mode édition.
  startEdit() {
    const lovelace = this.owner?._dashboard();
    if (!lovelace?.setEditMode) return;
    this.bypass = true;
    this.applyHide();
    lovelace.setEditMode(true);
    clearInterval(this._editTimer);
    this._editTimer = setInterval(() => {
      if (!this.host) return clearInterval(this._editTimer);
      if (!this.owner?._dashboard()?.editMode) {
        clearInterval(this._editTimer);
        this.bypass = false;
        this.applyHide();
      }
    }, 1000);
  },

  restore() {
    this.hidden.forEach((st) => st.remove());
    this.hidden = [];
  },
};

class GlassNavCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        :host(:not([edit])) { display: none; }
        ${GLASS_CARD_CSS}
        ha-card { height: auto; padding: 12px 16px; display: flex; align-items: center; gap: 12px; font-size: 14px; }
      </style>
      <ha-card><ha-icon icon="mdi:dock-left"></ha-icon><span></span></ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("glass-nav-card-editor");
  }

  static getStubConfig() {
    return { title: "Maison", icon: "mdi:home-assistant" };
  }

  setConfig(config) {
    this._config = { hide_sidebar: true, hide_header: true, show_views: true, show_panels: true, ...config };
    this._update();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._syncEdit();
    if (first || hass.panels !== this._panels) {
      this._panels = hass.panels;
      this._update();
    }
  }

  // Dans l'éditeur ou en mode édition, la carte s'affiche pour pouvoir être modifiée.
  set preview(v) {
    this._preview = v;
    this._update();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto" };
  }

  connectedCallback() {
    this._update();
  }

  disconnectedCallback() {
    GlassNav.detach(this);
  }

  // Mémorisé : la barre continue de s'en servir quand on change de vue (carte retirée de la page).
  _huiRoot() {
    let node = this;
    while (node) {
      node = node.getRootNode()?.host;
      if (node?.localName === "hui-root") return (this._root = node);
    }
    return this._root || null;
  }

  _dashboard() {
    return this._huiRoot()?.lovelace;
  }

  _syncEdit() {
    const editing = this._preview || new URLSearchParams(location.search).has("edit") || this._dashboard()?.editMode;
    this.toggleAttribute("edit", !!editing);
  }

  _update() {
    if (!this._config) return;
    this._syncEdit();
    this.shadowRoot.querySelector("span").textContent = tr(this._hass, "nav_placeholder");
    // Seule la carte posée dans le tableau de bord pilote la barre (pas l'aperçu de l'éditeur).
    if (this.isConnected && this._hass && !this._preview && this._huiRoot()) GlassNav.attach(this);
    else if (GlassNav.owner === this) GlassNav.render();
  }
}


/* ---------- Éditeur visuel ---------- */

class GlassBaseEditor extends HTMLElement {
  get _schema() {
    return [];
  }
  get _defaults() {
    return {};
  }
  // Conversion config → données du formulaire, et inversement.
  _toForm(config) {
    return config;
  }
  _fromForm(value) {
    return value;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this._ensureHaForm().then(() => this._render());
  }

  // ha-form n'est chargé par HA qu'à l'ouverture d'un éditeur natif : on force son chargement.
  async _ensureHaForm() {
    if (customElements.get("ha-form")) return;
    try {
      const helpers = await window.loadCardHelpers?.();
      const card = await helpers?.createCardElement({ type: "entities", entities: [] });
      await card?.constructor?.getConfigElement?.();
    } catch (e) {
      /* ignoré */
    }
  }

  _render() {
    if (!this._hass || !this._config || !customElements.get("ha-form")) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = this._fromForm({ ...ev.detail.value });
        for (const k of Object.keys(config)) {
          if (config[k] === "" || config[k] === null || config[k] === undefined) delete config[k];
        }
        // Couleur par défaut affichée dans le formulaire : on ne l'écrit pas dans la config
        // (sinon elle écraserait la couleur réelle des lumières).
        if (Array.isArray(config.color) && config.color.join() === DEFAULT_ACCENT.join()) {
          delete config.color;
        }
        this._config = config;
        this.dispatchEvent(
          new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = { ...this._defaults, ...this._toForm(this._config) };
    this._form.schema = this._schema;
    this._form.computeLabel = (s) => s.title || tr(this._hass, s.name);
  }
}


const NAV_SCHEMA = [
  pairOf({ name: "title", selector: { text: {} } }, { name: "nav_icon", selector: { icon: {} } }),
  pairOf(bool("show_views"), bool("show_panels")),
  pairOf(bool("hide_sidebar"), bool("hide_header")),
  bool("show_edit"),
  pairOf({ name: "position", selector: { select: { mode: "dropdown", options: ["left", "right"] } } }, bool("mobile_bottom")),
  { name: "color", selector: { color_rgb: {} } },
  pairOf(
    { name: "blur", selector: { number: { min: 0, max: 40, step: 1, mode: "slider", unit_of_measurement: "px" } } },
    { name: "opacity", selector: { number: { min: 0, max: 50, step: 1, mode: "slider", unit_of_measurement: "%" } } }
  ),
];

class GlassNavCardEditor extends GlassBaseEditor {
  get _schema() {
    // Libellés traduits pour la liste « Côté de l'écran ».
    const sch = JSON.parse(JSON.stringify(NAV_SCHEMA));
    sch[4].schema[0].selector.select.options = ["left", "right"].map((v) => ({ value: v, label: tr(this._hass, v) }));
    return sch;
  }
  get _defaults() {
    return { show_views: true, show_panels: true, hide_sidebar: true, hide_header: true, show_edit: true, position: "left", mobile_bottom: true, color: [212, 232, 138], blur: 20, opacity: 12 };
  }
  _toForm(config) {
    const { icon, ...rest } = config;
    return { ...rest, nav_icon: icon };
  }
  _fromForm(value) {
    const { nav_icon, ...rest } = value;
    const out = { ...rest, icon: nav_icon };
    if (Array.isArray(out.color) && out.color.join() === "212,232,138") delete out.color;
    return out;
  }
}

/* ---------- Enregistrement ---------- */

if (!customElements.get("glass-nav-card")) customElements.define("glass-nav-card", GlassNavCard);
if (!customElements.get("glass-nav-card-editor")) customElements.define("glass-nav-card-editor", GlassNavCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "glass-nav-card")) {
  window.customCards.push({
    type: "glass-nav-card",
    name: "Glass Nav Card",
    description: "Barre de navigation flottante en verre, qui se déplie au survol et remplace la barre latérale de HA.",
    preview: false,
    documentationURL: "https://github.com/mrcouscous49-ui/glass-nav-card",
  });
}

console.info(
  `%c GLASS-NAV %c v${VERSION} `,
  "color: #1c1f14; background: #d4e88a; font-weight: 700; border-radius: 4px 0 0 4px; padding: 2px 4px;",
  "color: #d4e88a; background: #1c1c1e; border-radius: 0 4px 4px 0; padding: 2px 4px;"
);
