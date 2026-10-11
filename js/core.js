/* SmartDrinkers — noyau : état, stockage, traduction, hasard, sons, navigation */
(function () {
  const SD = window.SD;

  /* ---------- Stockage (toujours protégé) ---------- */
  SD.load = (k, def) => { try { const v = localStorage.getItem("sd_" + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
  SD.save = (k, v) => { try { localStorage.setItem("sd_" + k, JSON.stringify(v)); } catch (e) { /* ignoré */ } };

  const navLang = (navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en";
  SD.state = {
    lang: SD.load("lang", navLang),
    theme: SD.load("theme", "dark"),
    sound: SD.load("sound", true),
    players: SD.load("players", []),
    sips: SD.load("sips", { E: 3, M: 2, H: 1 }),
    turn: 0
  };
  SD.persist = () => {
    const s = SD.state;
    SD.save("lang", s.lang); SD.save("theme", s.theme); SD.save("sound", s.sound);
    SD.save("players", s.players); SD.save("sips", s.sips);
  };

  /* ---------- Traduction ---------- */
  SD.t = (key, vars) => {
    let s = (SD.STR[SD.state.lang] && SD.STR[SD.state.lang][key]) ?? SD.STR.fr[key] ?? key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  };
  SD.sipWord = n => SD.t(n > 1 ? "sips" : "sip");
  SD.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  SD.nl2p = s => SD.esc(s).split("\n\n").map(p => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");

  /* ---------- Hasard ---------- */
  // Générateur déterministe (même code = mêmes tirages sur tous les téléphones)
  SD.hashStr = str => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  SD.rng = seed => {
    let a = typeof seed === "number" ? seed >>> 0 : SD.hashStr(String(seed));
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  SD.rand = Math.random;
  SD.pick = (arr, r = SD.rand) => arr[Math.floor(r() * arr.length)];
  SD.shuffle = (arr, r = SD.rand) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I/L
  SD.newSeed = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
  SD.SEED_RE = new RegExp("^[" + ALPHA + "]{5}$");

  /* ---------- Sons & vibrations ---------- */
  let actx = null;
  SD.beep = (freq = 660, dur = 0.08, type = "sine", vol = 0.15) => {
    if (!SD.state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur + 0.02);
    } catch (e) { /* pas de son */ }
  };
  SD.boomSound = () => {
    if (!SD.state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const len = actx.sampleRate * 0.9, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.9;
      src.buffer = buf; src.connect(f).connect(g).connect(actx.destination); src.start();
    } catch (e) { /* pas de son */ }
  };
  SD.buzz = pattern => { if (SD.state.sound && navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {} };
  SD.good = () => { SD.beep(660, .09); setTimeout(() => SD.beep(990, .12), 90); SD.buzz(30); };
  SD.bad = () => { SD.beep(220, .25, "sawtooth", .12); SD.buzz([80, 60, 120]); };

  /* ---------- Écran toujours allumé pendant une partie ---------- */
  let lock = null;
  SD.keepAwake = async on => {
    try {
      if (on && "wakeLock" in navigator && !lock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => (lock = null)); }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && SD.awakeWanted) SD.keepAwake(true); });

  /* ---------- Navigation ---------- */
  SD.app = () => document.getElementById("app");
  SD.cleanup = null; // fonction appelée en quittant un écran (timers, caméra…)
  SD.render = (html, opts = {}) => {
    if (typeof SD.cleanup === "function") { try { SD.cleanup(); } catch (e) {} }
    SD.cleanup = null;
    const app = SD.app();
    app.className = "screen " + (opts.cls || "");
    document.body.dataset.screen = opts.cls || "";
    SD.screenId = (SD.screenId || 0) + 1;
    // Même écran redessiné (réglage modifié, mise à jour d'un autre joueur…) : on garde la position de défilement
    const key = opts.key || SD._pendingKey || null; SD._pendingKey = null;
    const keep = key && key === SD._lastKey, y = window.scrollY;
    SD._lastKey = key;
    app.innerHTML = html;
    window.scrollTo(0, keep ? y : 0);
    SD.awakeWanted = !!opts.awake; SD.keepAwake(!!opts.awake);
    return app;
  };
  // Lie les data-act="nom" aux fonctions fournies
  SD.bind = (root, handlers) => {
    root.querySelectorAll("[data-act]").forEach(el => {
      const fn = handlers[el.dataset.act];
      if (fn) el.addEventListener("click", ev => { if (el.dataset.suppress) { delete el.dataset.suppress; return; } fn(ev, el); });
    });
  };

  // Minuterie annulée automatiquement si l'écran a changé entre-temps
  SD.later = (fn, ms) => { const id = SD.screenId; return setTimeout(() => { if (SD.screenId === id) fn(); }, ms); };

  /* Appui long */
  SD.longPress = (el, fn, ms = 480) => {
    let t = null, sx = 0, sy = 0;
    const clear = () => { clearTimeout(t); t = null; };
    el.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; clear(); t = setTimeout(() => { t = null; el.dataset.suppress = "1"; SD.buzz(20); fn(); }, ms); });
    el.addEventListener("pointermove", e => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clear(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(n => el.addEventListener(n, clear));
    el.addEventListener("contextmenu", e => e.preventDefault());
  };

  /* Fenêtre modale */
  SD.modal = (title, bodyHtml) => {
    SD.closeModal();
    const m = document.createElement("div");
    m.className = "modal"; m.id = "modal";
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${SD.esc(title)}">
      <div class="sheet-head"><h2>${SD.esc(title)}</h2><button class="icon-btn" data-close aria-label="${SD.t("close")}">${SD.icon("x")}</button></div>
      <div class="sheet-body">${bodyHtml}</div></div>`;
    m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) SD.closeModal(); });
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add("open"));
  };
  SD.closeModal = () => { const m = document.getElementById("modal"); if (m) m.remove(); };

  SD.toast = msg => {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(SD._tt); SD._tt = setTimeout(() => el.classList.remove("show"), 2600);
  };

  /* Thème */
  SD.applyTheme = () => {
    document.documentElement.dataset.theme = SD.state.theme;
    document.documentElement.lang = SD.state.lang;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = SD.state.theme === "light" ? "#f3f0f8" : "#17131f";
  };

  /* Joueurs : tour par tour */
  SD.players = () => SD.state.players;
  SD.current = (offset = 0) => { const p = SD.state.players; return p.length ? p[(SD.state.turn + offset) % p.length] : "?"; };
  SD.nextTurn = () => { if (SD.state.players.length) SD.state.turn = (SD.state.turn + 1) % SD.state.players.length; };

  /* Petites icônes SVG (trait) */
  const P = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2"/><circle cx="12" cy="12" r="7"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    phones: '<rect x="3" y="4.5" width="8.5" height="16" rx="2"/><rect x="12.5" y="3" width="8.5" height="16" rx="2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.5"/><path d="M12 16.8h.01"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3h-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    glass: '<path d="M6 3h12l-1.6 16.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z"/><path d="M6.6 8.5h10.8"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    cam: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>'
  };
  SD.icon = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
})();
