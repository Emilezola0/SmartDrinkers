/* SmartDrinkers — banque de questions et déroulé du quiz */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc;

  /* ---------- Lecture TSV / CSV ---------- */
  SD.parseDelimited = text => {
    text = String(text || "").replace(/^﻿/, "");
    const first = text.split(/\r?\n/, 1)[0] || "";
    const delim = first.includes("\t") ? "\t" : ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"' && cell === "") q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\r") { if (text[i + 1] !== "\n") cell += " "; } // retour chariot isolé dans une cellule
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  };

  const THEME_FIX = { "Alchool": "Alcool", "Annimaux": "Animaux", "Litérature": "Littérature" };
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const diffOf = v => {
    v = clean(v).toLowerCase();
    if (/^(e|f|1|facile|easy)/.test(v)) return "E";
    if (/^(m|2|moyen|medium|normal)/.test(v)) return "M";
    if (/^(h|d|3|difficile|hard)/.test(v)) return "H";
    return null;
  };
  const splitAnswer = a => {
    const m = a.match(/^(.+?)\s*\((.{20,})\)?\s*$/);
    return m ? { a: m[1].trim(), detail: m[2].replace(/\)$/, "").trim() } : { a, detail: "" };
  };

  SD.buildBank = text => {
    const rows = SD.parseDelimited(text).filter(r => r.some(c => clean(c)));
    if (rows.length < 2) return null;
    const head = rows[0].map(h => clean(h));
    const low = head.map(h => h.toLowerCase());
    const themeIdx = low.findIndex(h => /^(th[eè]me|theme|cat[eé]gor)/.test(h) && !/_en$/.test(h));
    const themeEnIdx = low.findIndex(h => /^(th[eè]me|theme|cat[eé]gor).*_en$/.test(h));
    const themeEn = {};
    rows.slice(1).forEach(r => { if (themeEnIdx >= 0 && clean(r[themeEnIdx])) { let th = clean(r[themeIdx]); th = THEME_FIX[th] || th; themeEn[th] = clean(r[themeEnIdx]); } });
    const out = [];
    const push = (theme, diff, q, a, qEn, aEn) => {
      q = clean(q); a = clean(a);
      if (!q || !a || !diff) return;
      theme = clean(theme) || "—"; theme = THEME_FIX[theme] || theme;
      const sa = splitAnswer(a), se = aEn ? splitAnswer(clean(aEn)) : null;
      out.push({ id: SD.hashStr(diff + q).toString(36), theme, diff, q, a: sa.a, detail: sa.detail, qEn: clean(qEn), aEn: se ? se.a : "", detailEn: se ? se.detail : "" });
    };

    // Format large : Thème | E1 | E1_Ans | E2 | E2_Ans | M1 | … | H2_Ans (+ colonnes E1_EN, E1_Ans_EN facultatives)
    const pairs = [];
    head.forEach((h, i) => {
      const m = h.match(/^([EMH])(\d+)$/i);
      if (m && /_ans$/i.test(head[i + 1] || "")) {
        const en = low.indexOf(h.toLowerCase() + "_en"), enA = low.indexOf(h.toLowerCase() + "_ans_en");
        pairs.push({ diff: m[1].toUpperCase(), qi: i, ai: i + 1, en, enA });
      }
    });
    if (pairs.length) {
      rows.slice(1).forEach(r => pairs.forEach(p => push(r[themeIdx], p.diff, r[p.qi], r[p.ai], p.en >= 0 ? r[p.en] : "", p.enA >= 0 ? r[p.enA] : "")));
    } else {
      // Format long : Thème | Difficulté | Question | Réponse (+ Question_EN | Réponse_EN)
      const f = re => low.findIndex(h => re.test(h));
      const di = f(/^(difficult|niveau|level)/), qi = f(/^question$|^question[^_]*$/), ai = f(/^(r[eé]ponse|answer)$/);
      const qe = f(/^question_en$/), ae = f(/^(r[eé]ponse|answer)_en$/);
      if (di < 0 || qi < 0 || ai < 0) return null;
      rows.slice(1).forEach(r => push(r[themeIdx], diffOf(r[di]), r[qi], r[ai], qe >= 0 ? r[qe] : "", ae >= 0 ? r[ae] : ""));
    }
    if (!out.length) return null;
    const themes = [...new Set(out.map(q => q.theme))].sort((a, b) => a.localeCompare(b, "fr"));
    const fp = SD.hashStr(out.map(q => q.id).join("|")).toString(36).slice(-3).toUpperCase();
    return { questions: out, themes, fp, themeEn };
  };

  SD.loadBank = () => {
    const custom = SD.load("bankText", null);
    SD.bank = (custom && SD.buildBank(custom)) || SD.buildBank(window.SD_QUESTIONS_TSV || "") || { questions: [], themes: [], fp: "000" };
    SD.isCustomBank = !!custom && SD.bank.questions.length > 0;
  };
  SD.themesOff = () => SD.load("themesOff", []);
  SD.activeQuestions = () => { const off = new Set(SD.themesOff()); return SD.bank.questions.filter(q => !off.has(q.theme)); };

  // Affichage dans la langue choisie si une traduction existe
  SD.qText = q => (SD.state.lang === "en" && q.qEn) ? q.qEn : q.q;
  SD.aText = q => (SD.state.lang === "en" && q.aEn) ? q.aEn : q.a;
  SD.themeText = th => (SD.state.lang === "en" && SD.bank && SD.bank.themeEn && SD.bank.themeEn[th]) || th;
  SD.dText = q => (SD.state.lang === "en" && q.aEn) ? q.detailEn : q.detail;

  SD.drawQuestion = diff => {
    const pool = SD.activeQuestions().filter(q => q.diff === diff);
    if (!pool.length) return null;
    let used = new Set(SD.load("used", []));
    let avail = pool.filter(q => !used.has(q.id));
    if (!avail.length) { pool.forEach(q => used.delete(q.id)); avail = pool; }
    const q = SD.pick(avail);
    used.add(q.id); SD.save("used", [...used].slice(-2000));
    return q;
  };

  SD.diffName = d => t({ E: "easy", M: "medium", H: "hard" }[d]);
  SD.diffClass = d => ({ E: "d-easy", M: "d-med", H: "d-hard" }[d]);

  /* Carte question réutilisable (quiz et Quiz Synchro) */
  SD.questionCard = (q, revealed) => `
    <article class="qcard ${SD.diffClass(q.diff)}">
      <div class="qmeta"><span class="chip">${esc(SD.themeText(q.theme))}</span><span class="chip diff">${SD.diffName(q.diff)}</span></div>
      <p class="qtext">${esc(SD.qText(q))}</p>
      ${revealed ? `<div class="answer"><span class="label">${t("answer")}</span>
        <strong>${esc(SD.aText(q))}</strong>${SD.dText(q) ? `<p class="detail">${esc(SD.dText(q))}</p>` : ""}</div>` : ""}
    </article>`;

  /* ---------- Déroulé du quiz pour une liste de perdants ---------- */
  // names : liste de prénoms ; opts.onContinue : relance le jeu ; opts.solo : quiz sur son propre téléphone
  SD.runQuiz = (names, opts = {}) => {
    names = names.length ? names : [t("you")];
    let i = 0;

    const after = () => {
      const app = SD.render(`
        <div class="center-stack">
          <div class="big-ico">${SD.icon("glass")}</div>
          <h1 class="display">${t("quizDone")}</h1>
          <div class="btn-col">
            ${opts.onContinue ? `<button class="btn primary xl" data-act="cont">${t("continueGame")}</button>` : ""}
            <button class="btn ghost" data-act="home">${t("changeGame")}</button>
          </div>
        </div>`, { cls: "quiz" });
      SD.bind(app, { cont: () => opts.onContinue(), home: () => SD.home() });
    };

    const chooseDiff = () => {
      const name = names[i];
      const s = SD.state.sips;
      const app = SD.render(`
        <header class="game-top"><button class="icon-btn" data-act="home" aria-label="${t("menu")}">${SD.icon("back")}</button>
          <span class="eyebrow">${t("quizTime")}${names.length > 1 ? ` · ${i + 1}/${names.length}` : ""}</span><span></span></header>
        <div class="center-stack">
          <h1 class="display name-title">${t("chooseDiff", { name: `<span class="hl">${esc(name)}</span>` })}</h1>
          <div class="diff-grid">
            ${["E", "M", "H"].map(d => `<button class="diff-btn ${SD.diffClass(d)}" data-act="d${d}">
              <span class="dn">${SD.diffName(d)}</span><span class="dc">${t("missCost", { n: s[d] })} ${SD.sipWord(s[d])}</span></button>`).join("")}
          </div>
        </div>`, { cls: "quiz", awake: true });
      const go = d => () => ask(d);
      SD.bind(app, { home: () => SD.home(), dE: go("E"), dM: go("M"), dH: go("H") });
    };

    const ask = diff => {
      const q = SD.drawQuestion(diff);
      if (!q) { SD.toast(t("noQuestions")); return; }
      const show = revealed => {
        const app = SD.render(`
          <header class="game-top"><button class="icon-btn" data-act="home" aria-label="${t("menu")}">${SD.icon("back")}</button>
            <span class="eyebrow">${esc(names[i])}</span><span></span></header>
          <div class="quiz-body">
            ${SD.questionCard(q, revealed)}
            ${revealed ? "" : `<p class="hint">${t("answerAloud")}</p>`}
          </div>
          <div class="actions">
            ${revealed
              ? `<button class="btn bad xl" data-act="miss">${t("missed")}</button><button class="btn good xl" data-act="ok">${t("gotIt")}</button>`
              : `<button class="btn primary xl wide" data-act="reveal">${t("showAnswer")}</button>`}
          </div>`, { cls: "quiz", awake: true });
        SD.bind(app, {
          home: () => SD.home(),
          reveal: () => { SD.beep(520, .06); show(true); },
          ok: () => result(true, diff),
          miss: () => result(false, diff)
        });
      };
      show(false);
    };

    const result = (ok, diff) => {
      const n = SD.state.sips[diff];
      ok ? SD.good() : SD.bad();
      const last = i >= names.length - 1;
      const app = SD.render(`
        <div class="center-stack result ${ok ? "is-good" : "is-bad"}">
          <p class="eyebrow">${esc(names[i])}</p>
          <h1 class="display huge">${ok ? t("right") : t("drink", { n, s: SD.sipWord(n) })}</h1>
          ${ok ? `<p class="lead">${t("safe")}</p>` : `<div class="sip-dots" aria-hidden="true">${"<i></i>".repeat(Math.min(n, 10))}</div>`}
          <button class="btn primary xl" data-act="next">${last ? t("next") : t("next") + " · " + esc(names[i + 1])}</button>
        </div>`, { cls: "quiz", awake: true });
      SD.bind(app, { next: () => { if (last) after(); else { i++; chooseDiff(); } } });
    };

    if (names.length > 1) {
      const app = SD.render(`
        <div class="center-stack">
          <p class="eyebrow">${t("quizTime")}</p>
          <h1 class="display">${t("quizQueue", { names: names.map(n => `<span class="hl">${esc(n)}</span>`).join(", ") })}</h1>
          <button class="btn primary xl" data-act="go">${t("start")}</button>
        </div>`, { cls: "quiz", awake: true });
      SD.bind(app, { go: chooseDiff });
    } else chooseDiff();
  };
})();
