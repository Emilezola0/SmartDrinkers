/* SmartDrinkers — jeux de dés (421, Le Contrat) et Chrono */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc;

  /* ---------- Dés ---------- */
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  SD.dieHtml = (v, i, held, rolled) => `<button class="die ${held ? "held" : ""} ${rolled ? "roll" : ""} ${v ? "" : "blank"}" data-die="${i}" aria-label="${v || "?"}${held ? " ✓" : ""}" aria-pressed="${!!held}">
    ${v ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<span class="${PIPS[v].includes(k) ? "pip" : ""}"></span>`).join("") : "<em>?</em>"}</button>`;
  const roll = () => 1 + Math.floor(Math.random() * 6);
  const rollerHtml = (dice, held, rolledIdx) => `<div class="dice-row">${dice.map((v, i) => SD.dieHtml(v, i, held[i], rolledIdx.includes(i))).join("")}</div>`;
  const resultRows = (list, losers, val) => `<div class="result-list">${list.map(q => `<div class="rrow ${losers.includes(q) ? "lose" : ""}"><span>${esc(q)}</span><b>${val(q)}</b></div>`).join("")}</div>`;
  const endScreen = (id, title, rows, losers, again) => {
    SD.bad();
    const app = SD.render(`
      ${SD.gameTop(id)}
      <div class="center-stack">
        <p class="eyebrow">${title}</p>
        ${rows}
        <h1 class="display">${t("quizQueue", { names: losers.map(n => `<span class="hl">${esc(n)}</span>`).join(", ") })}</h1>
        <button class="btn primary xl" data-act="quiz">${t("quizTime")}</button>
      </div>`, { cls: "game", awake: true });
    SD.bind(app, { ...SD.topHandlers(id), quiz: () => { SD.nextTurn(); SD.runQuiz(losers, { onContinue: again }); } });
  };
  const handoffScreen = (id, name, extraHtml, go) => {
    const app = SD.render(`
      ${SD.gameTop(id)}
      <div class="center-stack">
        ${extraHtml || ""}
        <p class="eyebrow">${t("turnOf")}</p>
        <h1 class="display huge">${esc(name)}</h1>
        <button class="btn primary xl" data-act="go">${t("itsMe")}</button>
      </div>`, { cls: "game", awake: true });
    SD.bind(app, { ...SD.topHandlers(id), go });
  };
  const rotation = () => { const p = SD.players(), n = p.length; return p.map((_, i) => p[(SD.state.turn + i) % n]); };

  /* ================= 421 ================= */
  (function () {
    // Classement : 421 > 1-1-1 > 1-1-6 > 6-6-6 > 1-1-5 > 5-5-5 … > suites > autres > nénette (2-2-1)
    const combo = dice => {
      const s = dice.slice().sort((a, b) => b - a), k = s.join("");
      if (k === "421") return { v: 1000, n: "4-2-1" };
      if (k === "111") return { v: 870, n: t("c421Mac") };
      if (s[1] === 1 && s[2] === 1) return { v: 801 + s[0] * 10, n: `1-1-${s[0]}` };
      if (s[0] === s[1] && s[1] === s[2]) return { v: 800 + s[0] * 10, n: t("c421Brelan", { n: s[0] }) };
      if (s[0] - s[1] === 1 && s[1] - s[2] === 1) return { v: 700 + s[0], n: t("c421Suite", { s: s.join("-") }) };
      if (k === "221") return { v: 0, n: t("c421Nenette") };
      return { v: +k, n: s.join("-") };
    };
    let order, idx, maxRolls, results;
    const start = () => { order = rotation(); idx = 0; maxRolls = 3; results = {}; next(); };
    const next = () => {
      if (idx >= order.length) return end();
      const done = order.slice(0, idx).map(q => `<div class="rrow"><span>${esc(q)}</span><b>${esc(results[q].n)}</b></div>`).join("");
      handoffScreen("d421", order[idx], `${done ? `<div class="result-list small">${done}</div>` : ""}<p class="hint">${t("c421Max", { n: maxRolls })}</p>`, () => turn([0, 0, 0], [false, false, false], 0, []));
    };
    const turn = (dice, held, used, rolledIdx) => {
      const p = order[idx], left = maxRolls - used, c = used ? combo(dice) : null;
      const app = SD.render(`
        ${SD.gameTop("d421")}
        <div class="game-body">
          <p class="turn"><strong>${esc(p)}</strong></p>
          ${rollerHtml(dice, held, rolledIdx)}
          <p class="combo-name">${c ? esc(c.n) : "&nbsp;"}</p>
          <p class="hint">${used && left ? t("tapToHold") : t("rollsLeft", { n: left })}</p>
        </div>
        <div class="actions">
          <button class="btn ghost xl" data-act="keep" ${used ? "" : "disabled"}>${t("keepScore")}</button>
          <button class="btn primary xl" data-act="roll" ${left ? "" : "disabled"}>${t("rollDice")} (${left})</button>
        </div>`, { cls: "game", awake: true });
      app.querySelectorAll(".die").forEach(d => d.addEventListener("click", () => {
        if (!used || !left) return;
        const i = +d.dataset.die; held[i] = !held[i]; SD.beep(500, .03); turn(dice, held, used, []);
      }));
      SD.bind(app, {
        ...SD.topHandlers("d421"),
        roll: () => {
          const r = []; dice = dice.map((v, i) => held[i] && v ? v : (r.push(i), roll()));
          SD.beep(300 + Math.random() * 200, .05); SD.buzz(20);
          used++;
          if (used >= maxRolls) return turn(dice, [false, false, false], used, r);
          turn(dice, held, used, r);
        },
        keep: () => {
          results[p] = combo(dice);
          if (idx === 0) maxRolls = used; // le premier joueur fixe le nombre de lancers
          idx++; next();
        }
      });
    };
    const end = () => {
      const min = Math.min(...order.map(q => results[q].v));
      const losers = order.filter(q => results[q].v === min);
      const sorted = order.slice().sort((a, b) => results[b].v - results[a].v);
      endScreen("d421", t("results"), resultRows(sorted, losers, q => esc(results[q].n)), losers, start);
    };
    SD.addGame({ id: "d421", mode: "one", min: 2, start });
  })();

  /* ================= Le Contrat ================= */
  (function () {
    const counts = d => { const c = {}; d.forEach(v => (c[v] = (c[v] || 0) + 1)); return Object.values(c).sort((a, b) => b - a); };
    const has = (d, seq) => seq.every(v => d.includes(v));
    const sum = d => d.reduce((a, b) => a + b, 0);
    const CONTRACTS = [
      { id: "brelan", pts: 10, ok: d => counts(d)[0] >= 3 },
      { id: "dpaire", pts: 10, ok: d => counts(d).filter(c => c >= 2).length >= 2 },
      { id: "pair", pts: 15, ok: d => d.every(v => v % 2 === 0) },
      { id: "impair", pts: 15, ok: d => d.every(v => v % 2 === 1) },
      { id: "haut", pts: 15, ok: d => sum(d) >= 25 },
      { id: "bas", pts: 15, ok: d => sum(d) <= 12 },
      { id: "full", pts: 20, ok: d => { const c = counts(d); return c[0] === 3 && c[1] === 2; } },
      { id: "psuite", pts: 20, ok: d => has(d, [1, 2, 3, 4]) || has(d, [2, 3, 4, 5]) || has(d, [3, 4, 5, 6]) },
      { id: "carre", pts: 30, ok: d => counts(d)[0] >= 4 },
      { id: "gsuite", pts: 35, ok: d => has(d, [1, 2, 3, 4, 5]) || has(d, [2, 3, 4, 5, 6]) },
      { id: "yams", pts: 50, ok: d => counts(d)[0] === 5 }
    ];
    let mode = SD.load("contractMode", "points");
    let order, cur, owner, points;

    const start = () => {
      const app = SD.render(`
        ${SD.gameTop("contract")}
        <div class="game-body">
          <h1 class="display">${t("g_contract")}</h1>
          <p class="lead">${t("g_contract_d")}</p>
          <div class="field"><span class="label">${t("ctMode")}</span>
            <div class="seg" role="group">${[["points", t("ctModePoints")], ["contract", t("ctModeContract")]].map(([v, l]) => `<button class="${v === mode ? "on" : ""}" data-act="m" data-v="${v}" aria-pressed="${v === mode}">${l}</button>`).join("")}</div></div>
          <p class="hint">${mode === "points" ? t("ctModePointsHelp") : t("ctModeContractHelp")}</p>
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="go">${t("start")}</button></div>`, { cls: "game" });
      SD.bind(app, {
        ...SD.topHandlers("contract"),
        m: (e, el) => { mode = el.dataset.v; SD.save("contractMode", mode); start(); },
        go: newGame
      });
    };
    const newGame = () => {
      order = rotation(); cur = 0; owner = {}; points = Object.fromEntries(order.map(p => [p, 0]));
      pick();
    };
    const scoreboard = () => mode === "points"
      ? `<div class="scoreboard">${order.map((p, i) => `<span class="score ${i === cur ? "on" : ""}">${esc(p)} <b>${points[p]}</b></span>`).join("")}</div>` : "";
    const pick = () => {
      if (CONTRACTS.every(c => owner[c.id])) {
        if (mode === "points") return end();
        owner = {}; SD.toast(t("ctReset"));
      }
      const p = order[cur];
      const app = SD.render(`
        ${SD.gameTop("contract")}
        <div class="game-body ct-body">
          ${scoreboard()}
          <p class="turn">${t("turnOf")} <strong>${esc(p)}</strong></p>
          <p class="hint">${t("ctPick")}</p>
          <div class="ct-grid">
            ${CONTRACTS.map(c => {
              const o = owner[c.id];
              return `<button class="ct ${o ? "taken" : ""}" data-c="${c.id}" ${o ? "disabled" : ""}>
                <span class="ct-name">${t("ct_" + c.id)}</span>
                <span class="ct-desc">${t("ct_" + c.id + "_d")}</span>
                <span class="ct-pts">${o ? esc(o) : mode === "points" ? c.pts + " pts" : ""}</span></button>`;
            }).join("")}
          </div>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, SD.topHandlers("contract"));
      app.querySelectorAll(".ct[data-c]").forEach(b => b.addEventListener("click", () => {
        const c = CONTRACTS.find(x => x.id === b.dataset.c);
        play(c, [0, 0, 0, 0, 0], [false, false, false, false, false], 0, []);
      }));
    };
    const play = (c, dice, held, used, rolledIdx) => {
      const p = order[cur], left = 3 - used, done = used && c.ok(dice), failed = !done && used >= 3;
      const app = SD.render(`
        ${SD.gameTop("contract")}
        <div class="game-body">
          <p class="eyebrow">${esc(p)}</p>
          <div class="ct-current"><span class="ct-name">${t("ct_" + c.id)}</span><span class="ct-desc">${t("ct_" + c.id + "_d")}</span></div>
          ${rollerHtml(dice, held, rolledIdx)}
          <p class="verdict ${done ? "good" : failed ? "bad" : ""}" aria-live="polite">${done ? t("ctDone") : failed ? t("ctFailed") : "&nbsp;"}</p>
          <p class="hint">${done || failed ? "" : used ? t("tapToHold") + " · " + t("rollsLeft", { n: left }) : t("rollsLeft", { n: left })}</p>
        </div>
        <div class="actions">
          ${done || failed ? `<button class="btn primary xl wide" data-act="next">${t("next")}</button>`
                           : `<button class="btn primary xl wide" data-act="roll">${t("rollDice")} (${left})</button>`}
        </div>`, { cls: "game", awake: true });
      app.querySelectorAll(".die").forEach(d => d.addEventListener("click", () => {
        if (!used || done || failed) return;
        const i = +d.dataset.die; held[i] = !held[i]; SD.beep(500, .03); play(c, dice, held, used, []);
      }));
      SD.bind(app, {
        ...SD.topHandlers("contract"),
        roll: () => {
          const r = []; dice = dice.map((v, i) => held[i] && v ? v : (r.push(i), roll()));
          SD.beep(300 + Math.random() * 200, .05); SD.buzz(20);
          used++;
          const ok = c.ok(dice);
          if (ok) SD.good(); else if (used >= 3) SD.bad();
          play(c, dice, held, used, r);
        },
        next: () => {
          if (done) { owner[c.id] = p; if (mode === "points") points[p] += c.pts; cur = (cur + 1) % order.length; return pick(); }
          cur = (cur + 1) % order.length;
          if (mode === "contract") return SD.runQuiz([p], { onContinue: pick });
          pick();
        }
      });
    };
    const end = () => {
      const min = Math.min(...order.map(q => points[q]));
      const losers = order.filter(q => points[q] === min);
      const sorted = order.slice().sort((a, b) => points[b] - points[a]);
      endScreen("contract", t("results"), resultRows(sorted, losers, q => points[q] + " pts"), losers, newGame);
    };
    SD.addGame({ id: "contract", mode: "one", min: 2, start });
  })();

  /* ================= Chrono ================= */
  (function () {
    let target, order, idx, results;
    const start = () => { target = 1 + Math.floor(Math.random() * 10); order = rotation(); idx = 0; results = {}; next(); };
    const fmt = ms => (ms / 1000).toFixed(2).replace(".", SD.state.lang === "fr" ? "," : ".");
    const next = () => {
      if (idx >= order.length) return end();
      const done = order.slice(0, idx).map(q => `<div class="rrow"><span>${esc(q)}</span><b>${fmt(results[q])} s</b></div>`).join("");
      handoffScreen("chrono", order[idx], `<div class="chrono-target"><span class="label">${t("chTarget")}</span><b>${target} s</b></div>${done ? `<div class="result-list small">${done}</div>` : ""}`, ready);
    };
    const ready = () => {
      const app = SD.render(`
        ${SD.gameTop("chrono")}
        <div class="game-body">
          <p class="turn"><strong>${esc(order[idx])}</strong></p>
          <div class="chrono-target"><span class="label">${t("chTarget")}</span><b>${target} s</b></div>
          <p class="hint">${t("chHelp")}</p>
        </div>
        <button class="chrono-zone" data-act="go">${t("chStart")}</button>`, { cls: "game", awake: true });
      SD.bind(app, { ...SD.topHandlers("chrono"), go: run });
    };
    const run = () => {
      const t0 = performance.now();
      SD.beep(880, .08);
      const app = SD.render(`
        <header class="game-top"><span></span><span class="eyebrow">${t("chTarget")} ${target} s</span><span></span></header>
        <div class="game-body"><div class="chrono-run" aria-hidden="true"><span></span><span></span><span></span></div></div>
        <button class="chrono-zone stop" id="stopBtn">${t("chStop")}</button>`, { cls: "game", awake: true });
      const btn = app.querySelector("#stopBtn");
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        const ms = performance.now() - t0;
        results[order[idx]] = ms;
        const diff = Math.abs(ms - target * 1000);
        SD.beep(520, .06); SD.buzz(30);
        const a = SD.render(`
          ${SD.gameTop("chrono")}
          <div class="center-stack">
            <p class="eyebrow">${esc(order[idx])}</p>
            <h1 class="display mega tabnum">${fmt(ms)}<span class="of"> s</span></h1>
            <p class="lead tabnum">${t("chDiff", { d: fmt(diff) })}</p>
            <button class="btn primary xl" data-act="next">${t("next")}</button>
          </div>`, { cls: "game", awake: true });
        SD.bind(a, { ...SD.topHandlers("chrono"), next: () => { idx++; next(); } });
      }, { once: true });
    };
    const end = () => {
      const diff = q => Math.abs(results[q] - target * 1000);
      const max = Math.max(...order.map(diff));
      const losers = order.filter(q => diff(q) === max);
      const sorted = order.slice().sort((a, b) => diff(a) - diff(b));
      endScreen("chrono", t("chResults", { n: target }), resultRows(sorted, losers, q => `${fmt(results[q])} s <small>(±${fmt(diff(q))})</small>`), losers, start);
    };
    SD.addGame({ id: "chrono", mode: "one", min: 2, start });
  })();
})();
