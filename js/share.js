/* SmartDrinkers — jeux « chacun son téléphone » : code partagé, QR code, L'Intrus, Quiz Synchro */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc;

  /* ---------- Codes ----------
     IN-XXXXX-6         L'Intrus, 6 joueurs
     QS-XXXXX-10-X-ABC  Quiz Synchro, 10 questions, difficulté X/E/M/H, empreinte de la banque ABC */
  SD.parseCode = raw => {
    let s = String(raw || "").trim();
    const m = s.match(/join=([A-Za-z0-9-]+)/);
    if (m) s = m[1];
    s = s.toUpperCase().replace(/\s+/g, "");
    const p = s.split("-");
    if (p[0] === "IN" && p.length === 3 && SD.SEED_RE.test(p[1])) {
      const n = +p[2]; if (n >= 3 && n <= 12) return { game: "intrus", seed: p[1], n, code: s };
    }
    if (p[0] === "QS" && p.length === 5 && SD.SEED_RE.test(p[1])) {
      const n = +p[2]; if (n >= 1 && n <= 50 && /^[XEMH]$/.test(p[3])) return { game: "sync", seed: p[1], n, d: p[3], fp: p[4], code: s };
    }
    return null;
  };
  SD.joinUrl = code => location.href.split("#")[0].split("?")[0] + "#join=" + code;

  SD.qrSvg = text => {
    try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
    catch (e) { return ""; }
  };

  SD.openCode = (info, asHost) => {
    if (info.game === "intrus") intrusPick(info);
    else if (info.game === "sync") syncPlay(info, asHost);
  };

  /* ---------- Écran de partage (hôte) ---------- */
  const shareScreen = (id, info) => {
    const app = SD.render(`
      ${SD.gameTop(id)}
      <div class="game-body">
        <h1 class="display">${t("shareTitle")}</h1>
        <div class="qr-box">${SD.qrSvg(SD.joinUrl(info.code))}</div>
        <p class="code-line"><span class="label">${t("code")}</span><strong class="mono" id="code">${esc(info.code)}</strong>
          <button class="btn small ghost" data-act="copy">${t("copy")}</button></p>
        <p class="hint">${t("shareHelp")}</p>
      </div>
      <div class="actions"><button class="btn primary xl wide" data-act="go">${t("startMine")}</button></div>`, { cls: "game", awake: true });
    SD.bind(app, {
      ...SD.topHandlers(id),
      copy: (e, el) => {
        const done = () => { el.textContent = t("copied"); };
        try { navigator.clipboard.writeText(info.code).then(done, () => selectCode()); } catch (err) { selectCode(); }
      },
      go: () => SD.openCode(info, true)
    });
    const selectCode = () => { const r = document.createRange(); r.selectNodeContents(app.querySelector("#code")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  };

  const stepper = (id, label, val, min, max) => `
    <div class="field"><span class="label">${label}</span>
      <div class="stepper"><button class="icon-btn" data-act="${id}-" aria-label="−">−</button><output id="${id}">${val}</output><button class="icon-btn" data-act="${id}+" aria-label="+">+</button></div></div>`;
  const segmented = (id, label, opts, cur) => `
    <div class="field"><span class="label">${label}</span>
      <div class="seg" role="group">${opts.map(([v, l]) => `<button class="${v === cur ? "on" : ""}" data-act="${id}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div></div>`;

  /* ================= L'Intrus ================= */
  const intrusSetup = () => {
    let n = Math.min(12, Math.max(3, SD.players().length || 4));
    const draw = () => {
      const app = SD.render(`
        ${SD.gameTop("intrus")}
        <div class="game-body">
          <h1 class="display">${t("g_intrus")}</h1>
          <p class="lead">${t("g_intrus_d")}</p>
          ${stepper("n", t("howMany"), n, 3, 12)}
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="create">${t("create")}</button></div>`, { cls: "game" });
      SD.bind(app, {
        ...SD.topHandlers("intrus"),
        "n-": () => { n = Math.max(3, n - 1); draw(); }, "n+": () => { n = Math.min(12, n + 1); draw(); },
        create: () => shareScreen("intrus", SD.parseCode(`IN-${SD.newSeed()}-${n}`))
      });
    };
    draw();
  };

  const intrusDeal = (info, round) => {
    const r = SD.rng(`IN|${info.seed}|${info.n}|${round}`);
    const pair = SD.WORDS[Math.floor(r() * SD.WORDS.length)];
    const swap = r() < 0.5;
    const nImp = info.n >= 7 ? 2 : 1;
    const imps = SD.shuffle([...Array(info.n).keys()], r).slice(0, nImp).sort((a, b) => a - b);
    const fr = swap ? [pair[1], pair[0]] : [pair[0], pair[1]];
    const en = swap ? [pair[3], pair[2]] : [pair[2], pair[3]];
    const w = SD.state.lang === "en" ? en : fr;
    return { civil: w[0], imp: w[1], imps };
  };

  const intrusPick = (info, round = 0) => {
    const app = SD.render(`
      ${SD.gameTop("intrus")}
      <div class="game-body">
        <p class="eyebrow mono">${esc(info.code)}${round ? " · #" + (round + 1) : ""}</p>
        <h1 class="display">${t("whichPlayer")}</h1>
        <div class="num-grid">${Array.from({ length: info.n }, (_, i) => `<button class="num" data-act="me" data-i="${i}">${i + 1}</button>`).join("")}</div>
      </div>`, { cls: "game" });
    SD.bind(app, { ...SD.topHandlers("intrus"), me: (e, el) => intrusWord(info, round, +el.dataset.i) });
  };

  const intrusWord = (info, round, me) => {
    const deal = intrusDeal(info, round);
    const word = deal.imps.includes(me) ? deal.imp : deal.civil;
    let armed = false, armT = null;
    const app = SD.render(`
      ${SD.gameTop("intrus")}
      <div class="game-body">
        <p class="eyebrow">${t("playerN", { n: me + 1 })}</p>
        <button class="reveal-pad" id="pad" aria-label="${t("holdReveal")}">
          <span class="cover">${t("holdReveal")}</span>
          <span class="word"><span class="label">${t("yourWord")}</span><strong>${esc(word)}</strong></span>
        </button>
      </div>
      <div class="actions"><button class="btn ghost xl wide" data-act="reveal">${t("revealAll")}</button></div>`, { cls: "game", awake: true });
    const pad = app.querySelector("#pad");
    const on = e => { e.preventDefault(); pad.classList.add("shown"); SD.buzz(10); };
    const off = () => pad.classList.remove("shown");
    pad.addEventListener("pointerdown", on);
    ["pointerup", "pointerleave", "pointercancel"].forEach(n => pad.addEventListener(n, off));
    pad.addEventListener("contextmenu", e => e.preventDefault());
    SD.bind(app, {
      ...SD.topHandlers("intrus"),
      reveal: (e, el) => {
        if (!armed) { armed = true; el.textContent = t("confirmReveal"); el.classList.add("armed"); armT = setTimeout(() => { armed = false; el.textContent = t("revealAll"); el.classList.remove("armed"); }, 3000); return; }
        clearTimeout(armT); intrusReveal(info, round, me, deal);
      }
    });
    SD.cleanup = () => clearTimeout(armT);
  };

  const intrusReveal = (info, round, me, deal) => {
    const names = deal.imps.map(i => t("playerN", { n: i + 1 }));
    const iAmImp = deal.imps.includes(me);
    const outcome = caught => {
      const losersIdx = caught ? deal.imps : [...Array(info.n).keys()].filter(i => !deal.imps.includes(i));
      const meLoses = losersIdx.includes(me);
      caught === iAmImp ? SD.bad() : SD.good();
      const app = SD.render(`
        ${SD.gameTop("intrus")}
        <div class="center-stack ${meLoses ? "is-bad" : "is-good"}">
          <p class="eyebrow">${caught ? t("caught") : t("notCaught")}</p>
          <h1 class="display">${t("quizQueue", { names: losersIdx.map(i => `<span class="hl">${t("playerN", { n: i + 1 })}</span>`).join(", ") })}</h1>
          <div class="btn-col">
            ${meLoses ? `<button class="btn primary xl" data-act="quiz">${t("iDoQuiz")}</button>` : ""}
            <button class="btn ${meLoses ? "ghost" : "primary xl"}" data-act="again">${t("again")}</button>
          </div>
        </div>`, { cls: "game", awake: true });
      SD.bind(app, {
        ...SD.topHandlers("intrus"),
        quiz: () => SD.runQuiz([t("playerN", { n: me + 1 })], { onContinue: () => intrusWord(info, round + 1, me) }),
        again: () => intrusWord(info, round + 1, me)
      });
    };
    const app = SD.render(`
      ${SD.gameTop("intrus")}
      <div class="game-body">
        <p class="eyebrow">${deal.imps.length > 1 ? t("impostorsWere") : t("impostorWas")}</p>
        <h1 class="display huge">${names.map(esc).join(" & ")}</h1>
        <div class="words">
          <div><span class="label">${t("wordCivil")}</span><strong>${esc(deal.civil)}</strong></div>
          <div class="imp"><span class="label">${t("wordImp")}</span><strong>${esc(deal.imp)}</strong></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost xl" data-act="no">${t("notCaught")}</button>
        <button class="btn primary xl" data-act="yes">${t("caught")}</button>
      </div>`, { cls: "game", awake: true });
    SD.bind(app, { ...SD.topHandlers("intrus"), yes: () => outcome(true), no: () => outcome(false) });
  };

  /* ================= Quiz Synchro ================= */
  const syncSetup = () => {
    let n = 10, d = "X";
    const draw = () => {
      const app = SD.render(`
        ${SD.gameTop("sync")}
        <div class="game-body">
          <h1 class="display">${t("g_sync")}</h1>
          <p class="lead">${t("g_sync_d")}</p>
          ${segmented("n", t("nbQuestions"), [[5, "5"], [10, "10"], [15, "15"], [20, "20"]], n)}
          ${segmented("d", t("difficulty"), [["X", t("mix")], ["E", t("easy")], ["M", t("medium")], ["H", t("hard")]], d)}
        </div>
        <div class="actions"><button class="btn primary xl wide" data-act="create">${t("create")}</button></div>`, { cls: "game" });
      SD.bind(app, {
        ...SD.topHandlers("sync"),
        n: (e, el) => { n = +el.dataset.v; draw(); },
        d: (e, el) => { d = el.dataset.v; draw(); },
        create: () => shareScreen("sync", SD.parseCode(`QS-${SD.newSeed()}-${n}-${d}-${SD.bank.fp}`))
      });
    };
    draw();
  };

  const syncPlay = (info, asHost, round = 0) => {
    if (!asHost && info.fp !== SD.bank.fp) SD.toast(t("bankMismatch"));
    const r = SD.rng(`QS|${info.seed}|${round}`);
    // Toute la banque (sans filtre de thème) pour que chaque téléphone tire la même chose
    let pool = SD.bank.questions.filter(q => info.d === "X" || q.diff === info.d).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const qs = SD.shuffle(pool, r).slice(0, info.n);
    let i = 0, score = 0;
    const show = revealed => {
      const q = qs[i];
      const app = SD.render(`
        ${SD.gameTop("sync")}
        <div class="quiz-body">
          <div class="progress"><span style="width:${(i / qs.length) * 100}%"></span></div>
          <p class="eyebrow">${t("question", { i: i + 1, n: qs.length })} · <span class="mono">${esc(info.code.split("-")[1])}</span></p>
          ${SD.questionCard(q, revealed)}
        </div>
        <div class="actions">
          ${revealed
            ? `<button class="btn bad xl" data-act="no">${t("iWasWrong")}</button><button class="btn good xl" data-act="yes">${t("iWasRight")}</button>`
            : `<button class="btn primary xl wide" data-act="rev">${t("showAnswer")}</button>`}
        </div>`, { cls: "quiz", awake: true });
      const step = ok => { if (ok) score++; i++; i < qs.length ? show(false) : end(); };
      SD.bind(app, { ...SD.topHandlers("sync"), rev: () => show(true), yes: () => { SD.beep(800, .06); step(true); }, no: () => { SD.beep(300, .08); step(false); } });
    };
    const end = () => {
      SD.good();
      const app = SD.render(`
        ${SD.gameTop("sync")}
        <div class="center-stack">
          <p class="eyebrow">${t("yourScore")}</p>
          <h1 class="display mega tabnum">${score}<span class="of">/${qs.length}</span></h1>
          <p class="lead">${t("compare")}</p>
          <div class="btn-col">
            <button class="btn primary xl" data-act="lost">${t("iLost")}</button>
            <button class="btn ghost" data-act="again">${t("again")}</button>
          </div>
        </div>`, { cls: "quiz" });
      SD.bind(app, {
        ...SD.topHandlers("sync"),
        lost: () => SD.runQuiz([t("you")], { onContinue: () => syncPlay(info, true, round + 1) }),
        again: () => syncPlay(info, true, round + 1)
      });
    };
    if (!qs.length) { SD.toast(t("noQuestions")); return SD.home(); }
    show(false);
  };

  SD.addGame({ id: "intrus", mode: "each", min: 0, start: intrusSetup });
  SD.addGame({ id: "sync", mode: "each", min: 0, start: syncSetup });

  /* ---------- Rejoindre : scan QR ou code tapé ---------- */
  SD.joinScreen = prefill => {
    let stream = null, raf = null;
    const app = SD.render(`
      <header class="game-top"><button class="icon-btn" data-act="home" aria-label="${t("back")}">${SD.icon("back")}</button>
        <span class="eyebrow">${t("joinTitle")}</span><span></span></header>
      <div class="game-body">
        <div class="scanner" id="scanner" hidden><video id="vid" playsinline muted></video><span class="frame"></span></div>
        <button class="btn primary xl wide" data-act="scan" id="scanBtn">${SD.icon("cam")} ${t("scan")}</button>
        <p class="or">${t("orType")}</p>
        <form class="join-form" id="jf">
          <input id="codeIn" class="mono" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${t("codePh")}" value="${esc(prefill || "")}" aria-label="${t("code")}">
          <button class="btn primary" type="submit">${t("joinBtn")}</button>
        </form>
        <p class="err" id="err" role="alert"></p>
      </div>`, { cls: "game" });
    const err = app.querySelector("#err");
    const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(tr => tr.stop()); stream = null; };
    SD.cleanup = stop;
    const tryJoin = raw => {
      const info = SD.parseCode(raw);
      if (!info) { err.textContent = t("badCode"); SD.bad(); return false; }
      stop(); SD.good(); SD.openCode(info, false); return true;
    };
    app.querySelector("#jf").addEventListener("submit", e => { e.preventDefault(); tryJoin(app.querySelector("#codeIn").value); });
    SD.bind(app, {
      home: () => SD.home(),
      scan: async () => {
        const box = app.querySelector("#scanner"), btn = app.querySelector("#scanBtn");
        if (stream) { stop(); box.hidden = true; btn.innerHTML = `${SD.icon("cam")} ${t("scan")}`; return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        } catch (e) { err.textContent = t("camErr"); return; }
        box.hidden = false; btn.textContent = t("stopScan");
        const vid = app.querySelector("#vid"); vid.srcObject = stream; await vid.play().catch(() => {});
        const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
        const loop = () => {
          if (!stream) return;
          if (vid.readyState >= 2 && vid.videoWidth) {
            const w = 480, h = Math.round(vid.videoHeight * (w / vid.videoWidth));
            cv.width = w; cv.height = h; cx.drawImage(vid, 0, 0, w, h);
            const res = window.jsQR && jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (res && res.data && SD.parseCode(res.data)) { tryJoin(res.data); return; }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      }
    });
  };
})();
