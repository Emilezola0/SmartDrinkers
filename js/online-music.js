/* SmartDrinkers — jeux musicaux en ligne : Blind Test (DJ tournant) et Plus ou Moins musical.
   Extraits audio de 30 s, pochettes et nombre de fans fournis par l'API publique de Deezer. */
(function () {
  const SD = window.SD, t = SD.t, esc = SD.esc, O = SD.online;
  if (!O) return;

  /* ---------- Deezer (JSONP : l'API ne permet pas les appels directs depuis un site) ---------- */
  let jn = 0;
  const jsonp = url => new Promise((res, rej) => {
    const cb = "sdDz" + (++jn) + Date.now();
    const s = document.createElement("script");
    const done = () => { clearTimeout(to); delete window[cb]; s.remove(); };
    const to = setTimeout(() => { done(); rej(new Error("timeout")); }, 9000);
    window[cb] = d => { done(); res(d); };
    s.onerror = () => { done(); rej(new Error("network")); };
    s.src = url + (url.includes("?") ? "&" : "?") + "output=jsonp&callback=" + cb;
    document.head.appendChild(s);
  });
  const mainArtist = a => a.split(/ feat\.| & |, | x /i)[0].trim();
  O.deezer = async song => {
    const [title, artist] = song;
    const pick = d => (d && d.data || []).find(x => x.preview);
    let hit = pick(await jsonp(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(`artist:"${mainArtist(artist)}" track:"${title}"`)}`));
    if (!hit) hit = pick(await jsonp(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(title + " " + mainArtist(artist))}`));
    if (!hit) return null;
    let fans = null;
    try { const a = await jsonp(`https://api.deezer.com/artist/${hit.artist.id}`); fans = a.nb_fan || null; } catch (e) {}
    return { preview: hit.preview, cover: (hit.album && (hit.album.cover_medium || hit.album.cover)) || "", link: hit.link || "", fans };
  };

  /* ---------- Choix des morceaux ---------- */
  const DECADES = [["60", "60s"], ["70", "70s"], ["80", "80s"], ["90", "90s"], ["00", "2000s"], ["10", "2010s"], ["20", "2020s"]];
  const decadeOf = y => y < 1970 ? "60" : y < 1980 ? "70" : y < 1990 ? "80" : y < 2000 ? "90" : y < 2010 ? "00" : y < 2020 ? "10" : "20";
  const musicOptions = [
    { k: "dec", multi: true, def: "70,80,90,00,10,20", label: () => t("muDecades"), choices: () => DECADES },
    { k: "orig", def: "all", label: () => t("muOrigin"), choices: () => [["all", t("muBoth")], ["f", t("muFr")], ["i", t("muInt")]] },
    { k: "mdiff", def: "mix", label: () => t("difficulty"), choices: () => [["1", t("easy")], ["2", t("medium")], ["3", t("hard")], ["mix", t("mix")]] }
  ];
  const pool = c => {
    const dec = new Set(String(O.opt(c, "dec", "70,80,90,00,10,20")).split(","));
    const orig = O.opt(c, "orig", "all"), diff = O.opt(c, "mdiff", "mix");
    return SD.SONGS.map((s, i) => i).filter(i => {
      const s = SD.SONGS[i];
      return dec.has(decadeOf(s[2])) && (orig === "all" || s[3] === orig) && (diff === "mix" || String(s[4]) === String(diff));
    });
  };
  // Tire un morceau pas encore joué et récupère son extrait (plusieurs essais si Deezer ne trouve pas)
  const loadSong = async (c, used) => {
    let ids = pool(c).filter(i => !used[i]);
    if (!ids.length) ids = pool(c);
    if (!ids.length) ids = SD.SONGS.map((s, i) => i);
    for (let k = 0; k < 4 && ids.length; k++) {
      const i = SD.pick(ids); ids = ids.filter(x => x !== i);
      const s = SD.SONGS[i];
      try {
        const dz = await O.deezer(s);
        if (dz) return { i, t: s[0], a: s[1], y: s[2], al: s[5] || "", sl: s[6] || 0, ...dz };
      } catch (e) { /* on essaie un autre morceau */ }
    }
    const i = SD.pick(ids.length ? ids : pool(c));
    const s = SD.SONGS[i] || SD.SONGS[0];
    return { i, t: s[0], a: s[1], y: s[2], al: s[5] || "", sl: s[6] || 0, preview: "", cover: "", link: "", fans: null };
  };

  /* ---------- Question Plus ou Moins ---------- */
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); return Math.max(1, Math.round(v / p * 2) / 2 * p); };
  const spread = truth => { let thr; do { thr = nice(truth * (Math.random() < .5 ? .45 + Math.random() * .4 : 1.2 + Math.random() * .8)); } while (thr === truth); return thr; };
  O.makeHL = song => {
    const kinds = ["year"];
    if (song.sl) kinds.push("sales", "sales");
    if (song.fans) kinds.push("fans", "fans");
    const kind = SD.pick(kinds);
    if (kind === "sales") return { kind, thr: spread(song.sl), truth: song.sl };
    if (kind === "fans") return { kind, thr: spread(song.fans), truth: song.fans };
    const d = (1 + Math.floor(Math.random() * 5)) * (Math.random() < .5 ? -1 : 1);
    return { kind, thr: song.y + d, truth: song.y };
  };
  const num = n => Number(n).toLocaleString(SD.state.lang === "fr" ? "fr-FR" : "en-US");
  const hlText = (q, song) => q.kind === "sales" ? t("hlSales", { album: esc(song.al), n: num(q.thr) })
    : q.kind === "fans" ? t("hlFans", { artist: esc(song.a), n: num(q.thr) }) : t("hlYear", { n: q.thr });
  const hlTruth = (q, song) => q.kind === "sales" ? t("hlSalesTruth", { n: num(q.truth) })
    : q.kind === "fans" ? t("hlFansTruth", { n: num(q.truth) }) : t("hlYearTruth", { n: q.truth });
  const hlLabels = q => q.kind === "year" ? [t("hlBefore"), t("hlAfter")] : [t("hlLess"), t("hlMore")];
  const hlRight = q => q.truth > q.thr ? "more" : "less";

  /* ---------- Lecture de l'extrait ---------- */
  let audio = null, audioSrc = "", stopT = null;
  const stopAudio = () => { clearTimeout(stopT); if (audio) { try { audio.pause(); } catch (e) {} } };
  const playFor = (src, secs) => {
    if (!src) return SD.toast(t("muNoAudio"));
    if (!audio || audioSrc !== src) { stopAudio(); audio = new Audio(src); audioSrc = src; audio.preload = "auto"; }
    clearTimeout(stopT);
    try { audio.currentTime = 0; } catch (e) {}
    audio.play().catch(() => SD.toast(t("muTapAgain")));
    stopT = setTimeout(stopAudio, secs * 1000);
  };
  const coverHtml = song => song.cover ? `<img class="cover" src="${esc(song.cover)}" alt="">` : `<div class="cover none">♪</div>`;
  const songCard = (song, extra = "") => `<div class="song-card">${coverHtml(song)}<div><strong>${esc(song.t)}</strong><span>${esc(song.a)} · ${song.y}</span>${song.sl ? `<small>${t("muSales", { album: esc(song.al), n: song.sl })}</small>` : ""}${extra}</div></div>`;
  const credit = song => `<p class="credit">${t("muCredit")}${song.link ? ` · <a href="${esc(song.link)}" target="_blank" rel="noopener">${t("muListen")}</a>` : ""}</p>`;
  const initials = s => s.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() + "…" : "").join(" ");

  /* ================= Blind Test ================= */
  O.games.oblind = {
    options: [...musicOptions,
      { k: "per", def: 3, label: () => t("muPerDj"), choices: () => [[2, "2"], [3, "3"], [5, "5"]] },
      { k: "hl", def: "1", label: () => t("muBonus"), choices: () => [["1", t("yes")], ["0", t("no")]] }],
    start: c => {
      const order = SD.shuffle(c.online.map(p => p.uid));
      return { phase: "load", order, di: 0, n: 1, per: +O.opt(c, "per", 3), hl: String(O.opt(c, "hl", "1")) === "1", song: null, hints: 0, buzz: null, locked: null, scores: null, last: null, used: null, hq: null, ha: null };
    },
    view: c => {
      const s = c.state, order = Object.values(s.order || {}), dj = order[s.di], isDj = dj === c.uid;
      const scores = s.scores || {}, locked = s.locked || {}, song = s.song;
      const guessers = c.online.filter(p => p.uid !== dj);
      const board = `<div class="scoreboard">${c.players.map(p => `<span class="score ${p.uid === dj ? "dj" : ""} ${s.buzz && s.buzz.uid === p.uid ? "on" : ""} ${locked[p.uid] ? "locked" : ""}">${esc(p.name)}${p.uid === dj ? ` <small>DJ</small>` : ""} <b>${scores[p.uid] || 0}</b></span>`).join("")}</div>`;
      const head = `<p class="eyebrow">${t("muDjRound", { name: esc(c.name(dj)), i: s.n, n: s.per })}</p>`;
      const next = () => {
        stopAudio();
        let n = s.n + 1, di = s.di;
        if (n > s.per) { n = 1; di++; }
        if (di >= order.length) return c.setState({ phase: "end" });
        c.setState({ phase: "load", di, n, song: null, hints: 0, buzz: null, locked: null, last: null, hq: null, ha: null, qz: null });
      };

      if (s.phase === "end") {
        stopAudio();
        const min = Math.min(...c.players.map(p => scores[p.uid] || 0));
        const losers = c.players.filter(p => (scores[p.uid] || 0) === min).map(p => p.uid);
        const app = SD.render(O.frame(c, `<p class="eyebrow">${t("results")}</p>${O.scoreList(c, scores, losers)}
          <h1 class="display">${t("quizQueue", { names: losers.map(u => `<span class="hl">${esc(c.name(u))}</span>`).join(", ") })}</h1>
          <div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
      }

      const djOff = !c.online.some(p => p.uid === dj);
      const skipDj = () => { stopAudio(); s.di + 1 >= order.length ? c.setState({ phase: "end" }) : c.setState({ phase: "load", di: s.di + 1, n: 1, song: null, hints: 0, buzz: null, locked: null, last: null, hq: null, ha: null }); };
      const load = () => {
        O._loading = true;
        loadSong(c, s.used || {}).then(sg => { O._loading = false; c.setState({ phase: "play", song: sg, ["used/" + sg.i]: true }); }, () => { O._loading = false; SD.toast(t("onlineErr")); c.render(); });
      };
      if (s.phase === "load") {
        if (isDj && !O._loading) load();
        const app = SD.render(O.frame(c, `${board}${head}<div class="spinner"></div><p class="lead">${isDj ? t("muLoadingDj") : t("muLoading", { name: esc(c.name(dj)) })}</p>
          ${djOff ? `<p class="hint">${t("muDjOff", { name: esc(c.name(dj)) })}</p>` : ""}`,
          djOff && c.isHost ? `<button class="btn ghost xl wide" data-act="skipDj">${t("muSkipDj")}</button>` : isDj ? `<button class="btn ghost xl wide" data-act="retry">${t("muRetry")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), skipDj, retry: () => { if (!O._loading) load(); } });
      }

      const hintsHtml = song ? [t("muHintYear", { y: song.y }), t("muHintArtist", { a: initials(song.a) }), t("muHintTitle", { t: initials(song.t) })].slice(0, s.hints).map(h => `<span class="chip hint-chip">${h}</span>`).join("") : "";
      const pts = Math.max(1, 3 - (s.hints || 0));

      if (s.phase === "play") {
        if (s.buzz && isDj) stopAudio();
        if (s.buzz && s.buzz.uid === c.uid) SD.beep(880, .1, "square", .1);
        let body, actions = "";
        if (isDj) {
          body = `${board}${head}${songCard(song, `<small>${t("muPoints", { n: pts })}</small>`)}
            <div class="row-btns center">
              <button class="btn primary" data-act="play10">▶ 10 s</button><button class="btn ghost" data-act="play20">▶ 20 s</button><button class="btn ghost" data-act="play30">▶ 30 s</button>
            </div>
            ${song.preview ? "" : `<p class="hint">${t("muNoAudio")}</p>`}
            <div class="hints">${hintsHtml}</div>
            ${s.buzz ? `<p class="verdict hl">${t("buzzedBy", { name: esc(s.buzz.name) })}</p>` : s.last && !s.last.ok ? `<p class="verdict bad">${t("buzzWrong", { name: esc(c.name(s.last.uid)) })}</p>` : `<p class="hint">${t("muDjHelp")}</p>`}`;
          actions = s.buzz
            ? `<button class="btn bad xl" data-act="wrong">${t("missed")}</button><button class="btn good xl" data-act="right">${t("gotIt")}</button>`
            : `<button class="btn ghost xl" data-act="hint" ${s.hints >= 3 ? "disabled" : ""}>${t("muHint")}</button><button class="btn ghost xl" data-act="reveal">${t("muReveal")}</button>`;
        } else {
          const canBuzz = !s.buzz && !locked[c.uid];
          if (djOff && c.isHost) actions = `<button class="btn ghost xl wide" data-act="skipDj">${t("muSkipDj")}</button>`;
          body = `${board}${head}<div class="listen" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
            <p class="lead">${t("muListenNow", { n: pts })}</p><div class="hints">${hintsHtml}</div>
            ${s.buzz ? `<p class="verdict hl">${t("buzzedBy", { name: esc(s.buzz.name) })}</p>` : s.last && !s.last.ok ? `<p class="verdict bad">${t("buzzWrong", { name: esc(c.name(s.last.uid)) })}</p>` : ""}
            ${canBuzz ? `<button class="buzz-btn" id="buzzBtn">${t("buzz")}</button>` : locked[c.uid] ? `<p class="hint">${t("buzzLocked")}</p>` : ""}`;
        }
        const app = SD.render(O.frame(c, body, actions), { cls: "game", awake: true });
        const bb = app.querySelector("#buzzBtn");
        if (bb) bb.addEventListener("pointerdown", e => {
          e.preventDefault(); bb.disabled = true; SD.buzz(40);
          c.ref.child("state/buzz").transaction(cur => cur ? undefined : { uid: c.uid, name: c.me.name || "?" });
        }, { once: true });
        return SD.bind(app, {
          ...O.baseHandlers(c),
          skipDj,
          play10: () => playFor(song.preview, 10), play20: () => playFor(song.preview, 20), play30: () => playFor(song.preview, 30),
          hint: () => c.setState({ hints: Math.min(3, (s.hints || 0) + 1) }),
          reveal: () => { stopAudio(); c.setState({ phase: "reveal", last: null }); },
          right: () => { stopAudio(); c.setState({ phase: "reveal", ["scores/" + s.buzz.uid]: (scores[s.buzz.uid] || 0) + pts, last: { uid: s.buzz.uid, ok: true, pts } }); },
          wrong: () => {
            const lk = { ...locked, [s.buzz.uid]: true };
            const allOut = guessers.every(p => lk[p.uid]);
            c.setState({ buzz: null, ["locked/" + s.buzz.uid]: true, last: { uid: s.buzz.uid, ok: false }, phase: allOut ? "reveal" : "play" });
          }
        });
      }

      if (s.phase === "reveal") {
        const app = SD.render(O.frame(c, `${board}${head}${songCard(song)}
          ${s.last && s.last.ok ? `<p class="verdict good">${t("muFound", { name: esc(c.name(s.last.uid)), n: s.last.pts })}</p>` : `<p class="verdict">${t("buzzNobody")}</p>`}
          ${credit(song)}`,
          isDj ? `${s.hl ? `<button class="btn ghost xl" data-act="bonus">${t("muBonusGo")}</button>` : ""}<button class="btn primary xl" data-act="next">${t("next")}</button>` : ""), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), next, bonus: () => c.setState({ phase: "bonus", hq: O.makeHL(song), ha: null }) });
      }

      if (s.phase === "bonus" || s.phase === "bonusRev") {
        const q = s.hq, ans = s.ha || {}, labels = hlLabels(q), right = hlRight(q);
        if (s.phase === "bonus" && isDj && guessers.length && guessers.every(p => ans[p.uid])) {
          const u = {}; guessers.forEach(p => { if (ans[p.uid] === right) u["scores/" + p.uid] = (scores[p.uid] || 0) + 1; });
          return c.setState({ phase: "bonusRev", ...u });
        }
        const rev = s.phase === "bonusRev";
        const mine = ans[c.uid];
        const app = SD.render(O.frame(c, `${board}<p class="eyebrow">${t("muBonusTitle")}</p>${songCard(song)}
          <h1 class="display hl-q">${hlText(q, song)}</h1>
          ${rev ? `<p class="verdict good">${hlTruth(q, song)}</p>
            <div class="result-list small">${guessers.map(p => `<div class="rrow ${ans[p.uid] === right ? "" : "lose"}"><span>${esc(p.name)}</span><b>${ans[p.uid] ? (ans[p.uid] === right ? "+1" : "✗") : "—"}</b></div>`).join("")}</div>`
            : isDj ? `<p class="hint tabnum">${t("votedCount", { n: guessers.filter(p => ans[p.uid]).length, m: guessers.length })}</p>`
            : `<div class="hl-btns"><button class="vote ${mine === "less" ? "on" : ""}" data-act="ans" data-v="less">▼ ${labels[0]}</button><button class="vote ${mine === "more" ? "on" : ""}" data-act="ans" data-v="more">▲ ${labels[1]}</button></div>`}`,
          isDj ? (rev ? `<button class="btn primary xl wide" data-act="next">${t("next")}</button>` : `<button class="btn ghost xl wide" data-act="force">${t("revealNow")}</button>`) : ""), { cls: "game", awake: true });
        return SD.bind(app, {
          ...O.baseHandlers(c), next,
          ans: (e, el) => c.setState({ ["ha/" + c.uid]: el.dataset.v }),
          force: () => { const u = {}; guessers.forEach(p => { if (ans[p.uid] === right) u["scores/" + p.uid] = (scores[p.uid] || 0) + 1; }); c.setState({ phase: "bonusRev", ...u }); }
        });
      }
    }
  };

  /* ================= Plus ou Moins musical ================= */
  O.games.ohl = {
    options: [...musicOptions, { k: "rounds", def: 10, label: () => t("nbQuestions"), choices: () => [[5, "5"], [10, "10"], [15, "15"]] }],
    start: c => ({ phase: "load", n: 1, total: +O.opt(c, "rounds", 10), song: null, q: null, ans: null, scores: null, used: null }),
    view: c => {
      const s = c.state, scores = s.scores || {}, ans = s.ans || {}, song = s.song;
      const board = `<div class="scoreboard">${c.players.map(p => `<span class="score ${ans[p.uid] ? "on" : ""}">${esc(p.name)} <b>${scores[p.uid] || 0}</b></span>`).join("")}</div>`;
      if (s.phase === "end") {
        stopAudio();
        const min = Math.min(...c.players.map(p => scores[p.uid] || 0));
        const losers = c.players.filter(p => (scores[p.uid] || 0) === min).map(p => p.uid);
        const app = SD.render(O.frame(c, `<p class="eyebrow">${t("results")}</p>${O.scoreList(c, scores, losers)}
          <h1 class="display">${t("quizQueue", { names: losers.map(u => `<span class="hl">${esc(c.name(u))}</span>`).join(", ") })}</h1>
          <div class="btn-col">${O.endButtons(c, losers)}</div>`), { cls: "game", awake: true });
        return SD.bind(app, { ...O.baseHandlers(c), ...O.endHandlers(c) });
      }
      if (s.phase === "load") {
        if (c.isHost && !O._loading) {
          O._loading = true;
          loadSong(c, s.used || {}).then(sg => { O._loading = false; c.setState({ phase: "ask", song: sg, q: O.makeHL(sg), ans: null, ["used/" + sg.i]: true }); }, () => { O._loading = false; });
        }
        const app = SD.render(O.frame(c, `${board}<p class="eyebrow">${t("question", { i: s.n, n: s.total })}</p><div class="spinner"></div><p class="lead">${t("muLoadingHl")}</p>`), { cls: "game", awake: true });
        return SD.bind(app, O.baseHandlers(c));
      }
      const q = s.q, labels = hlLabels(q), right = hlRight(q);
      if (s.phase === "ask" && c.isHost && c.online.every(p => ans[p.uid])) {
        const u = {}; c.online.forEach(p => { if (ans[p.uid] === right) u["scores/" + p.uid] = (scores[p.uid] || 0) + 1; });
        return c.setState({ phase: "rev", ...u });
      }
      const rev = s.phase === "rev", mine = ans[c.uid];
      const app = SD.render(O.frame(c, `${board}<p class="eyebrow">${t("question", { i: s.n, n: s.total })}</p>
        ${songCard(song)}
        ${song.preview ? `<button class="btn ghost small" data-act="listen">▶ ${t("muListen")}</button>` : ""}
        <h1 class="display hl-q">${hlText(q, song)}</h1>
        ${rev ? `<p class="verdict good">${hlTruth(q, song)}</p>
          <div class="result-list small">${c.online.map(p => `<div class="rrow ${ans[p.uid] === right ? "" : "lose"}"><span>${esc(p.name)}</span><b>${ans[p.uid] ? (ans[p.uid] === right ? "+1" : "✗") : "—"}</b></div>`).join("")}</div>${credit(song)}`
          : `<div class="hl-btns"><button class="vote ${mine === "less" ? "on" : ""}" data-act="ans" data-v="less">▼ ${labels[0]}</button><button class="vote ${mine === "more" ? "on" : ""}" data-act="ans" data-v="more">▲ ${labels[1]}</button></div>
          <p class="hint tabnum">${t("votedCount", { n: c.online.filter(p => ans[p.uid]).length, m: c.online.length })}</p>`}`,
        c.isHost ? (rev ? `<button class="btn primary xl wide" data-act="next">${s.n >= s.total ? t("seeResults") : t("next")}</button>` : `<button class="btn ghost xl wide" data-act="force">${t("revealNow")}</button>`) : ""), { cls: "game", awake: true });
      SD.bind(app, {
        ...O.baseHandlers(c),
        listen: () => playFor(song.preview, 15),
        ans: (e, el) => c.setState({ ["ans/" + c.uid]: el.dataset.v }),
        force: () => { const u = {}; c.online.forEach(p => { if (ans[p.uid] === right) u["scores/" + p.uid] = (scores[p.uid] || 0) + 1; }); c.setState({ phase: "rev", ...u }); },
        next: () => { stopAudio(); s.n >= s.total ? c.setState({ phase: "end" }) : c.setState({ phase: "load", n: s.n + 1, song: null, q: null, ans: null, qz: null }); }
      });
    }
  };
  O.games.oblind.sound = true;
  O.games.ohl.sound = true;
})();
