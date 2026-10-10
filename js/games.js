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
    // mode : "letters" (mot qui commence par…), "exact" (… avec un nombre de lettres précis), "cat" (catégorie)
    let mode = SD.load("bombMode", "letters"), prompt = null;
    const newPrompt = () => {
      const lang = SD.state.lang;
      if (mode === "cat") {
        const list = SD.BOMB[lang] || SD.BOMB.fr; let c;
        do c = SD.pick(list); while (prompt && c === prompt.cat && list.length > 1);
        prompt = { cat: c };
      } else {
        const P = SD.PREFIX[lang] || SD.PREFIX.fr;
        const pool = mode === "exact" ? P.short : P.short.concat(P.long);
        let l; do l = SD.pick(pool); while (prompt && l === prompt.letters && pool.length > 1);
        prompt = { letters: l, len: mode === "exact" ? SD.pick([4, 5, 6]) : 0 };
      }
    };
    const promptHtml = (big) => {
      if (prompt.cat) return `<h1 class="display category">${esc(prompt.cat)}</h1>`;
      const tiles = prompt.letters.split("").map(c => `<span class="tile">${esc(c)}</span>`).join("")
        + (prompt.len ? `<span class="tile empty"></span>`.repeat(Math.max(0, prompt.len - prompt.letters.length)) : `<span class="tile more">…</span>`);
      return `<div class="tiles ${big ? "big" : ""}" aria-label="${esc(prompt.letters)}">${tiles}</div>
        <p class="prompt-sub">${prompt.len ? t("bombExact", { n: prompt.len }) : t("bombStarts")}</p>`;
    };
    const start = () => { newPrompt(); ready(); };

    const ready = () => {
      const seg = [["letters", t("bombModeLetters")], ["exact", t("bombModeExact")], ["cat", t("bombModeCat")]];
      const app = SD.render(`
        ${SD.gameTop("bomb")}
        <div class="game-body">
          <div class="seg" role="group">${seg.map(([v, l]) => `<button class="${v === mode ? "on" : ""}" data-act="mode" data-v="${v}" aria-pressed="${v === mode}">${l}</button>`).join("")}</div>
          <p class="eyebrow">${t("holder")} <strong>${esc(SD.current())}</strong></p>
          ${promptHtml(true)}
          <button class="btn link" data-act="again">${prompt.cat ? t("newCategory") : t("newLetters")}</button>
          <div class="bomb idle" aria-hidden="true"><span class="fuse"></span></div>
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="go">${t("lightFuse")}</button></div>`, { cls: "game", awake: true });
      SD.bind(app, {
        ...SD.topHandlers("bomb"),
        mode: (e, el) => { mode = el.dataset.v; SD.save("bombMode", mode); prompt = null; newPrompt(); ready(); },
        again: () => { newPrompt(); ready(); },
        go: run
      });
    };

    const run = () => {
      const total = 20000 + Math.random() * 30000;
      const t0 = performance.now();
      let tick = null, alive = true, refiler = null;
      const app = SD.render(`
        <header class="game-top"><span></span><span class="eyebrow">${t("g_bomb")}</span><span></span></header>
        <div class="game-body bomb-run">
          <div id="prompt">${promptHtml(false)}</div>
          <p class="eyebrow">${t("holder")}</p>
          <h1 class="display huge" id="holder">${esc(SD.current())}</h1>
          <div class="bomb lit" aria-hidden="true"><span class="fuse"></span></div>
          <div class="refile-box" id="refile" hidden>
            <p class="lead" id="refileTxt"></p>
            <div class="row-btns">
              <button class="btn bad" data-act="rfNo">${t("refileNo")}</button>
              <button class="btn good" data-act="rfYes">${t("refileYes")}</button>
            </div>
          </div>
        </div>
        <div class="bomb-actions" id="bombBtns">
          <button class="refile-zone" data-act="refile">${t("refile")}</button>
          <button class="pass-zone" data-act="pass">${t("pass")}</button>
        </div>`, { cls: "game", awake: true });
      const holderEl = app.querySelector("#holder"), bombEl = app.querySelector(".bomb");
      const box = app.querySelector("#refile"), btns = app.querySelector("#bombBtns");
      const pop = () => { holderEl.textContent = SD.current(); holderEl.classList.remove("pop"); void holderEl.offsetWidth; holderEl.classList.add("pop"); };
      const loop = () => {
        if (!alive) return;
        const p = (performance.now() - t0) / total;
        if (p >= 1) return explode();
        SD.beep(p > .75 ? 1100 : 880, .04, "square", .08);
        bombEl.classList.remove("tick"); void bombEl.offsetWidth; bombEl.classList.add("tick");
        tick = setTimeout(loop, Math.max(140, 900 - p * 760));
      };
      const finish = (loser, title) => {
        alive = false; clearTimeout(tick);
        const a = SD.render(`
          <div class="center-stack boom">
            <h1 class="display mega">${title}</h1>
            <p class="lead"><strong>${esc(loser)}</strong></p>
            <button class="btn primary xl" data-act="quiz">${t("quizTime")}</button>
          </div>`, { cls: "game exploded", awake: true });
        SD.bind(a, { quiz: () => { SD.state.turn = (SD.players().indexOf(loser) + 1) % SD.players().length; SD.runQuiz([loser], { onContinue: () => { newPrompt(); ready(); } }); } });
      };
      const explode = () => { SD.boomSound(); SD.buzz([400, 100, 400]); finish(SD.current(), t("boom")); };
      SD.bind(app, {
        pass: () => { if (!alive) return; SD.nextTurn(); pop(); SD.beep(500, .05); SD.buzz(15); },
        refile: () => {
          if (!alive) return;
          refiler = SD.current(); SD.nextTurn(); pop(); SD.beep(380, .08);
          app.querySelector("#refileTxt").innerHTML = t("refileAsk", { a: `<strong>${esc(refiler)}</strong>`, b: `<strong>${esc(SD.current())}</strong>` });
          box.hidden = false; btns.hidden = true;
        },
        rfYes: () => { if (!alive) return; SD.bad(); finish(refiler, t("refiled")); },
        rfNo: () => {
          if (!alive) return;
          refiler = null; box.hidden = true; btns.hidden = false;
          newPrompt(); app.querySelector("#prompt").innerHTML = promptHtml(false); SD.beep(700, .06);
        }
      });
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
  /* ================= Memory ================= */
  (function () {
    const FACES = ["🍺", "🍷", "🍸", "🍹", "🥂", "🍾", "🥃", "🍋", "🍒", "🍕", "🎲", "🎯", "🎸", "🎉", "🌶️", "🧊"];
    let cards, scores, order, cur, open, lock;
    const start = () => {
      const n = SD.players().length;
      const pairs = n <= 4 ? 8 : 10;
      const faces = SD.shuffle(FACES).slice(0, pairs);
      cards = SD.shuffle(faces.concat(faces)).map(f => ({ f, up: false, done: false }));
      order = SD.players().map((_, i) => SD.players()[(SD.state.turn + i) % n]);
      scores = Object.fromEntries(order.map(p => [p, 0]));
      cur = 0; open = []; lock = false;
      draw();
    };
    const draw = () => {
      const cols = cards.length === 16 ? 4 : 5;
      const app = SD.render(`
        ${SD.gameTop("memory")}
        <div class="game-body mem-body">
          <div class="scoreboard">${order.map((p, i) => `<span class="score ${i === cur ? "on" : ""}">${esc(p)} <b>${scores[p]}</b></span>`).join("")}</div>
          <p class="turn">${t("turnOf")} <strong>${esc(order[cur])}</strong></p>
          <div class="mem-grid" style="--cols:${cols}">
            ${cards.map((c, i) => `<button class="mcard ${c.up || c.done ? "up" : ""} ${c.done ? "done" : ""}" data-i="${i}" aria-label="${c.up || c.done ? c.f : "?"}"><span class="mface">${c.up || c.done ? c.f : ""}</span></button>`).join("")}
          </div>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, SD.topHandlers("memory"));
      app.querySelectorAll(".mcard").forEach(b => b.addEventListener("click", () => flip(+b.dataset.i)));
    };
    const flip = i => {
      const c = cards[i];
      if (lock || c.up || c.done) return;
      c.up = true; open.push(i); SD.beep(600, .04); draw();
      if (open.length < 2) return;
      const [a, b] = open.map(k => cards[k]);
      lock = true;
      if (a.f === b.f) {
        SD.later(() => {
          a.done = b.done = true; a.up = b.up = false; open = []; lock = false;
          scores[order[cur]]++; SD.good();
          if (cards.every(x => x.done)) return end();
          draw();
        }, 500);
      } else {
        SD.later(() => { a.up = b.up = false; open = []; lock = false; cur = (cur + 1) % order.length; SD.beep(300, .06); draw(); }, 1000);
      }
    };
    const end = () => {
      const min = Math.min(...order.map(p => scores[p]));
      const losers = order.filter(p => scores[p] === min);
      SD.bad();
      const app = SD.render(`
        ${SD.gameTop("memory")}
        <div class="center-stack">
          <p class="eyebrow">${t("results")}</p>
          <div class="result-list">${order.slice().sort((x, y) => scores[y] - scores[x]).map(p => `<div class="rrow ${losers.includes(p) ? "lose" : ""}"><span>${esc(p)}</span><b>${scores[p]}</b></div>`).join("")}</div>
          <h1 class="display">${t("quizQueue", { names: losers.map(n => `<span class="hl">${esc(n)}</span>`).join(", ") })}</h1>
          <button class="btn primary xl" data-act="quiz">${t("quizTime")}</button>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("memory"), quiz: () => { SD.nextTurn(); SD.runQuiz(losers, { onContinue: start }); } });
    };
    SD.addGame({ id: "memory", mode: "one", min: 2, start });
  })();

  /* ================= Pioche ou Stop (inspiré de Flip 7) ================= */
  (function () {
    const BONUS = 15;
    const newDeck = () => { const d = [0]; for (let v = 1; v <= 12; v++) for (let k = 0; k < v; k++) d.push(v); return SD.shuffle(d); };
    let rounds = SD.load("pushRounds", 3);
    let deck, players, round, order, idx, hands, state, totals;
    const drawCard = () => { if (!deck.length) deck = newDeck(); return deck.pop(); };
    const sum = h => h.reduce((a, b) => a + b, 0);
    const roundScore = q => state[q] === "bust" || !hands[q] ? 0 : sum(hands[q]) + (state[q] === "seven" ? BONUS : 0);

    const start = () => {
      const app = SD.render(`
        ${SD.gameTop("push")}
        <div class="game-body">
          <h1 class="display">${t("g_push")}</h1>
          <p class="lead">${t("g_push_d")}</p>
          <div class="field"><span class="label">${t("nbRounds")}</span>
            <div class="seg" role="group">${[1, 3, 5].map(v => `<button class="${v === rounds ? "on" : ""}" data-act="r" data-v="${v}" aria-pressed="${v === rounds}">${v}</button>`).join("")}</div></div>
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="go">${t("start")}</button></div>`, { cls: "game" });
      SD.bind(app, {
        ...SD.topHandlers("push"),
        r: (e, el) => { rounds = +el.dataset.v; SD.save("pushRounds", rounds); start(); },
        go: newMatch
      });
    };
    const newMatch = () => {
      const n = SD.players().length;
      players = SD.players().map((_, i) => SD.players()[(SD.state.turn + i) % n]);
      totals = Object.fromEntries(players.map(p => [p, 0]));
      deck = newDeck(); round = 0;
      newRound();
    };
    const newRound = () => {
      // Le premier joueur change à chaque manche
      order = players.map((_, i) => players[(round + i) % players.length]);
      hands = {}; state = {}; idx = 0;
      handoff();
    };
    const board = () => `<div class="result-list small">${players.slice().sort((x, y) => totals[y] - totals[x]).map(q => {
      const r = state[q] ? (state[q] === "bust" ? t("busted") : "+" + roundScore(q)) : "";
      return `<div class="rrow ${state[q] === "bust" ? "lose" : ""}"><span>${esc(q)}${r ? ` <small>${r}</small>` : ""}</span><b>${totals[q] + (state[q] ? roundScore(q) : 0)}</b></div>`;
    }).join("")}</div>`;
    const handoff = () => {
      const p = order[idx];
      const app = SD.render(`
        ${SD.gameTop("push")}
        <div class="center-stack">
          <p class="eyebrow">${t("roundN", { i: round + 1, n: rounds })}</p>
          ${board()}
          <p class="eyebrow">${t("turnOf")}</p>
          <h1 class="display huge">${esc(p)}</h1>
          <button class="btn primary xl" data-act="go">${t("itsMe")}</button>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("push"), go: () => { hands[p] = []; turn(); } });
    };
    const turn = (last, msg) => {
      const p = order[idx], h = hands[p];
      const app = SD.render(`
        ${SD.gameTop("push")}
        <div class="game-body">
          <p class="eyebrow">${t("roundN", { i: round + 1, n: rounds })} · ${t("totalSoFar", { n: totals[p] })}</p>
          <p class="turn"><strong>${esc(p)}</strong></p>
          <div class="push-total"><span class="label">${t("thisRound")}</span><b class="tabnum">${msg === "bust" ? 0 : sum(h) + (msg === "seven" ? BONUS : 0)}</b></div>
          <div class="push-hand">${h.map((v, i) => `<span class="ncard ${i === h.length - 1 && last != null ? "flip-in" : ""} ${msg === "bust" && v === last ? "bust" : ""}">${v}</span>`).join("") || `<span class="hint">${t("drawFirst")}</span>`}</div>
          <p class="hint tabnum">${t("uniqueCount", { n: new Set(h).size })}</p>
          <p class="verdict ${msg === "bust" ? "bad" : msg === "seven" ? "good" : ""}" aria-live="polite">${msg === "bust" ? t("bustMsg", { n: last }) : msg === "seven" ? t("sevenMsg", { n: BONUS }) : "&nbsp;"}</p>
        </div>
        <div class="actions">
          ${msg ? `<button class="btn primary xl wide" data-act="next">${t("next")}</button>`
                : `<button class="btn ghost xl" data-act="stop" ${h.length ? "" : "disabled"}>${t("stop")}</button>
                   <button class="btn primary xl" data-act="hit">${t("draw")}</button>`}
        </div>`, { cls: "game", awake: true });
      SD.bind(app, {
        ...SD.topHandlers("push"),
        hit: () => {
          const v = drawCard();
          if (h.includes(v)) { h.push(v); state[p] = "bust"; SD.bad(); return turn(v, "bust"); }
          h.push(v); SD.beep(500 + v * 30, .05);
          if (new Set(h).size >= 7) { state[p] = "seven"; SD.good(); return turn(v, "seven"); }
          turn(v);
        },
        stop: () => { state[p] = "stop"; SD.beep(700, .06); after(); },
        next: () => after()
      });
    };
    const after = () => {
      const p = order[idx];
      // 7 numéros différents : la manche s'arrête, ceux qui n'ont pas joué marquent 0
      if (state[p] !== "seven" && ++idx < order.length) return handoff();
      order.forEach(q => { if (!state[q]) state[q] = "skip"; });
      players.forEach(q => { totals[q] += roundScore(q); });
      round++;
      if (round < rounds) return roundEnd(state[p] === "seven" ? p : null);
      end();
    };
    const roundEnd = sevenBy => {
      const app = SD.render(`
        ${SD.gameTop("push")}
        <div class="center-stack">
          <p class="eyebrow">${sevenBy ? t("sevenBy", { name: esc(sevenBy) }) : t("roundOver", { i: round })}</p>
          <div class="result-list">${players.slice().sort((x, y) => totals[y] - totals[x]).map(q => `<div class="rrow"><span>${esc(q)}</span><b>${totals[q]}</b></div>`).join("")}</div>
          <button class="btn primary xl" data-act="go">${t("nextRound", { i: round + 1, n: rounds })}</button>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("push"), go: newRound });
    };
    const end = () => {
      const min = Math.min(...players.map(q => totals[q]));
      const losers = players.filter(q => totals[q] === min);
      SD.bad();
      const app = SD.render(`
        ${SD.gameTop("push")}
        <div class="center-stack">
          <p class="eyebrow">${t("results")}</p>
          <div class="result-list">${players.slice().sort((x, y) => totals[y] - totals[x]).map(q => `<div class="rrow ${losers.includes(q) ? "lose" : ""}"><span>${esc(q)}</span><b>${totals[q]}</b></div>`).join("")}</div>
          <h1 class="display">${t("quizQueue", { names: losers.map(n => `<span class="hl">${esc(n)}</span>`).join(", ") })}</h1>
          <button class="btn primary xl" data-act="quiz">${t("quizTime")}</button>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("push"), quiz: () => { SD.nextTurn(); SD.runQuiz(losers, { onContinue: newMatch }); } });
    };
    SD.addGame({ id: "push", mode: "one", min: 2, start });
  })();
})();
