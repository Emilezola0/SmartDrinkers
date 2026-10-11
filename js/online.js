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
      quiz: name => { r.view = "quiz"; SD.runQuiz([name], { onContinue: () => { if (O.room) { O.room.view = "room"; renderRoom(); } else SD.home(); } }); },
      toLobby: () => r.ref.update({ status: "lobby", state: null }),
      restart: () => r.ref.update({ state: O.games[d.game].start(ctx()) })
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
    leave: () => { O.leave(true); SD.home(); },
    orules: () => SD.modal(t("og_" + c.d.game), `<div class="rules">${SD.nl2p(t("og_" + c.d.game + "_r"))}</div>`),
    takeHost: () => c.update({ host: c.uid })
  });
  O.frame = (c, body, actions) => `${header(c)}${hostBanner(c)}<div class="game-body online-body">${body}</div>${actions ? `<div class="actions">${actions}</div>` : ""}`;

  const renderRoom = () => {
    if (!O.room || !O.room.data) return;
    const c = ctx();
    if (c.d.status === "playing" && O.games[c.d.game]) return O.games[c.d.game].view(c);
    lobby(c);
  };

  const lobby = c => {
    const url = (SD.appUrl ? SD.appUrl() : location.href.split("#")[0]) + "#room=" + c.code;
    const games = Object.keys(O.games);
    const app = SD.render(O.frame(c, `
      <p class="eyebrow">${t("lobby")}</p>
      <div class="qr-box small">${SD.qrSvg(url)}</div>
      <p class="code-line"><span class="label">${t("code")}</span><strong class="mono room-code">${esc(c.code)}</strong></p>
      <div class="player-list">${c.players.map(p => `<span class="pl ${p.online === false ? "off" : ""}"><i></i>${esc(p.name)}${p.uid === c.d.host ? ` <small>${t("hostTag")}</small>` : ""}${p.uid === c.uid ? ` <small>${t("youTag")}</small>` : ""}</span>`).join("")}</div>
      ${c.isHost ? `<div class="field"><span class="label">${t("chooseGame")}</span>
        <div class="choose-list">${games.map(g => `<button class="choose ${g === c.d.game ? "on" : ""}" data-act="pickGame" data-g="${g}"><span class="gname">${t("og_" + g)}</span><span class="gdesc">${t("og_" + g + "_d")}</span></button>`).join("")}</div></div>`
        : `<p class="lead">${t("gameChosen", { g: t("og_" + c.d.game) })}</p><p class="hint">${t("waitHost")}</p>`}
    `, c.isHost ? `<button class="btn primary xl wide" data-act="launch" ${c.online.length >= 2 ? "" : "disabled"}>${c.online.length >= 2 ? t("launch") : t("needTwo")}</button>` : ""), { cls: "game", awake: true });
    SD.bind(app, {
      ...O.baseHandlers(c),
      pickGame: (e, el) => c.update({ game: el.dataset.g }),
      launch: () => c.update({ status: "playing", state: O.games[c.d.game].start(c) })
    });
  };

  /* ---------- Outils communs aux jeux ---------- */
  O.scoreList = (c, scores, losers = []) => `<div class="result-list">${c.players.slice().sort((a, b) => (scores[b.uid] || 0) - (scores[a.uid] || 0)).map(p => `<div class="rrow ${losers.includes(p.uid) ? "lose" : ""}"><span>${esc(p.name)}</span><b>${scores[p.uid] || 0}</b></div>`).join("")}</div>`;
  O.endButtons = (c, losers) => {
    const meLoses = losers.includes(c.uid);
    return `${meLoses ? `<button class="btn primary xl" data-act="myQuiz">${t("iDoQuiz")}</button>` : ""}
      ${c.isHost ? `<button class="btn ${meLoses ? "ghost" : "primary xl"}" data-act="again">${t("again")}</button><button class="btn ghost" data-act="lobbyBack">${t("backLobby")}</button>` : `<p class="hint">${t("waitHost")}</p>`}`;
  };
  O.endHandlers = c => ({ myQuiz: () => c.quiz(c.me.name || t("you")), again: () => c.restart(), lobbyBack: () => c.toLobby() });

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
      const prompt = list[s.deck[s.n - 1]] || "";
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
        const meLoses = losers.includes(c.uid);
        const app = SD.render(O.frame(c, `
          <p class="eyebrow">${t("question", { i: s.n, n: s.total })}</p>
          <h1 class="display most-prompt">${esc(prompt)}</h1>
          <div class="result-list">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<div class="rrow ${losers.includes(u) ? "lose" : ""}"><span>${esc(c.name(u))}</span><b>${t("votesN", { n })}</b></div>`).join("")}</div>
          <p class="lead">${t("mostDrinks", { names: losers.map(u => esc(c.name(u))).join(", ") })}</p>
          ${meLoses ? `<button class="btn primary xl" data-act="myQuiz">${t("iDoQuiz")}</button>` : ""}`,
          c.isHost ? `<button class="btn primary xl wide" data-act="nextP">${s.n >= s.total ? t("seeResults") : t("nextQuestion")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, {
          ...O.baseHandlers(c),
          myQuiz: () => c.quiz(c.me.name || t("you")),
          nextP: () => s.n >= s.total ? c.setState({ phase: "end" }) : c.setState({ phase: "vote", n: s.n + 1, votes: null })
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
