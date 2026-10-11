/* SmartDrinkers — versions en ligne : Chrono, Réflexe, Pioche ou Stop, La Bombe, L'Intrus, Quiz Synchro */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc, O = SD.online;
  if (!O) return;

  const fmt = ms => (ms / 1000).toFixed(2).replace(".", SD.state.lang === "fr" ? "," : ".");
  const doneCount = (c, map) => c.online.filter(p => map && map[p.uid] != null).length;
  const allDone = (c, map) => c.online.length > 0 && c.online.every(p => map && map[p.uid] != null);
  const progressList = (c, map, label) => `<div class="player-list">${c.online.map(p => `<span class="pl ${map && map[p.uid] != null ? "" : "off"}"><i></i>${esc(p.name)}${map && map[p.uid] != null && label ? ` <small>${label(map[p.uid])}</small>` : ""}</span>`).join("")}</div>`;
  const loserText = (c, losers) => `<h1 class="display">${t("quizQueue", { names: losers.map(u => `<span class="hl">${esc(c.name(u))}</span>`).join(", ") })}</h1>`;
  const endScreen = (c, title, rows, losers) => {
    const app = SD.render(O.frame(c, `<p class="eyebrow">${title}</p>${rows}${losers.length ? loserText(c, losers) : ""}<div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game", awake: true });
    SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
  };
  const rows = (list, losers, val) => `<div class="result-list">${list.map(([u, name]) => `<div class="rrow ${losers.includes(u) ? "lose" : ""}"><span>${esc(name)}</span><b>${val(u)}</b></div>`).join("")}</div>`;

  /* ================= Chrono ================= */
  O.games.ochrono = {
    start: () => ({ phase: "play", target: 1 + Math.floor(Math.random() * 10), res: null }),
    view: c => {
      const s = c.state, res = s.res || {};
      if (s.phase === "play" && c.isHost && allDone(c, res)) return c.setState({ phase: "end" });
      if (s.phase === "end") {
        const diff = u => Math.abs(res[u] - s.target * 1000);
        const done = c.players.filter(p => res[p.uid] != null);
        const max = Math.max(...done.map(p => diff(p.uid)));
        const losers = done.filter(p => diff(p.uid) === max).map(p => p.uid);
        const list = done.slice().sort((a, b) => diff(a.uid) - diff(b.uid)).map(p => [p.uid, p.name]);
        return endScreen(c, t("chResults", { n: s.target }), rows(list, losers, u => `${fmt(res[u])} s <small>(±${fmt(diff(u))})</small>`), losers);
      }
      const mine = res[c.uid];
      if (mine != null) {
        const app = SD.render(O.frame(c, `
          <div class="chrono-target"><span class="label">${t("chTarget")}</span><b>${s.target} s</b></div>
          <p class="lead tabnum">${t("yourTime", { v: fmt(mine) })} · ${t("chDiff", { d: fmt(Math.abs(mine - s.target * 1000)) })}</p>
          <p class="hint">${t("waitingOthers", { n: doneCount(c, res), m: c.online.length })}</p>
          ${progressList(c, res)}`, c.isHost ? `<button class="btn ghost xl wide" data-act="finish">${t("endNow")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), finish: () => c.setState({ phase: "end" }) });
      }
      const app = SD.render(O.frame(c, `
        <div class="chrono-target"><span class="label">${t("chTarget")}</span><b>${s.target} s</b></div>
        <p class="hint">${t("chHelp")}</p>`) + `<button class="chrono-zone" data-act="go">${t("chStart")}</button>`, { cls: "game", awake: true });
      SD.bind(app, {
        ...O.baseHandlers(c),
        go: () => {
          c.hold();
          const t0 = performance.now(); SD.beep(880, .08);
          const a = SD.render(`<header class="game-top"><span></span><span class="eyebrow">${t("chTarget")} ${s.target} s</span><span></span></header>
            <div class="game-body"><div class="chrono-run" aria-hidden="true"><span></span><span></span><span></span></div></div>
            <button class="chrono-zone stop" id="stopBtn">${t("chStop")}</button>`, { cls: "game", awake: true });
          a.querySelector("#stopBtn").addEventListener("pointerdown", e => {
            e.preventDefault();
            const ms = Math.round(performance.now() - t0); SD.beep(520, .06); SD.buzz(30);
            c.setState({ ["res/" + c.uid]: ms }).then(() => c.release(), () => c.release());
          }, { once: true });
        }
      });
    }
  };

  /* ================= Réflexe ================= */
  O.games.oreflex = {
    start: c => ({ phase: "wait", go: c.now() + 4000 + Math.floor(Math.random() * 4000), res: null }),
    view: c => {
      const s = c.state, res = s.res || {};
      if (s.phase === "wait" && c.isHost && allDone(c, res)) return c.setState({ phase: "end" });
      const label = v => v >= 99999 ? t("falseStart") : `${v} ms`;
      if (s.phase === "end") {
        const done = c.players.filter(p => res[p.uid] != null);
        const max = Math.max(...done.map(p => res[p.uid]));
        const losers = done.filter(p => res[p.uid] === max).map(p => p.uid);
        const list = done.slice().sort((a, b) => res[a.uid] - res[b.uid]).map(p => [p.uid, p.name]);
        return endScreen(c, t("results"), rows(list, losers, u => label(res[u])), losers);
      }
      if (res[c.uid] != null) {
        const app = SD.render(O.frame(c, `
          <h1 class="display mega tabnum">${res[c.uid] >= 99999 ? t("falseStart") : res[c.uid] + '<span class="of"> ms</span>'}</h1>
          <p class="hint">${t("waitingOthers", { n: doneCount(c, res), m: c.online.length })}</p>
          ${progressList(c, res, label)}`, c.isHost ? `<button class="btn ghost xl wide" data-act="finish">${t("endNow")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), finish: () => c.setState({ phase: "end" }) });
      }
      // Écran plein : rouge en attendant, vert au signal. Chaque téléphone mesure son propre temps de réaction.
      c.hold();
      let phase = "wait", greenAt = 0;
      const app = SD.render(`<div class="duel solo wait"><button class="half" id="tap"><span class="dname">${esc(c.me.name || "")}</span><span class="dmsg">${t("wait")}</span></button></div>`, { cls: "game fullbleed", awake: true });
      const box = app.querySelector(".duel"), msg = app.querySelector(".dmsg");
      const delay = Math.max(800, s.go - c.now());
      const timer = setTimeout(() => { phase = "go"; greenAt = performance.now(); box.className = "duel solo go"; msg.textContent = t("tapNow"); SD.beep(880, .12, "square", .12); SD.buzz(40); }, delay);
      SD.cleanup = () => clearTimeout(timer);
      app.querySelector("#tap").addEventListener("pointerdown", e => {
        e.preventDefault();
        if (phase === "done") return;
        const v = phase === "go" ? Math.round(performance.now() - greenAt) : 99999;
        phase = "done"; clearTimeout(timer);
        v >= 99999 ? SD.bad() : SD.good();
        c.setState({ ["res/" + c.uid]: v }).then(() => c.release(), () => c.release());
      });
    }
  };

  /* ================= Pioche ou Stop ================= */
  const newDeck = () => { const d = [0]; for (let v = 1; v <= 12; v++) for (let k = 0; k < v; k++) d.push(v); return SD.shuffle(d); };
  O.games.opush = {
    options: [{ k: "rounds", def: 3, label: () => t("nbRounds"), choices: () => [[1, "1"], [3, "3"], [5, "5"]] }],
    start: c => ({ phase: "play", round: 1, rounds: +O.opt(c, "rounds", 3), done: null, totals: null }),
    view: c => {
      const s = c.state, done = s.done || {}, totals = s.totals || {};
      const sum = h => h.reduce((a, b) => a + b, 0);
      if (s.phase === "play" && c.isHost && allDone(c, done)) {
        const nt = { ...totals }; c.players.forEach(p => { nt[p.uid] = (nt[p.uid] || 0) + ((done[p.uid] || {}).pts || 0); });
        return c.setState({ phase: s.round >= s.rounds ? "end" : "roundEnd", totals: nt });
      }
      if (s.phase === "end") {
        const min = Math.min(...c.players.map(p => totals[p.uid] || 0));
        const losers = c.players.filter(p => (totals[p.uid] || 0) === min).map(p => p.uid);
        return endScreen(c, t("results"), O.scoreList(c, totals, losers), losers);
      }
      if (s.phase === "roundEnd") {
        const app = SD.render(O.frame(c, `<p class="eyebrow">${t("roundOver", { i: s.round })}</p>
          <div class="result-list">${c.players.slice().sort((a, b) => (totals[b.uid] || 0) - (totals[a.uid] || 0)).map(p => { const d = done[p.uid] || {}; return `<div class="rrow ${d.bust ? "lose" : ""}"><span>${esc(p.name)} <small>${d.bust ? t("busted") : "+" + (d.pts || 0)}</small></span><b>${totals[p.uid] || 0}</b></div>`; }).join("")}</div>
          ${c.isHost ? "" : `<p class="hint">${t("waitHost")}</p>`}`,
          c.isHost ? `<button class="btn primary xl wide" data-act="nextR">${t("nextRound", { i: s.round + 1, n: s.rounds })}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), nextR: () => c.setState({ phase: "play", round: s.round + 1, done: null }) });
      }
      const L = c.local();
      if (L.round !== s.round) { L.round = s.round; L.hand = []; L.deck = newDeck(); L.msg = null; }
      const mine = done[c.uid];
      if (mine) {
        const app = SD.render(O.frame(c, `
          <p class="eyebrow">${t("roundN", { i: s.round, n: s.rounds })}</p>
          <div class="push-total"><span class="label">${t("thisRound")}</span><b class="tabnum">${mine.pts}</b></div>
          <div class="push-hand">${L.hand.map(v => `<span class="ncard">${v}</span>`).join("")}</div>
          <p class="hint">${t("waitingOthers", { n: doneCount(c, done), m: c.online.length })}</p>
          ${progressList(c, done, d => d.bust ? t("busted") : "+" + d.pts)}`), { cls: "game", awake: true });
        return SD.bind(app, O.baseHandlers(c));
      }
      const h = L.hand;
      const app = SD.render(O.frame(c, `
        <p class="eyebrow">${t("roundN", { i: s.round, n: s.rounds })} · ${t("totalSoFar", { n: totals[c.uid] || 0 })}</p>
        <div class="push-total"><span class="label">${t("thisRound")}</span><b class="tabnum">${sum(h)}</b></div>
        <div class="push-hand">${h.map((v, i) => `<span class="ncard ${i === h.length - 1 ? "flip-in" : ""}">${v}</span>`).join("") || `<span class="hint">${t("drawFirst")}</span>`}</div>
        <p class="hint tabnum">${t("uniqueCount", { n: new Set(h).size })}</p>
        ${progressList(c, done, d => d.bust ? t("busted") : "+" + d.pts)}`,
        `<button class="btn ghost xl" data-act="stop" ${h.length ? "" : "disabled"}>${t("stop")}</button><button class="btn primary xl" data-act="hit">${t("draw")}</button>`), { cls: "game", awake: true });
      const finish = (pts, bust, seven) => c.setState({ ["done/" + c.uid]: { pts, bust: !!bust, seven: !!seven } });
      SD.bind(app, {
        ...O.baseHandlers(c),
        hit: () => {
          if (!L.deck.length) L.deck = newDeck();
          const v = L.deck.pop();
          if (h.includes(v)) { h.push(v); SD.bad(); SD.toast(t("bustMsg", { n: v })); return finish(0, true); }
          h.push(v); SD.beep(500 + v * 30, .05);
          if (new Set(h).size >= 7) { SD.good(); SD.toast(t("sevenMsg", { n: 15 })); return finish(sum(h) + 15, false, true); }
          c.render();
        },
        stop: () => { SD.beep(700, .06); finish(sum(h)); }
      });
    }
  };

  /* ================= La Bombe ================= */
  const bombPrompt = mode => {
    if (mode === "cat") return { cat: Math.floor(Math.random() * SD.BOMB.fr.length) };
    const P = SD.PREFIX[SD.state.lang] || SD.PREFIX.fr;
    const pool = mode === "exact" ? P.short : P.short.concat(P.long);
    return { letters: SD.pick(pool), len: mode === "exact" ? SD.pick([4, 5, 6]) : 0 };
  };
  const promptHtml = pr => {
    if (pr.cat != null) return `<h1 class="display category">${esc((SD.BOMB[SD.state.lang] || SD.BOMB.fr)[pr.cat])}</h1>`;
    const tiles = pr.letters.split("").map(ch => `<span class="tile">${esc(ch)}</span>`).join("") + (pr.len ? `<span class="tile empty"></span>`.repeat(Math.max(0, pr.len - pr.letters.length)) : `<span class="tile more">…</span>`);
    return `<div class="tiles big">${tiles}</div><p class="prompt-sub">${pr.len ? t("bombExact", { n: pr.len }) : t("bombStarts")}</p>`;
  };
  O.games.obomb = {
    options: [{ k: "bomb", def: "letters", label: () => t("ctMode"), choices: () => [["letters", t("bombModeLetters")], ["exact", t("bombModeExact")], ["cat", t("bombModeCat")]] }],
    start: c => {
      const mode = O.opt(c, "bomb", "letters");
      const first = SD.pick(c.online).uid;
      return { phase: "run", mode, holder: first, prompt: bombPrompt(mode), ends: c.now() + 25000 + Math.floor(Math.random() * 30000), refile: null, loser: null };
    },
    view: c => {
      const s = c.state;
      if (s.phase === "boom") {
        const losers = [s.loser];
        SD.boomSound(); SD.buzz([400, 100, 400]);
        const app = SD.render(O.frame(c, `<h1 class="display mega">${s.refiled ? t("refiled") : t("boom")}</h1>${loserText(c, losers)}<div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game exploded", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
      }
      const me = s.holder === c.uid;
      const left = s.ends - c.now();
      // L'hôte fait exploser la bombe à l'heure prévue ; chaque téléphone affiche l'explosion localement aussi
      let timer = null, tick = null;
      if (left <= 0) { if (c.isHost) c.setState({ phase: "boom", loser: s.holder }); }
      else timer = setTimeout(() => { if (c.isHost) c.setState({ phase: "boom", loser: (O.room.data.state || {}).holder }); }, left + 300);
      const others = c.online.filter(p => p.uid !== c.uid);
      const rf = s.refile;
      let body, actions = "";
      if (rf && rf.to === c.uid) {
        body = `${promptHtml(s.prompt)}<p class="lead">${t("refileAsk", { a: `<strong>${esc(c.name(rf.from))}</strong>`, b: `<strong>${esc(c.me.name || "")}</strong>` })}</p>`;
        actions = `<button class="btn bad xl" data-act="rfNo">${t("refileNo")}</button><button class="btn good xl" data-act="rfYes">${t("refileYes")}</button>`;
      } else if (me && !rf) {
        body = `${promptHtml(s.prompt)}<div class="bomb lit" aria-hidden="true"><span class="fuse"></span></div>
          <p class="eyebrow">${t("throwTo")}</p>
          <div class="vote-grid">${others.map(p => `<button class="vote" data-act="throw" data-u="${p.uid}">${esc(p.name)}</button>`).join("")}</div>
          <label class="check"><input type="checkbox" id="rfMode"> ${t("refileMode")}</label>`;
      } else {
        body = `${promptHtml(s.prompt)}<p class="eyebrow">${t("holder")}</p><h1 class="display huge">${esc(c.name(rf ? rf.to : s.holder))}</h1>
          <div class="bomb lit" aria-hidden="true"><span class="fuse"></span></div>${rf ? `<p class="hint">${t("refileWait", { a: esc(c.name(rf.from)) })}</p>` : ""}`;
      }
      const app = SD.render(O.frame(c, body, actions), { cls: "game", awake: true });
      if (me || (rf && rf.to === c.uid)) {
        const loop = () => { const l = s.ends - c.now(); if (l <= 0) return; SD.beep(l < 6000 ? 1100 : 880, .04, "square", .08); SD.buzz(15); tick = setTimeout(loop, Math.max(150, Math.min(900, l / 12))); };
        loop();
      }
      SD.cleanup = () => { clearTimeout(timer); clearTimeout(tick); };
      SD.bind(app, {
        ...O.baseHandlers(c),
        throw: (e, el) => {
          const refile = app.querySelector("#rfMode") && app.querySelector("#rfMode").checked;
          SD.beep(500, .05);
          if (refile) c.setState({ refile: { from: c.uid, to: el.dataset.u } });
          else c.setState({ holder: el.dataset.u });
        },
        rfYes: () => c.setState({ phase: "boom", loser: rf.from, refiled: true }),
        rfNo: () => c.setState({ holder: c.uid, refile: null, prompt: bombPrompt(s.mode) })
      });
    }
  };

  /* ================= L'Intrus ================= */
  O.games.ointrus = {
    start: c => {
      const ids = SD.shuffle(c.online.map(p => p.uid));
      const nImp = ids.length >= 7 ? 2 : 1;
      const imps = {}; ids.slice(0, nImp).forEach(u => (imps[u] = true));
      return { phase: "words", pair: Math.floor(Math.random() * SD.WORDS.length), swap: Math.random() < .5, imps, votes: null };
    },
    view: c => {
      const s = c.state, votes = s.votes || {}, imps = s.imps || {};
      const pair = SD.WORDS[s.pair];
      const w = SD.state.lang === "en" ? [pair[2], pair[3]] : [pair[0], pair[1]];
      const civil = s.swap ? w[1] : w[0], imp = s.swap ? w[0] : w[1];
      const myWord = imps[c.uid] ? imp : civil;
      if (s.phase === "vote" && c.isHost && allDone(c, votes)) return c.setState({ phase: "end" });
      if (s.phase === "end") {
        const counts = {}; Object.values(votes).forEach(u => (counts[u] = (counts[u] || 0) + 1));
        const max = Math.max(0, ...Object.values(counts));
        const top = Object.keys(counts).filter(u => counts[u] === max);
        const caught = top.length === 1 && imps[top[0]];
        const losers = caught ? Object.keys(imps) : c.players.filter(p => !imps[p.uid]).map(p => p.uid);
        const app = SD.render(O.frame(c, `
          <p class="eyebrow">${Object.keys(imps).length > 1 ? t("impostorsWere") : t("impostorWas")}</p>
          <h1 class="display huge">${Object.keys(imps).map(u => esc(c.name(u))).join(" & ")}</h1>
          <div class="words"><div><span class="label">${t("wordCivil")}</span><strong>${esc(civil)}</strong></div><div class="imp"><span class="label">${t("wordImp")}</span><strong>${esc(imp)}</strong></div></div>
          <div class="result-list">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<div class="rrow ${imps[u] ? "lose" : ""}"><span>${esc(c.name(u))}</span><b>${t("votesN", { n })}</b></div>`).join("")}</div>
          <p class="eyebrow">${caught ? t("caught") : t("notCaught")}</p>
          ${loserText(c, losers)}<div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
      }
      if (s.phase === "vote") {
        const mine = votes[c.uid];
        const app = SD.render(O.frame(c, `
          <h1 class="display">${t("whoIsImpostor")}</h1>
          <div class="vote-grid">${c.online.filter(p => p.uid !== c.uid).map(p => `<button class="vote ${mine === p.uid ? "on" : ""}" data-act="vote" data-u="${p.uid}">${esc(p.name)}</button>`).join("")}</div>
          <p class="hint tabnum">${t("votedCount", { n: doneCount(c, votes), m: c.online.length })}</p>`,
          c.isHost ? `<button class="btn ghost xl wide" data-act="finish" ${doneCount(c, votes) ? "" : "disabled"}>${t("revealNow")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), vote: (e, el) => c.setState({ ["votes/" + c.uid]: el.dataset.u }), finish: () => c.setState({ phase: "end" }) });
      }
      const app = SD.render(O.frame(c, `
        <button class="reveal-pad" id="pad" aria-label="${t("holdReveal")}">
          <span class="cover">${t("holdReveal")}</span>
          <span class="word"><span class="label">${t("yourWord")}</span><strong>${esc(myWord)}</strong></span>
        </button>
        <p class="hint">${t("intrusTalk")}</p>`,
        c.isHost ? `<button class="btn primary xl wide" data-act="toVote">${t("goVote")}</button>` : ""), { cls: "game", awake: true });
      const pad = app.querySelector("#pad");
      pad.addEventListener("pointerdown", e => { e.preventDefault(); pad.classList.add("shown"); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(n => pad.addEventListener(n, () => pad.classList.remove("shown")));
      pad.addEventListener("contextmenu", e => e.preventDefault());
      SD.bind(app, { ...O.baseHandlers(c), toVote: () => c.setState({ phase: "vote" }) });
    }
  };

  /* ================= Quiz Synchro ================= */
  O.games.osync = {
    options: [{ k: "nq", def: 10, label: () => t("nbQuestions"), choices: () => [[5, "5"], [10, "10"], [15, "15"]] }],
    start: c => ({ phase: "play", qs: Array.from({ length: +O.opt(c, "nq", 10) }, () => O.pickQuestion()), ans: null }),
    view: c => {
      const s = c.state, ans = s.ans || {}, qs = Object.values(s.qs || {}), n = qs.length;
      const myAns = ans[c.uid] || {};
      const count = u => Object.keys(ans[u] || {}).length, score = u => Object.values(ans[u] || {}).filter(Boolean).length;
      const finished = c.online.every(p => count(p.uid) >= n);
      if (s.phase === "play" && c.isHost && finished) return c.setState({ phase: "end" });
      if (s.phase === "end") {
        const sc = {}; c.players.forEach(p => (sc[p.uid] = score(p.uid)));
        const min = Math.min(...c.players.map(p => sc[p.uid]));
        const losers = c.players.filter(p => sc[p.uid] === min).map(p => p.uid);
        return endScreen(c, t("results"), O.scoreList(c, sc, losers), losers);
      }
      const i = Object.keys(myAns).length;
      const board = `<div class="scoreboard">${c.online.map(p => `<span class="score">${esc(p.name)} <b>${count(p.uid)}/${n}</b></span>`).join("")}</div>`;
      if (i >= n) {
        const app = SD.render(O.frame(c, `<p class="eyebrow">${t("yourScore")}</p><h1 class="display mega tabnum">${score(c.uid)}<span class="of">/${n}</span></h1>
          <p class="hint">${t("waitingOthers", { n: c.online.filter(p => count(p.uid) >= n).length, m: c.online.length })}</p>${board}`,
          c.isHost ? `<button class="btn ghost xl wide" data-act="finish">${t("endNow")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), finish: () => c.setState({ phase: "end" }) });
      }
      const L = c.local();
      const revealed = L.rev === i;
      const app = SD.render(O.frame(c, `${board}
        <div class="progress"><span style="width:${(i / n) * 100}%"></span></div>
        <p class="eyebrow">${t("question", { i: i + 1, n })}</p>
        ${SD.questionCard(qs[i], revealed)}`,
        revealed ? `<button class="btn bad xl" data-act="no">${t("iWasWrong")}</button><button class="btn good xl" data-act="yes">${t("iWasRight")}</button>`
                 : `<button class="btn primary xl wide" data-act="rev">${t("showAnswer")}</button>`), { cls: "quiz", awake: true });
      const mark = ok => { L.rev = null; SD.beep(ok ? 800 : 300, .06); c.setState({ [`ans/${c.uid}/${i}`]: ok }); };
      SD.bind(app, { ...O.baseHandlers(c), rev: () => { L.rev = i; c.render(); }, yes: () => mark(true), no: () => mark(false) });
    }
  };
})();
