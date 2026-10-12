/* SmartDrinkers — mode en ligne : salons hôte / joueurs via Firebase Realtime Database */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc;

  const CONFIG = {
    apiKey: "AIzaSyDaYXS1358SHcYCiaYHXzXZa2LKNSBOoYw",
    authDomain: "smartdrinkers.firebaseapp.com",
    databaseURL: "https://smartdrinkers-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "smartdrinkers",
    storageBucket: "smartdrinkers.firebasestorage.app",
    messagingSenderId: "370845271547",
    appId: "1:370845271547:web:e7fb34aeacdc2674b5f75e"
  };
  const ROOM_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  const O = SD.online = { ready: null, db: null, uid: null, room: null, games: {} };
  SD.ONLINE_GAMES = O.games;

  /* ---------- Connexion ---------- */
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  O.init = () => O.ready || (O.ready = (async () => {
    if (!window.firebase) for (const f of ["app", "auth", "database"]) await loadScript(`js/lib/firebase/firebase-${f}-compat.js`);
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);
    const auth = firebase.auth();
    let user = auth.currentUser || await new Promise(r => { const un = auth.onAuthStateChanged(u => { un(); r(u); }); });
    if (!user) user = (await auth.signInAnonymously()).user;
    O.uid = user.uid; O.db = firebase.database();
    O.offset = 0;
    O.db.ref(".info/serverTimeOffset").on("value", sn => { O.offset = sn.val() || 0; });
    return O;
  })().catch(e => { O.ready = null; console.error(e); throw e; }));
  const TS = () => firebase.database.ServerValue.TIMESTAMP;

  const busy = msg => SD.render(`<div class="center-stack"><div class="spinner" aria-hidden="true"></div><p class="lead">${esc(msg)}</p></div>`, { cls: "game" });
  const fail = e => { console.error(e); SD.toast(t("onlineErr")); SD.home(); };

  /* ---------- Accueil : section en ligne ---------- */
  O.homeHtml = () => {
    const last = SD.load("lastRoom", null);
    return `<section class="block online-block">
      <h2 class="section-title">${SD.icon("globe")} ${t("onlineTitle")} <span class="badge each">${t("onlineBadge")}</span></h2>
      ${navigator.onLine ? `
        ${last ? `<button class="btn ghost wide" data-act="onRejoin">${t("rejoinRoom", { c: esc(last) })}</button>` : ""}
        <div class="multi-row">
          <button class="btn primary xl" data-act="onCreate">${SD.icon("plus")} ${t("createRoom")}</button>
          <button class="btn ghost xl" data-act="join">${SD.icon("qr")} ${t("joinRoom")}</button>
        </div>
        <p class="hint">${t("onlineHint")}</p>` : `<p class="hint">${t("onlineOffline")}</p>`}
    </section>`;
  };
  O.homeHandlers = () => ({
    onCreate: () => O.createFlow(),
    onRejoin: () => O.joinFlow(SD.load("lastRoom", ""))
  });

  /* ---------- Prénom ---------- */
  const askName = (title, next) => {
    const def = SD.load("myName", "") || SD.players()[0] || "";
    const app = SD.render(`
      <header class="game-top"><button class="icon-btn" data-act="home" aria-label="${t("back")}">${SD.icon("back")}</button>
        <span class="eyebrow">${esc(title)}</span><span></span></header>
      <div class="game-body">
        <h1 class="display">${t("yourName")}</h1>
        <form class="join-form" id="nameForm">
          <input id="myName" maxlength="18" value="${esc(def)}" placeholder="${t("playerPh")}" autocomplete="off" enterkeyhint="go" aria-label="${t("yourName")}">
          <button class="btn primary" type="submit">${t("next")}</button>
        </form>
        ${SD.players().length ? `<div class="chips pickable">${SD.players().map((n, i) => `<button class="pchip" data-act="pick" data-i="${i}">${esc(n)}</button>`).join("")}</div>` : ""}
      </div>`, { cls: "game" });
    const inp = app.querySelector("#myName");
    app.querySelector("#nameForm").addEventListener("submit", e => {
      e.preventDefault();
      const v = inp.value.trim(); if (!v) { inp.focus(); return; }
      SD.save("myName", v); next(v);
    });
    SD.bind(app, { home: () => SD.home(), pick: (e, el) => { inp.value = SD.players()[+el.dataset.i]; } });
    setTimeout(() => inp.focus(), 50);
  };

  /* ---------- Créer / rejoindre ---------- */
  O.createFlow = () => askName(t("createRoom"), async name => {
    busy(t("connecting"));
    try {
      await O.init();
      let code, tries = 0;
      do { code = Array.from({ length: 4 }, () => ROOM_ALPHA[Math.floor(Math.random() * ROOM_ALPHA.length)]).join(""); tries++; }
      while ((await O.db.ref("rooms/" + code + "/host").once("value")).exists() && tries < 8);
      const first = Object.keys(O.games)[0];
      await O.db.ref("rooms/" + code).set({
        host: O.uid, game: first, status: "lobby", created: TS(), v: SD.APP_VERSION,
        players: { [O.uid]: { name, online: true, joined: TS() } }
      });
      enterRoom(code);
    } catch (e) { fail(e); }
  });

  O.joinFlow = code => {
    if (!code) return;
    askName(t("joinRoom") + " " + code, async name => {
      busy(t("connecting"));
      try {
        await O.init();
        const snap = await O.db.ref("rooms/" + code).once("value");
        const d = snap.val();
        if (!d || d.status === "closed") { SD.save("lastRoom", null); SD.toast(t("roomNotFound", { c: code })); return SD.home(); }
        const me = (d.players || {})[O.uid];
        await O.db.ref(`rooms/${code}/players/${O.uid}`).update(me ? { name, online: true } : { name, online: true, joined: TS() });
        enterRoom(code);
      } catch (e) { fail(e); }
    });
  };

  /* ---------- Dans le salon ---------- */
  const enterRoom = code => {
    if (O.room) O.leave(false);
    const ref = O.db.ref("rooms/" + code);
    const meRef = ref.child("players/" + O.uid);
    const conn = O.db.ref(".info/connected");
    const onConn = s => { if (s.val()) { meRef.child("online").onDisconnect().set(false); meRef.child("online").set(true); } };
    const onVal = snap => {
      const d = snap.val();
      if (!O.room || O.room.code !== code) return;
      O.room.data = d;
      if (!d || d.status === "closed") { O.leave(false); SD.toast(t("roomClosed")); return SD.home(); }
      if (O.room.view === "room") renderRoom();
    };
    O.room = { code, ref, meRef, data: null, view: "room", off: () => { ref.off("value", onVal); conn.off("value", onConn); } };
    SD.save("lastRoom", code);
    conn.on("value", onConn);
    ref.on("value", onVal);
  };

  O.leave = (removeMe = true) => {
    const r = O.room; if (!r) return;
    O.room = null; r.off();
    SD.save("lastRoom", null);
    if (!removeMe) return;
    try {
      r.meRef.child("online").onDisconnect().cancel();
      if (r.data && r.data.host === O.uid) r.ref.update({ status: "closed" });
      else r.meRef.remove();
    } catch (e) { /* hors ligne */ }
  };


  /* Contexte passé aux jeux */
  const ctx = () => {
    const r = O.room, d = r.data || {};
    const all = Object.entries(d.players || {}).map(([uid, p]) => ({ uid, ...p })).sort((a, b) => (a.joined || 0) - (b.joined || 0));
    return {
      d, code: r.code, uid: O.uid, isHost: d.host === O.uid, ref: r.ref,
      state: d.state || {},
      players: all, online: all.filter(p => p.online !== false),
      name: uid => ((d.players || {})[uid] || {}).name || "?",
      me: (d.players || {})[O.uid] || {},
      update: obj => r.ref.update(obj),
      setState: obj => { const u = {}; for (const k in obj) u["state/" + k] = obj[k]; return r.ref.update(u); },
      render: renderRoom,
      quizOn: String((d.opts || {}).quiz ?? "1") === "1",
      // Quiz du perdant sur son propre téléphone ; le résultat est partagé (sauvé / boit)
      quiz: name => {
        r.view = "quiz";
        SD.runQuiz([name], {
          onResult: (n, ok) => { try { r.ref.child("state/quizRes/" + O.uid).set(ok ? "ok" : "ko"); } catch (e) {} },
          onContinue: () => { if (O.room) { O.room.view = "room"; renderRoom(); } else SD.home(); }
        });
      },
      toLobby: () => r.ref.update({ status: "lobby", state: null }),
      opts: d.opts || {},
      now: () => Date.now() + (O.offset || 0),
      // Empêche les mises à jour des autres de redessiner l'écran pendant une action locale (chrono, réflexe…)
      hold: () => { r.view = "local"; },
      release: () => { if (O.room) { O.room.view = "room"; renderRoom(); } },
      local: () => { const k = d.game + ":" + ((d.state || {}).gid || ""); if (!O.local || O.local.k !== k) O.local = { k }; return O.local; },
      restart: () => r.ref.update({ state: { ...O.games[d.game].start(ctx()), gid: Math.random().toString(36).slice(2, 8) } })
    };
  };

  const header = c => `
    <header class="game-top">
      <button class="icon-btn" data-act="leave" aria-label="${t("leaveRoom")}">${SD.icon("back")}</button>
      <span class="eyebrow">${t("roomCode", { c: c.code })}</span>
      <button class="icon-btn" data-act="orules" aria-label="${t("rules")}">${SD.icon("help")}</button>
    </header>`;
  const hostBanner = c => {
    const host = c.players.find(p => p.uid === c.d.host);
    if (!host || host.online !== false || c.isHost) return "";
    return `<div class="host-off"><span>${t("hostOffline", { name: esc(host.name) })}</span><button class="btn small primary" data-act="takeHost">${t("takeHost")}</button></div>`;
  };
  O.baseHandlers = c => ({
    // Flèche retour : en partie, retour au salon (hôte) ; dans le salon, quitter la session. Toujours avec confirmation.
    leave: async () => {
      const hostName = esc(c.name(c.d.host));
      if (c.d.status === "playing") {
        if (c.isHost) {
          if (await SD.confirm({ title: t("backLobbyQ"), text: t("backLobbyText"), yes: t("yes"), no: t("no") })) c.toLobby();
        } else if (await SD.confirm({ title: t("leaveRoomQ"), text: t("onlyHostStops", { name: hostName }) + " " + t("leaveRoomText"), yes: t("leaveRoom"), no: t("cancel"), danger: true })) { O.leave(true); SD.home(); }
        return;
      }
      const text = c.isHost ? t("leaveRoomHostText") : t("leaveRoomText");
      if (await SD.confirm({ title: t("leaveRoomQ"), text, yes: t("leaveRoom"), no: t("cancel"), danger: true })) { O.leave(true); SD.home(); }
    },
    orules: () => SD.modal(t("og_" + c.d.game), `<div class="rules">${SD.nl2p(t("og_" + c.d.game + "_r"))}</div>`),
    takeHost: () => c.update({ host: c.uid })
  });
  O.frame = (c, body, actions) => `${header(c)}${hostBanner(c)}<div class="game-body online-body">${body}</div>${actions ? `<div class="actions">${actions}</div>` : ""}`;

  const renderRoom = () => {
    if (!O.room || !O.room.data) return;
    const c = ctx();
    const st = c.state;
    // Clé d'écran : tant que la partie reste à la même étape, le défilement est conservé
    SD._pendingKey = ["room", c.code, c.d.status, c.d.status === "playing" ? c.d.game : "", st.phase || "", st.n || "", st.round || "", st.di || ""].join(":");
    if (c.d.status === "playing" && O.games[c.d.game]) return O.games[c.d.game].view(c);
    lobby(c);
  };

  /* ---------- Salle d'attente ---------- */
  // Jeux rangés par catégorie ; un jeu absent des catégories va dans « Autres »
  const CATS = [["quiz", ["buzz", "osync", "oblind", "ohl"]], ["speed", ["oreflex", "ochrono", "obomb"]], ["bluff", ["most", "ointrus", "otraitor"]], ["luck", ["opush"]]];
  const QUIZ_OPT = { k: "quiz", def: "1", label: () => t("quizMandatory"), choices: () => [["1", t("yes")], ["0", t("no")]] };
  const gameMin = g => (O.games[g] && O.games[g].min) || 2;
  const showRules = g => SD.modal(t("og_" + g), `<div class="rules">${SD.nl2p(t("og_" + g + "_r"))}</div>`);

  const lobby = c => {
    const url = (SD.appUrl ? SD.appUrl() : location.href.split("#")[0]) + "#room=" + c.code;
    const known = new Set(CATS.flatMap(x => x[1]));
    const cats = CATS.map(([k, ids]) => [k, ids.filter(g => O.games[g])]).concat([["other", Object.keys(O.games).filter(g => !known.has(g))]]).filter(x => x[1].length);
    const card = g => `
      <div class="gcard">
        <button class="gmain" data-act="game" data-g="${g}">
          <span class="gname">${t("og_" + g)}</span>
          <span class="gdesc">${t("og_" + g + "_d")}</span>
          <span class="badge each">${SD.icon("phones")}${t("minPlayers", { n: gameMin(g) })}${O.games[g].sound ? ` · ${t("withSound")}` : ""}</span>
        </button>
        <button class="icon-btn ghelp" data-act="grules" data-g="${g}" aria-label="${t("rules")} · ${t("og_" + g)}">${SD.icon("help")}</button>
      </div>`;
    const app = SD.render(O.frame(c, `
      <div class="lobby-top">
        <div class="qr-box small">${SD.qrSvg(url)}</div>
        <div class="lobby-info">
          <span class="label">${t("code")}</span><strong class="mono room-code">${esc(c.code)}</strong>
          <span class="hint">${t("lobbyJoinHelp")}</span>
        </div>
      </div>
      <div class="player-list">${c.players.map(p => `<span class="pl ${p.online === false ? "off" : ""}"><i></i>${esc(p.name)}${p.uid === c.d.host ? ` <small>${t("hostTag")}</small>` : ""}${p.uid === c.uid ? ` <small>${t("youTag")}</small>` : ""}</span>`).join("")}</div>
      <p class="lead lobby-call">${c.isHost ? t("hostPick") : t("waitHostPick", { name: esc(c.name(c.d.host)) })}</p>
      ${cats.map(([k, ids]) => `<section class="block lobby-cat"><h2 class="section-title">${t("cat_" + k)}</h2><div class="game-grid">${ids.map(card).join("")}</div></section>`).join("")}
      <p class="hint">${t("holdHint")}</p>
    `), { cls: "game", awake: true });
    app.querySelectorAll(".gmain").forEach(el => SD.longPress(el, () => showRules(el.dataset.g)));
    SD.bind(app, {
      ...O.baseHandlers(c),
      grules: (e, el) => showRules(el.dataset.g),
      game: (e, el) => c.isHost ? openLaunch(el.dataset.g) : showRules(el.dataset.g),
      opt: (e, el) => c.update({ ["opts/" + el.dataset.k]: el.dataset.v })
    });
  };

  // Fenêtre « Lancer ce jeu ? » avec les réglages du jeu ; rien n'est envoyé avant d'appuyer sur Lancer
  const openLaunch = g => {
    const base = ctx();
    const pending = { ...base.opts };
    const opts = (O.games[g].options || []);
    const body = () => {
      const c = ctx(), min = gameMin(g), enough = c.online.length >= min;
      return `<p class="lead">${t("og_" + g + "_d")}</p>
        <button class="btn link" data-m="rules">${t("rules")}</button>
        ${O.options({ opts: pending }, opts)}
        ${O.options({ opts: pending }, [QUIZ_OPT])}
        <p class="hint">${t("quizMandatoryHelp")}</p>
        <div class="btn-col center">
          <button class="btn primary xl" data-m="launch" ${enough ? "" : "disabled"}>${enough ? t("launchThis") : t("needN", { n: min })}</button>
          <button class="btn ghost" data-m="cancel">${t("cancel")}</button>
        </div>`;
    };
    SD.modal(t("launchQ", { g: t("og_" + g) }), `<div class="launch-body">${body()}</div>`);
    const m = document.getElementById("modal");
    if (!m) return;
    const wrap = m.querySelector(".launch-body");
    const redraw = () => { wrap.innerHTML = body(); };
    wrap.addEventListener("click", e => {
      const el = e.target.closest("button"); if (!el) return;
      if (el.dataset.act === "opt") { pending[el.dataset.k] = el.dataset.v; return redraw(); }
      if (el.dataset.act === "optm") {
        const k = el.dataset.k, set = new Set(String(pending[k] ?? el.dataset.def).split(",").filter(Boolean));
        set.has(el.dataset.v) ? set.delete(el.dataset.v) : set.add(el.dataset.v);
        if (!set.size) return SD.toast(t("pickOne"));
        pending[k] = [...set].join(","); return redraw();
      }
      if (el.dataset.m === "rules") return showRules(g);
      if (el.dataset.m === "cancel") return SD.closeModal();
      if (el.dataset.m === "launch") {
        const c = ctx();
        if (!c.isHost) return SD.closeModal();
        SD.closeModal();
        c.update({ game: g, opts: pending, status: "playing", state: { ...O.games[g].start({ ...c, opts: pending }), gid: Math.random().toString(36).slice(2, 8) } });
      }
    });
  };

  /* Réglages d'un jeu dans le salon : [{ k, label, choices: [[valeur, texte]], def }] */
  O.options = (c, list) => list.map(o => {
    if (o.multi) {
      // Choix multiple (ex. décennies) : valeurs séparées par des virgules
      const set = new Set(String(c.opts[o.k] ?? o.def).split(",").filter(Boolean));
      return `<div class="field"><span class="label">${o.label()}</span><div class="chips multi">${o.choices().map(([v, l]) => `<button class="pchip toggle ${set.has(String(v)) ? "on" : ""}" data-act="optm" data-k="${o.k}" data-v="${v}" data-def="${o.def}" aria-pressed="${set.has(String(v))}">${l}</button>`).join("")}</div></div>`;
    }
    const cur = String(c.opts[o.k] ?? o.def);
    return `<div class="field"><span class="label">${o.label()}</span><div class="seg" role="group">${o.choices().map(([v, l]) => `<button class="${String(v) === cur ? "on" : ""}" data-act="opt" data-k="${o.k}" data-v="${v}" aria-pressed="${String(v) === cur}">${l}</button>`).join("")}</div></div>`;
  }).join("");
  O.opt = (c, k, def) => c.opts[k] ?? def;

  /* ---------- Outils communs aux jeux ---------- */
  O.scoreList = (c, scores, losers = []) => `<div class="result-list">${c.players.slice().sort((a, b) => (scores[b.uid] || 0) - (scores[a.uid] || 0)).map(p => `<div class="rrow ${losers.includes(p.uid) ? "lose" : ""}"><span>${esc(p.name)}</span><b>${scores[p.uid] || 0}</b></div>`).join("")}</div>`;
  /* ---------- Quiz du perdant, visible par tout le monde ----------
     state.qz[uid] = { step: "diff" | "q" | "a" | "r", d, q, ok, sips }
     Le perdant choisit sa difficulté, lit la question, affiche la réponse puis dit s'il avait bon.
     Les autres suivent en direct ; ils ne voient la réponse que quand le perdant l'affiche. */
  const qzCard = (c, u) => {
    const qz = (c.state.qz || {})[u] || { step: "diff" }, me = u === c.uid, name = esc(c.name(u));
    const sipTxt = n => t("drink", { n, s: SD.sipWord(n) });
    if (qz.step === "r") return `<div class="qz-card ${qz.ok ? "ok" : "ko"}"><p class="qz-name">${name}</p>
      <p class="verdict ${qz.ok ? "good" : "bad"}">${qz.ok ? t("qzSaved") : sipTxt(qz.sips || 1)}</p></div>`;
    if (qz.step === "diff") {
      if (!me) return `<div class="qz-card"><p class="qz-name">${name}</p><p class="hint">${t("qzChoosing", { name })}</p></div>`;
      const used = SD.usedDiffs(c.me.name || "");
      return `<div class="qz-card me"><p class="qz-name">${t("chooseDiff", { name: `<span class="hl">${name}</span>` })}</p>
        <div class="diff-grid">${["E", "M", "H"].map(d => used.includes(d)
          ? `<button class="diff-btn ${SD.diffClass(d)} used" disabled><span class="dn">${SD.diffName(d)}</span><span class="dc">${t("diffUsed")}</span></button>`
          : `<button class="diff-btn ${SD.diffClass(d)}" data-act="qzDiff" data-d="${d}"><span class="dn">${SD.diffName(d)}</span><span class="dc">${t("missCost", { n: SD.state.sips[d] })} ${SD.sipWord(SD.state.sips[d])}</span></button>`).join("")}</div></div>`;
    }
    const revealed = qz.step === "a";
    const head = me ? `<p class="qz-name">${t("qzYourTurn")}</p>` : `<p class="qz-shh">🤫 ${t("qzShh", { name })}</p>`;
    const ctl = me ? (revealed
        ? `<div class="row-btns center"><button class="btn bad" data-act="qzKo">${t("missed")}</button><button class="btn good" data-act="qzOk">${t("gotIt")}</button></div>`
        : `<button class="btn primary" data-act="qzReveal">${t("showAnswer")}</button>`)
      : `<p class="hint">${revealed ? t("qzJudging", { name }) : t("qzAnswering", { name })}</p>`;
    return `<div class="qz-card ${me ? "me" : ""}">${head}${SD.questionCard(qz.q, revealed)}${ctl}</div>`;
  };
  // Ce qui arrive aux perdants : quiz obligatoire (qui peut sauver) ou gorgée directe
  O.loserBlock = (c, losers) => {
    if (!losers.length) return "";
    if (!c.quizOn) return `<p class="lead">${t("mostDrinks", { names: losers.map(u => esc(c.name(u))).join(", ") })}</p>`;
    return `<div class="qz-list">${losers.map(u => qzCard(c, u)).join("")}</div>`;
  };
  O.quizPending = (c, losers) => c.quizOn && losers.some(u => ((c.state.qz || {})[u] || {}).step !== "r");
  O.endButtons = (c, losers) => `${O.loserBlock(c, losers)}
      ${c.isHost ? `<button class="btn ${losers.includes(c.uid) && O.quizPending(c, [c.uid]) ? "ghost" : "primary xl"}" data-act="again">${t("again")}</button><button class="btn ghost" data-act="lobbyBack">${t("backLobby")}</button>` : `<p class="hint">${t("waitHost")}</p>`}`;
  O.quizHandlers = c => {
    const set = v => c.setState({ ["qz/" + c.uid]: v });
    const cur = () => (c.state.qz || {})[c.uid] || {};
    return {
      qzDiff: (e, el) => {
        const d = el.dataset.d, q = SD.drawQuestion(d);
        if (!q) return SD.toast(t("noQuestions"));
        SD.markDiff(c.me.name || "", d); SD.beep(520, .05);
        set({ step: "q", d, sips: SD.state.sips[d], q: { q: q.q, a: q.a, detail: q.detail || "", qEn: q.qEn || "", aEn: q.aEn || "", detailEn: q.detailEn || "", theme: q.theme, diff: q.diff } });
      },
      qzReveal: () => set({ ...cur(), step: "a" }),
      qzOk: () => { SD.good(); set({ ...cur(), step: "r", ok: true }); },
      qzKo: () => { SD.bad(); set({ ...cur(), step: "r", ok: false }); }
    };
  };
  O.endHandlers = c => ({ ...O.quizHandlers(c), again: () => c.restart(), lobbyBack: () => c.toLobby() });

  // Question tirée par l'hôte : envoyée en entier pour que tout le monde voie la même
  O.pickQuestion = () => {
    const pool = SD.activeQuestions();
    const q = SD.pick(pool.length ? pool : SD.bank.questions);
    return { q: q.q, a: q.a, detail: q.detail || "", qEn: q.qEn || "", aEn: q.aEn || "", detailEn: q.detailEn || "", theme: q.theme, diff: q.diff };
  };

  /* ================= Buzzer Quiz ================= */
  O.games.buzz = {
    start: () => ({ phase: "q", n: 1, total: 10, q: O.pickQuestion(), buzz: null, locked: null, scores: null, last: null }),
    view: c => {
      const s = c.state, scores = s.scores || {}, locked = s.locked || {};
      if (s.phase === "end") {
        const min = Math.min(...c.players.map(p => scores[p.uid] || 0));
        const losers = c.players.filter(p => (scores[p.uid] || 0) === min).map(p => p.uid);
        const app = SD.render(O.frame(c, `
          <p class="eyebrow">${t("results")}</p>${O.scoreList(c, scores, losers)}
          <h1 class="display">${t("quizQueue", { names: losers.map(u => `<span class="hl">${esc(c.name(u))}</span>`).join(", ") })}</h1>
          <div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
      }
      const buzzed = s.buzz, revealed = s.phase === "reveal";
      const canBuzz = !buzzed && !revealed && !locked[c.uid];
      const status = revealed
        ? (s.last && s.last.ok ? `<p class="verdict good">${t("buzzRight", { name: esc(c.name(s.last.uid)) })}</p>` : `<p class="verdict">${t("buzzNobody")}</p>`)
        : buzzed ? `<p class="verdict hl">${t("buzzedBy", { name: esc(buzzed.name) })}</p>`
        : s.last && !s.last.ok ? `<p class="verdict bad">${t("buzzWrong", { name: esc(c.name(s.last.uid)) })}</p>` : "";
      const hostCtl = c.isHost
        ? revealed ? `<button class="btn primary xl wide" data-act="nextQ">${s.n >= s.total ? t("seeResults") : t("nextQuestion")}</button>`
          : buzzed ? `<button class="btn bad xl" data-act="wrong">${t("missed")}</button><button class="btn good xl" data-act="right">${t("gotIt")}</button>`
          : `<button class="btn ghost xl wide" data-act="reveal">${t("nobodyKnows")}</button>`
        : "";
      const app = SD.render(O.frame(c, `
        <div class="scoreboard">${c.players.map(p => `<span class="score ${buzzed && buzzed.uid === p.uid ? "on" : ""} ${locked[p.uid] ? "locked" : ""}">${esc(p.name)} <b>${scores[p.uid] || 0}</b></span>`).join("")}</div>
        <p class="eyebrow">${t("question", { i: s.n, n: s.total })}</p>
        ${SD.questionCard(s.q, revealed || (c.isHost && !!buzzed))}
        ${status}
        ${canBuzz ? `<button class="buzz-btn" id="buzzBtn">${t("buzz")}</button>` : locked[c.uid] && !revealed ? `<p class="hint">${t("buzzLocked")}</p>` : ""}
      `, hostCtl), { cls: "game", awake: true });
      const bb = app.querySelector("#buzzBtn");
      if (bb) bb.addEventListener("pointerdown", e => {
        e.preventDefault(); bb.disabled = true; SD.buzz(40);
        c.ref.child("state/buzz").transaction(cur => cur ? undefined : { uid: c.uid, name: c.me.name || "?" });
      }, { once: true });
      if (buzzed && buzzed.uid === c.uid && !revealed) SD.beep(880, .1, "square", .1);
      SD.bind(app, {
        ...O.baseHandlers(c),
        right: () => c.setState({ phase: "reveal", ["scores/" + buzzed.uid]: (scores[buzzed.uid] || 0) + 1, last: { uid: buzzed.uid, ok: true } }),
        wrong: () => {
          const lockedNow = { ...locked, [buzzed.uid]: true };
          const allOut = c.online.every(p => lockedNow[p.uid]);
          c.setState({ buzz: null, ["locked/" + buzzed.uid]: true, last: { uid: buzzed.uid, ok: false }, phase: allOut ? "reveal" : "q" });
        },
        reveal: () => c.setState({ phase: "reveal", last: null }),
        nextQ: () => s.n >= s.total ? c.setState({ phase: "end" })
          : c.setState({ phase: "q", n: s.n + 1, q: O.pickQuestion(), buzz: null, locked: null, last: null })
      });
    }
  };

  /* ================= Qui est le plus susceptible de… ================= */
  O.games.most = {
    start: () => {
      const len = (SD.MOST.fr || []).length;
      return { phase: "vote", n: 1, total: 10, deck: SD.shuffle([...Array(len).keys()]).slice(0, 10), votes: null, tally: null };
    },
    view: c => {
      const s = c.state, votes = s.votes || {}, tally = s.tally || {};
      const list = SD.MOST[SD.state.lang] || SD.MOST.fr;
      if (s.phase === "end") {
        const max = Math.max(...c.players.map(p => tally[p.uid] || 0));
        const losers = c.players.filter(p => (tally[p.uid] || 0) === max && max > 0).map(p => p.uid);
        const app = SD.render(O.frame(c, `
          <p class="eyebrow">${t("mostTotal")}</p>${O.scoreList(c, tally, losers)}
          ${losers.length ? `<h1 class="display">${t("quizQueue", { names: losers.map(u => `<span class="hl">${esc(c.name(u))}</span>`).join(", ") })}</h1>` : ""}
          <div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
      }
      const prompt = list[Object.values(s.deck || {})[s.n - 1]] || "";
      const voters = Object.keys(votes).length, need = c.online.length;
      if (s.phase === "vote" && c.isHost && voters >= need && need > 0) {
        // Tout le monde a voté : l'hôte révèle
        const counts = {}; Object.values(votes).forEach(u => (counts[u] = (counts[u] || 0) + 1));
        const nt = { ...tally }; Object.entries(counts).forEach(([u, n]) => (nt[u] = (nt[u] || 0) + n));
        c.setState({ phase: "result", tally: nt });
        return;
      }
      if (s.phase === "result") {
        const counts = {}; Object.values(votes).forEach(u => (counts[u] = (counts[u] || 0) + 1));
        const max = Math.max(0, ...Object.values(counts));
        const losers = Object.keys(counts).filter(u => counts[u] === max);
        const app = SD.render(O.frame(c, `
          <p class="eyebrow">${t("question", { i: s.n, n: s.total })}</p>
          <h1 class="display most-prompt">${esc(prompt)}</h1>
          <div class="result-list">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<div class="rrow ${losers.includes(u) ? "lose" : ""}"><span>${esc(c.name(u))}</span><b>${t("votesN", { n })}</b></div>`).join("")}</div>
          ${O.loserBlock(c, losers)}`,
          c.isHost ? `<button class="btn primary xl wide" data-act="nextP">${s.n >= s.total ? t("seeResults") : t("nextQuestion")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, {
          ...O.baseHandlers(c), ...O.quizHandlers(c),
          nextP: () => s.n >= s.total ? c.setState({ phase: "end", qz: null }) : c.setState({ phase: "vote", n: s.n + 1, votes: null, qz: null })
        });
      }
      const mine = votes[c.uid];
      const app = SD.render(O.frame(c, `
        <p class="eyebrow">${t("question", { i: s.n, n: s.total })}</p>
        <p class="hint">${t("mostAsk")}</p>
        <h1 class="display most-prompt">${esc(prompt)}</h1>
        <div class="vote-grid">${c.online.map(p => `<button class="vote ${mine === p.uid ? "on" : ""}" data-act="vote" data-u="${p.uid}">${esc(p.name)}</button>`).join("")}</div>
        <p class="hint tabnum">${t("votedCount", { n: voters, m: need })}</p>`,
        c.isHost ? `<button class="btn ghost xl wide" data-act="force" ${voters ? "" : "disabled"}>${t("revealNow")}</button>` : ""), { cls: "game", awake: true });
      SD.bind(app, {
        ...O.baseHandlers(c),
        vote: (e, el) => { SD.beep(600, .04); c.setState({ ["votes/" + c.uid]: el.dataset.u }); },
        force: () => {
          const counts = {}; Object.values(votes).forEach(u => (counts[u] = (counts[u] || 0) + 1));
          const nt = { ...tally }; Object.entries(counts).forEach(([u, n]) => (nt[u] = (nt[u] || 0) + n));
          c.setState({ phase: "result", tally: nt });
        }
      });
    }
  };
})();
