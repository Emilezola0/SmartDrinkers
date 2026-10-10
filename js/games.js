/* SmartDrinkers — jeux sur un seul téléphone */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc;

  SD.GAMES = [];
  SD.addGame = g => SD.GAMES.push(g);

  /* En-tête commun des écrans de jeu */
  SD.gameTop = id => `
    <header class="game-top">
      <button class="icon-btn" data-act="home" aria-label="${t("menu")}">${SD.icon("back")}</button>
      <span class="eyebrow">${t("g_" + id)}</span>
      <button class="icon-btn" data-act="rules" aria-label="${t("rules")}">${SD.icon("help")}</button>
    </header>`;
  SD.showRules = id => SD.modal(t("g_" + id), `<div class="rules">${SD.nl2p(t("g_" + id + "_r"))}</div>`);
  SD.topHandlers = id => ({ home: () => SD.home(), rules: () => SD.showRules(id) });

  /* ================= Plus ou Moins ================= */
  (function () {
    const SUITS = [["♠", 0], ["♥", 1], ["♦", 1], ["♣", 0]];
    const RANKS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
    const RANKS_FR = { 11: "V", 12: "D", 13: "R", 14: "A" };
    const newDeck = () => { const d = []; for (const s of SUITS) for (let v = 2; v <= 14; v++) d.push({ v, s: s[0], red: s[1] }); return SD.shuffle(d); };
    const label = v => v <= 10 ? String(v) : (SD.state.lang === "fr" ? RANKS_FR : RANKS)[v];
    SD.cardHtml = (c, extra = "") => c
      ? `<div class="pcard ${c.red ? "red" : ""} ${extra}"><span class="corner">${label(c.v)}<br>${c.s}</span><span class="pip">${c.s}</span><span class="corner br">${label(c.v)}<br>${c.s}</span></div>`
      : `<div class="pcard back ${extra}"></div>`;

    let deck, cur, streak;
    const start = () => { deck = newDeck(); cur = deck.pop(); streak = 0; screen(); };

    const screen = (next, verdict) => {
      const app = SD.render(`
        ${SD.gameTop("highlow")}
        <div class="game-body">
          <p class="turn">${t("turnOf")} <strong>${esc(SD.current())}</strong></p>
          <div class="card-row">${SD.cardHtml(cur)}${next ? SD.cardHtml(next, "flip-in") : SD.cardHtml(null)}</div>
          <div class="stats"><span>${t("streak")} <b>${streak}</b></span><span>${t("cardsLeft", { n: deck.length })}</span></div>
          <p class="verdict ${verdict ? verdict.cls : ""}" aria-live="polite">${verdict ? verdict.txt : "&nbsp;"}</p>
        </div>
        <div class="actions">
          <button class="btn primary xl" data-act="lo" ${next ? "disabled" : ""}>↓ ${t("lower")}</button>
          <button class="btn primary xl" data-act="hi" ${next ? "disabled" : ""}>↑ ${t("higher")}</button>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("highlow"), hi: () => guess(1), lo: () => guess(-1) });
    };

    const guess = dir => {
      if (!deck.length) deck = newDeck();
      const next = deck.pop();
      const diff = Math.sign(next.v - cur.v);
      const ok = diff !== 0 && diff === dir;
      const verdict = ok ? { cls: "good", txt: t("right") } : { cls: "bad", txt: diff === 0 ? t("tie") : t("wrong") };
      ok ? SD.good() : SD.bad();
      screen(next, verdict);
      SD.later(() => {
        const loser = SD.current();
        cur = next;
        if (ok) { streak++; SD.nextTurn(); screen(); }
        else { streak = 0; SD.nextTurn(); SD.runQuiz([loser], { onContinue: () => screen() }); }
      }, ok ? 900 : 1500);
    };

    SD.addGame({ id: "highlow", mode: "one", min: 2, start });
  })();

  /* ================= Roulette russe (cartes) ================= */
  (function () {
    let deck, history;
    const newRound = () => { deck = SD.shuffle([0, 0, 0, 0, 0, 0, 1]); history = []; };
    const start = () => { newRound(); screen(); };

    const screen = (reveal) => {
      const left = deck.length;
      const app = SD.render(`
        ${SD.gameTop("roulette")}
        <div class="game-body">
          <p class="turn">${t("turnOf")} <strong>${esc(SD.current())}</strong></p>
          <div class="fan" aria-label="${left}">
            ${Array.from({ length: left }, (_, i) => `<div class="rcard back" style="--i:${i};--n:${left}"></div>`).join("")}
          </div>
          ${reveal ? `<div class="rbig ${reveal.v ? "one" : "zero"} flip-in">${reveal.v}</div>` : `<div class="rbig ghost">?</div>`}
          <div class="history">${history.map(v => `<span class="mini">${v}</span>`).join("")}</div>
          <p class="verdict ${reveal ? reveal.cls : ""}" aria-live="polite">${reveal ? reveal.txt : "&nbsp;"}</p>
        </div>
        <div class="actions">
          <button class="btn ghost xl" data-act="remove" ${reveal ? "disabled" : ""}>${t("remove")}</button>
          <button class="btn primary xl" data-act="take" ${reveal ? "disabled" : ""}>${t("take")}</button>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("roulette"), take: () => play("take"), remove: () => play("remove") });
    };

    const play = action => {
      const v = deck.pop();
      history.push(v);
      const me = SD.current();
      const others = SD.players().filter(p => p !== me);
      let reveal, losers = null;
      if (action === "take") {
        if (v === 0) reveal = { v, cls: "good", txt: t("safeTake") };
        else { reveal = { v, cls: "bad", txt: t("loseTake") }; losers = [me]; }
      } else {
        if (v === 0) { reveal = { v, cls: "bad", txt: t("loseRemove") }; losers = [me]; }
        else { reveal = { v, cls: "good", txt: t("winRemove") }; losers = others; }
      }
      losers ? (losers[0] === me ? SD.bad() : SD.good()) : SD.good();
      screen(reveal);
      SD.later(() => {
        SD.nextTurn();
        if (!losers) screen();
        else SD.runQuiz(losers, { onContinue: () => { newRound(); screen(); } });
      }, losers ? 1700 : 1000);
    };

    SD.addGame({ id: "roulette", mode: "one", min: 2, start });
  })();

  /* ================= La Bombe ================= */
  (function () {
    let category;
    const newCat = () => { const list = SD.BOMB[SD.state.lang] || SD.BOMB.fr; let c; do c = SD.pick(list); while (c === category && list.length > 1); category = c; };
    const start = () => { newCat(); ready(); };

    const ready = () => {
      const app = SD.render(`
        ${SD.gameTop("bomb")}
        <div class="game-body">
          <p class="eyebrow">${t("holder")} <strong>${esc(SD.current())}</strong></p>
          <h1 class="display category">${esc(category)}</h1>
          <button class="btn link" data-act="cat">${t("newCategory")}</button>
          <div class="bomb idle" aria-hidden="true"><span class="fuse"></span></div>
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="go">${t("lightFuse")}</button></div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("bomb"), cat: () => { newCat(); ready(); }, go: run });
    };

    const run = () => {
      const total = 15000 + Math.random() * 30000;
      const t0 = performance.now();
      let tick = null, alive = true;
      const app = SD.render(`
        <header class="game-top"><span></span><span class="eyebrow">${esc(category)}</span><span></span></header>
        <div class="game-body bomb-run">
          <p class="eyebrow">${t("holder")}</p>
          <h1 class="display huge" id="holder">${esc(SD.current())}</h1>
          <div class="bomb lit" aria-hidden="true"><span class="fuse"></span></div>
        </div>
        <button class="pass-zone" data-act="pass">${t("pass")}</button>`, { cls: "game", awake: true });
      const holderEl = app.querySelector("#holder"), bombEl = app.querySelector(".bomb");
      const loop = () => {
        if (!alive) return;
        const p = (performance.now() - t0) / total;
        if (p >= 1) return explode();
        SD.beep(p > .75 ? 1100 : 880, .04, "square", .08);
        bombEl.classList.remove("tick"); void bombEl.offsetWidth; bombEl.classList.add("tick");
        tick = setTimeout(loop, Math.max(140, 900 - p * 760));
      };
      const explode = () => {
        alive = false;
        const loser = SD.current();
        SD.boomSound(); SD.buzz([400, 100, 400]);
        const a = SD.render(`
          <div class="center-stack boom">
            <h1 class="display mega">${t("boom")}</h1>
            <p class="lead"><strong>${esc(loser)}</strong></p>
            <button class="btn primary xl" data-act="quiz">${t("quizTime")}</button>
          </div>`, { cls: "game exploded", awake: true });
        SD.bind(a, { quiz: () => { SD.nextTurn(); SD.runQuiz([loser], { onContinue: () => { newCat(); ready(); } }); } });
      };
      SD.bind(app, { pass: () => { if (!alive) return; SD.nextTurn(); holderEl.textContent = SD.current(); SD.beep(500, .05); SD.buzz(15); holderEl.classList.remove("pop"); void holderEl.offsetWidth; holderEl.classList.add("pop"); } });
      SD.cleanup = () => { alive = false; clearTimeout(tick); };
      loop();
    };

    SD.addGame({ id: "bomb", mode: "one", min: 2, start });
  })();

  /* ================= Réflexe ================= */
  (function () {
    let duo = [];
    const start = () => {
      const p = SD.players();
      if (!duo.length || !duo.every(n => p.includes(n))) duo = [SD.current(), SD.current(1)];
      pick();
    };

    const pick = () => {
      const app = SD.render(`
        ${SD.gameTop("reflex")}
        <div class="game-body">
          <h1 class="display">${t("pickDuel")}</h1>
          <div class="chips pickable">
            ${SD.players().map((n, i) => `<button class="pchip ${duo.includes(n) ? "on" : ""}" data-act="p" data-i="${i}" aria-pressed="${duo.includes(n)}">${esc(n)}</button>`).join("")}
          </div>
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="go" ${duo.length === 2 ? "" : "disabled"}>${t("start")}</button></div>`, { cls: "game" });
      SD.bind(app, {
        ...SD.topHandlers("reflex"),
        p: (e, el) => {
          const n = SD.players()[+el.dataset.i];
          duo = duo.includes(n) ? duo.filter(x => x !== n) : [...duo, n].slice(-2);
          pick();
        },
        go: duel
      });
    };

    const duel = () => {
      let phase = "wait", timer = null;
      const app = SD.render(`
        <div class="duel wait">
          <button class="half top" data-side="0"><span class="dname">${esc(duo[0])}</span><span class="dmsg">${t("wait")}</span></button>
          <button class="half bottom" data-side="1"><span class="dname">${esc(duo[1])}</span><span class="dmsg">${t("wait")}</span></button>
        </div>`, { cls: "game fullbleed", awake: true });
      const box = app.querySelector(".duel");
      const msgs = app.querySelectorAll(".dmsg");
      const setMsg = s => msgs.forEach(m => (m.textContent = s));
      const finish = (loserIdx, why) => {
        phase = "done"; clearTimeout(timer);
        const loser = duo[loserIdx], winner = duo[1 - loserIdx];
        box.className = "duel done";
        app.querySelectorAll(".half").forEach((h, i) => {
          h.classList.add(i === loserIdx ? "lost" : "won");
          h.querySelector(".dmsg").textContent = i === loserIdx ? (why || t("loses", { name: loser })) : t("wins", { name: winner });
        });
        SD.bad();
        SD.later(() => SD.runQuiz([loser], { onContinue: duel }), 1600);
      };
      app.querySelectorAll(".half").forEach(h => h.addEventListener("pointerdown", e => {
        e.preventDefault();
        const side = +h.dataset.side;
        if (phase === "wait") finish(side, t("falseStart"));
        else if (phase === "go") { SD.good(); finish(1 - side); }
      }));
      timer = setTimeout(() => { phase = "go"; box.className = "duel go"; setMsg(t("tapNow")); SD.beep(880, .12, "square", .12); SD.buzz(40); }, 1500 + Math.random() * 3500);
      SD.cleanup = () => clearTimeout(timer);
    };

    SD.addGame({ id: "reflex", mode: "one", min: 2, start });
  })();
})();
