/* SmartDrinkers — accueil, réglages, démarrage */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc;

  const topBar = () => `
    <header class="topbar">
      <div class="brand" aria-label="SmartDrinkers"><span class="b1">Smart</span><span class="b2">Drinkers</span></div>
      <div class="top-actions">
        <button class="icon-btn" data-act="shareApp" aria-label="${t("shareApp")}">${SD.icon("share")}</button>
        <button class="pill" data-act="lang" aria-label="${t("language")}">${SD.state.lang === "fr" ? "FR" : "EN"}</button>
        <button class="icon-btn" data-act="settings" aria-label="${t("settings")}">${SD.icon("gear")}</button>
      </div>
    </header>`;

  const gameCard = g => `
    <div class="gcard" data-game="${g.id}">
      <button class="gmain" data-act="play" data-id="${g.id}">
        <span class="gname">${t("g_" + g.id)}</span>
        <span class="gdesc">${t("g_" + g.id + "_d")}</span>
        <span class="badge ${g.mode}">${SD.icon(g.mode === "one" ? "phone" : "phones")}${g.mode === "one" ? t("onePhone") : t("eachPhone")}</span>
      </button>
      <button class="icon-btn ghelp" data-act="rules" data-id="${g.id}" aria-label="${t("rules")} · ${t("g_" + g.id)}">${SD.icon("help")}</button>
    </div>`;

  SD.home = () => {
    const p = SD.players();
    const one = SD.GAMES.filter(g => g.mode === "one"), each = SD.GAMES.filter(g => g.mode === "each");
    const app = SD.render(`
      ${topBar()}
      <main class="home">
        <p class="tagline">${t("tagline")}</p>

        <section class="block" aria-labelledby="hp">
          <h2 id="hp" class="section-title">${t("players")} <span class="count">${p.length}</span></h2>
          <div class="chips">
            ${p.map((n, i) => `<span class="pchip">${esc(n)}<button data-act="rm" data-i="${i}" aria-label="× ${esc(n)}">×</button></span>`).join("")}
          </div>
          <form class="add-form" id="addForm">
            <input id="pname" maxlength="18" placeholder="${t("playerPh")}" aria-label="${t("addPlayer")}" autocomplete="off" enterkeyhint="done">
            <button class="btn primary" type="submit">${SD.icon("plus")}<span>${t("add")}</span></button>
          </form>
          ${p.length < 2 ? `<p class="hint">${t("noPlayers")}</p>` : ""}
        </section>

        <section class="block">
          <h2 class="section-title">${SD.icon("phone")} ${t("onePhone")}</h2>
          <div class="game-grid">${one.map(gameCard).join("")}</div>
        </section>
        <section class="block">
          <h2 class="section-title">${SD.icon("phones")} ${t("eachPhone")}</h2>
          <div class="multi-row">
            <button class="btn primary xl" data-act="create">${SD.icon("plus")} ${t("createGame")}</button>
            <button class="btn ghost xl" data-act="join">${SD.icon("qr")} ${t("join")}</button>
          </div>
          <div class="game-grid">${each.map(gameCard).join("")}</div>
          <p class="hint">${t("holdHint")}</p>
        </section>

        <div class="quick">
          <button class="btn ghost xl" data-act="free">${SD.icon("glass")} ${t("freeQuiz")}</button>
          <button class="btn primary xl" data-act="shareApp">${SD.icon("share")} ${t("shareApp")}</button>
        </div>
        <p class="footnote">${t("moderation")}</p>
      </main>`, { cls: "homescreen" });

    app.querySelector("#addForm").addEventListener("submit", e => {
      e.preventDefault();
      const inp = app.querySelector("#pname"), v = inp.value.trim();
      if (!v) return;
      SD.state.players.push(v); SD.persist(); SD.home();
      setTimeout(() => { const i = document.getElementById("pname"); if (i) i.focus(); }, 30);
    });
    app.querySelectorAll(".gmain").forEach(el => SD.longPress(el, () => SD.showRules(el.dataset.id)));
    SD.bind(app, {
      lang: () => { SD.state.lang = SD.state.lang === "fr" ? "en" : "fr"; SD.persist(); SD.applyTheme(); SD.home(); },
      settings: () => SD.settings(),
      rm: (e, el) => { SD.state.players.splice(+el.dataset.i, 1); SD.state.turn = 0; SD.persist(); SD.home(); },
      rules: (e, el) => SD.showRules(el.dataset.id),
      play: (e, el) => {
        const g = SD.GAMES.find(x => x.id === el.dataset.id);
        if (g.mode === "one" && SD.players().length < g.min) { SD.toast(t("needPlayers", { n: g.min })); return; }
        SD.state.turn = SD.state.turn % Math.max(1, SD.players().length);
        g.start();
      },
      join: () => SD.joinScreen(),
      free: freeQuiz,
      shareApp: () => SD.shareApp(),
      create: () => SD.createChooser()
    });
  };

  /* ---------- Créer une partie « chacun son téléphone » ---------- */
  SD.createChooser = () => {
    const each = SD.GAMES.filter(g => g.mode === "each");
    SD.modal(t("createGame"), `
      <p class="hint">${t("createHelp")}</p>
      <div class="choose-list">
        ${each.map(g => `<button class="choose" data-g="${g.id}"><span class="gname">${t("g_" + g.id)}</span><span class="gdesc">${t("g_" + g.id + "_d")}</span></button>`).join("")}
      </div>`);
    const m = document.getElementById("modal");
    if (!m) return;
    m.querySelectorAll("[data-g]").forEach(b => b.addEventListener("click", () => {
      SD.closeModal();
      SD.GAMES.find(g => g.id === b.dataset.g).start();
    }));
  };

  /* ---------- Partager l'appli (QR code vers le site) ---------- */
  const PUBLIC_URL = "https://emilezola0.github.io/SmartDrinkers/";
  SD.appUrl = () => {
    const local = !/^https:$/.test(location.protocol) || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
    return local ? PUBLIC_URL : location.origin + location.pathname.replace(/index\.html$/, "");
  };
  SD.shareApp = () => {
    const url = SD.appUrl();
    const canShare = typeof navigator.share === "function";
    SD.modal(t("shareApp"), `
      <div class="share-app">
        <div class="qr-box">${SD.qrSvg(url)}</div>
        <p class="hint">${t("shareAppHelp")}</p>
        <p class="mono app-url" id="appUrl">${esc(url)}</p>
        <div class="row-btns">
          <button class="btn ghost" data-share="copy">${t("copyLink")}</button>
          ${canShare ? `<button class="btn primary" data-share="native">${SD.icon("share")} ${t("sendLink")}</button>` : ""}
        </div>
      </div>`);
    const m = document.getElementById("modal");
    if (!m) return;
    const selectUrl = () => { const r = document.createRange(); r.selectNodeContents(m.querySelector("#appUrl")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
    m.querySelector('[data-share="copy"]').addEventListener("click", e => {
      const b = e.currentTarget;
      try { navigator.clipboard.writeText(url).then(() => { b.textContent = t("copied"); }, selectUrl); } catch (err) { selectUrl(); }
    });
    const nat = m.querySelector('[data-share="native"]');
    if (nat) nat.addEventListener("click", () => { navigator.share({ title: "SmartDrinkers", text: t("tagline"), url }).catch(() => {}); });
  };

  const freeQuiz = () => {
    const p = SD.players();
    if (!p.length) return SD.runQuiz([t("you")], {});
    const app = SD.render(`
      <header class="game-top"><button class="icon-btn" data-act="home" aria-label="${t("back")}">${SD.icon("back")}</button>
        <span class="eyebrow">${t("freeQuiz")}</span><span></span></header>
      <div class="game-body">
        <h1 class="display">${t("whoQuiz")}</h1>
        <div class="chips pickable">${p.map((n, i) => `<button class="pchip big" data-act="who" data-i="${i}">${esc(n)}</button>`).join("")}</div>
      </div>`, { cls: "game" });
    SD.bind(app, { home: () => SD.home(), who: (e, el) => SD.runQuiz([p[+el.dataset.i]], { onContinue: freeQuiz }) });
  };

  /* ---------- Réglages ---------- */
  SD.settings = () => {
    const s = SD.state, b = SD.bank, off = new Set(SD.themesOff());
    const cnt = d => b.questions.filter(q => q.diff === d).length;
    const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${v === cur ? "on" : ""}" data-act="${act}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;
    const app = SD.render(`
      <header class="game-top"><button class="icon-btn" data-act="home" aria-label="${t("back")}">${SD.icon("back")}</button>
        <span class="eyebrow">${t("settings")}</span><span></span></header>
      <main class="settings">
        <div class="field"><span class="label">${t("language")}</span>${seg("lang", [["fr", "Français"], ["en", "English"]], s.lang)}</div>
        <div class="field"><span class="label">${t("theme")}</span>${seg("theme", [["dark", t("dark")], ["light", t("light")]], s.theme)}</div>
        <div class="field"><span class="label">${t("sound")}</span>${seg("sound", [["1", t("on")], ["0", t("off")]], s.sound ? "1" : "0")}</div>

        <h2 class="section-title">${t("sipsPerDiff")}</h2>
        <div class="sips-grid">
          ${["E", "M", "H"].map(d => `<div class="sip-row ${SD.diffClass(d)}"><span>${SD.diffName(d)}</span>
            <div class="stepper"><button class="icon-btn" data-act="sip" data-d="${d}" data-v="-1" aria-label="−">−</button><output>${s.sips[d]}</output><button class="icon-btn" data-act="sip" data-d="${d}" data-v="1" aria-label="+">+</button></div></div>`).join("")}
        </div>

        <h2 class="section-title">${t("questionBank")}</h2>
        <p class="lead small tabnum">${t("bankCount", { n: b.questions.length, e: cnt("E"), m: cnt("M"), h: cnt("H") })}</p>
        <div class="field"><span class="label">${t("themes")}</span>
          <div class="row-btns"><button class="btn small ghost" data-act="tall">${t("all")}</button><button class="btn small ghost" data-act="tnone">${t("none")}</button></div>
          <div class="chips">${b.themes.map((th, i) => `<button class="pchip toggle ${off.has(th) ? "" : "on"}" data-act="th" data-i="${i}" aria-pressed="${!off.has(th)}">${esc(SD.themeText(th))}</button>`).join("")}</div>
        </div>
        <div class="field"><span class="label">${t("importFile")}</span><input type="file" id="fileIn" accept=".tsv,.csv,.txt,text/tab-separated-values,text/csv"></div>
        <div class="field"><span class="label">${t("importUrl")}</span>
          <form class="join-form" id="urlForm"><input id="urlIn" type="url" placeholder="${t("urlPh")}" autocomplete="off"><button class="btn primary" type="submit">${t("load")}</button></form></div>
        ${SD.isCustomBank ? `<button class="btn ghost" data-act="reset">${t("resetBank")}</button>` : ""}
        <p class="hint">${t("qLangNote")}</p>
        <p class="footnote">SmartDrinkers · v1.4</p>
      </main>`, { cls: "settingscreen" });

    const useText = text => {
      const nb = SD.buildBank(text);
      if (!nb) { SD.toast(t("importErr")); return; }
      SD.save("bankText", text); SD.save("used", []); SD.save("themesOff", []);
      SD.loadBank(); SD.toast(t("imported", { n: SD.bank.questions.length })); SD.settings();
    };
    app.querySelector("#fileIn").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => useText(rd.result); rd.readAsText(f, "utf-8");
    });
    app.querySelector("#urlForm").addEventListener("submit", async e => {
      e.preventDefault();
      let u = app.querySelector("#urlIn").value.trim(); if (!u) return;
      // Liens Google Sheets : on demande la version TSV
      const m = u.match(/docs\.google\.com\/spreadsheets\/d\/(e\/)?([^/]+)/);
      if (m && !/output=(tsv|csv)|format=(tsv|csv)/.test(u)) {
        const gid = (u.match(/gid=(\d+)/) || [])[1];
        u = m[1] ? `https://docs.google.com/spreadsheets/d/e/${m[2]}/pub?output=tsv${gid ? "&gid=" + gid : ""}`
                 : `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=tsv${gid ? "&gid=" + gid : ""}`;
      }
      try { const r = await fetch(u); if (!r.ok) throw 0; useText(await r.text()); }
      catch (err) { SD.toast(t("urlErr")); }
    });
    const setOff = arr => { SD.save("themesOff", arr); SD.settings(); };
    SD.bind(app, {
      home: () => SD.home(),
      lang: (e, el) => { s.lang = el.dataset.v; SD.persist(); SD.applyTheme(); SD.settings(); },
      theme: (e, el) => { s.theme = el.dataset.v; SD.persist(); SD.applyTheme(); SD.settings(); },
      sound: (e, el) => { s.sound = el.dataset.v === "1"; SD.persist(); SD.settings(); SD.beep(); },
      sip: (e, el) => { const d = el.dataset.d; s.sips[d] = Math.min(10, Math.max(1, s.sips[d] + +el.dataset.v)); SD.persist(); SD.settings(); },
      th: (e, el) => { const th = b.themes[+el.dataset.i]; off.has(th) ? off.delete(th) : off.add(th); setOff([...off]); },
      tall: () => setOff([]),
      tnone: () => setOff(b.themes.slice()),
      reset: () => { SD.save("bankText", null); SD.save("used", []); SD.save("themesOff", []); SD.loadBank(); SD.settings(); }
    });
  };

  /* ---------- Démarrage ---------- */
  SD.boot = () => {
    SD.loadBank();
    SD.applyTheme();
    const hash = location.hash || "";
    const info = SD.parseCode(hash);
    if (info) { history.replaceState(null, "", location.pathname + location.search); SD.openCode(info, false); }
    else SD.home();
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  };
  window.addEventListener("hashchange", () => { const info = SD.parseCode(location.hash); if (info) SD.openCode(info, false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") SD.closeModal(); });
  SD.boot();
})();
