/* Дорожные знаки — флеш-карточки */
(function () {
  "use strict";

  const ALL = Array.isArray(window.SIGN_DATA) ? window.SIGN_DATA.slice() : [];
  const ICON_DIR = "icons/";
  const STORAGE_KEY = "road-signs-progress-v2";

  // ---------- Категории ----------
  const CATEGORIES = [
    { key: "all", label: "Все знаки" },
    { key: "warning", label: "Предупреждающие" },
    { key: "priority", label: "Приоритета" },
    { key: "prohibition", label: "Запрещающие" },
    { key: "mandatory", label: "Предписывающие" },
    { key: "special", label: "Особых предписаний" },
  ];

  const STATUS = {
    known: { label: "Знаю", cls: "known" },
    unknown: { label: "Не знаю", cls: "unknown" },
    todo: { label: "Не изучено", cls: "todo" },
  };

  // ---------- Состояние ----------
  const state = {
    category: "all",
    deck: [],
    index: 0,
    flipped: false,
    shuffled: true,
    hideKnown: false,
    known: new Set(),
    unknown: new Set(),
    summaryFilter: "all",
  };

  // ---------- Хранилище ----------
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.known = new Set(data.known || []);
        state.unknown = new Set(data.unknown || []);
        return;
      }
      // миграция со старого ключа v1
      const old = localStorage.getItem("road-signs-known-v1");
      if (old) state.known = new Set(JSON.parse(old));
    } catch (e) { /* игнорируем */ }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        known: [...state.known],
        unknown: [...state.unknown],
      }));
    } catch (e) { /* игнорируем */ }
  }

  function statusOf(id) {
    if (state.known.has(id)) return "known";
    if (state.unknown.has(id)) return "unknown";
    return "todo";
  }

  // ---------- DOM ----------
  const el = {
    filters: document.getElementById("filters"),
    card: document.getElementById("card"),
    frontId: document.getElementById("front-id"),
    frontStatus: document.getElementById("front-status"),
    frontImg: document.getElementById("front-img"),
    backId: document.getElementById("back-id"),
    backName: document.getElementById("back-name"),
    backCat: document.getElementById("back-cat"),
    backNote: document.getElementById("back-note"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    statKnown: document.getElementById("stat-known"),
    statUnknown: document.getElementById("stat-unknown"),
    statTotal: document.getElementById("stat-total"),
    btnPrev: document.getElementById("btn-prev"),
    btnNext: document.getElementById("btn-next"),
    btnFlip: document.getElementById("btn-flip"),
    btnKnow: document.getElementById("btn-know"),
    btnUnknown: document.getElementById("btn-unknown"),
    btnShuffle: document.getElementById("btn-shuffle"),
    btnReset: document.getElementById("btn-reset"),
    btnSummary: document.getElementById("btn-summary"),
    hideKnown: document.getElementById("hide-known"),
    modal: document.getElementById("modal"),
    overallFill: document.getElementById("overall-fill"),
    overallText: document.getElementById("overall-text"),
    modalCounts: document.getElementById("modal-counts"),
    modalTabs: document.getElementById("modal-tabs"),
    modalTbody: document.getElementById("modal-tbody"),
  };

  // ---------- Набор карточек ----------
  function inCategory(sign) {
    return state.category === "all" || sign.category === state.category;
  }

  function buildDeck(resetPosition) {
    let list = ALL.filter(inCategory);
    if (state.hideKnown) list = list.filter((s) => !state.known.has(s.id));
    if (state.shuffled) list = shuffle(list.slice());
    state.deck = list;
    if (resetPosition) state.index = 0;
    if (state.index >= state.deck.length) state.index = Math.max(0, state.deck.length - 1);
    render();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function syncShuffleButton() {
    el.btnShuffle.classList.toggle("is-active", state.shuffled);
    el.btnShuffle.textContent = state.shuffled ? "🔀 Перемешано" : "🔀 Перемешать";
  }

  // ---------- Отрисовка ----------
  function render() {
    renderFilters();
    renderCard();
    renderProgress();
    renderStats();
  }

  function renderFilters() {
    el.filters.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const total = cat.key === "all" ? ALL.length : ALL.filter((s) => s.category === cat.key).length;
      const btn = document.createElement("button");
      btn.className = "filter" + (state.category === cat.key ? " is-active" : "");
      btn.innerHTML = `${cat.label} <span class="filter__count">${total}</span>`;
      btn.addEventListener("click", () => {
        if (state.category === cat.key) return;
        state.category = cat.key;
        state.flipped = false;
        buildDeck(true);
      });
      el.filters.appendChild(btn);
    });
  }

  function currentSign() {
    return state.deck[state.index] || null;
  }

  function renderCard() {
    const sign = currentSign();
    el.card.classList.toggle("is-flipped", state.flipped);

    if (!sign) {
      el.card.classList.add("is-empty");
      el.frontImg.removeAttribute("src");
      el.frontImg.style.display = "none";
      el.frontId.textContent = "—";
      el.frontId.style.display = "none";
      el.frontStatus.hidden = true;
      el.backId.style.display = "none";
      el.backName.innerHTML =
        state.hideKnown
          ? '<div class="empty-msg"><strong>Всё выучено! 🎉</strong>Снимите галочку «Только невыученные» или сбросьте прогресс.</div>'
          : '<div class="empty-msg"><strong>Нет знаков</strong>В этой категории пока нет карточек.</div>';
      el.backCat.textContent = "";
      el.backNote.textContent = "";
      setControlsEnabled(false);
      return;
    }

    el.card.classList.remove("is-empty");
    el.frontImg.style.display = "";
    el.frontId.style.display = "";
    el.backId.style.display = "";
    setControlsEnabled(true);

    el.frontId.textContent = sign.id;
    el.frontImg.src = ICON_DIR + sign.file;
    el.frontImg.alt = "Знак " + sign.id + " — " + sign.name;

    // статус на лицевой стороне
    const st = statusOf(sign.id);
    if (st === "todo") {
      el.frontStatus.hidden = true;
    } else {
      el.frontStatus.hidden = false;
      el.frontStatus.textContent = STATUS[st].label;
      el.frontStatus.className = "card__status card__status--" + STATUS[st].cls;
    }

    el.backId.textContent = sign.id;
    el.backName.textContent = sign.name;
    el.backCat.textContent = sign.categoryName;
    el.backNote.textContent = sign.note || "";

    el.btnKnow.textContent = st === "known" ? "✓ Знаю" : "✓ Знаю";
    el.btnUnknown.textContent = st === "unknown" ? "✗ Не знаю" : "✗ Не знаю";
  }

  function renderProgress() {
    const total = state.deck.length;
    const pos = total ? state.index + 1 : 0;
    el.progressText.textContent = `${pos} / ${total}`;
    el.progressFill.style.width = total ? (pos / total) * 100 + "%" : "0%";
  }

  function renderStats() {
    const scope = ALL.filter(inCategory);
    const known = scope.filter((s) => state.known.has(s.id)).length;
    const unknown = scope.filter((s) => state.unknown.has(s.id)).length;
    el.statKnown.textContent = known;
    el.statUnknown.textContent = unknown;
    el.statTotal.textContent = scope.length;
  }

  function setControlsEnabled(enabled) {
    [el.btnPrev, el.btnNext, el.btnFlip, el.btnKnow, el.btnUnknown]
      .forEach((b) => { b.disabled = !enabled; });
  }

  // ---------- Действия ----------
  function flip() {
    if (!currentSign()) return;
    state.flipped = !state.flipped;
    el.card.classList.toggle("is-flipped", state.flipped);
  }

  function next(step) {
    if (!state.deck.length) return;
    const n = state.deck.length;
    state.index = ((state.index + step) % n + n) % n;
    state.flipped = false;
    renderCard();
    renderProgress();
  }

  function grade(status) {
    const sign = currentSign();
    if (!sign) return;
    if (status === "known") {
      state.known.add(sign.id);
      state.unknown.delete(sign.id);
    } else if (status === "unknown") {
      state.unknown.add(sign.id);
      state.known.delete(sign.id);
    }
    saveProgress();

    if (state.hideKnown) {
      buildDeck(false);
    } else {
      renderCard();
    }
    renderStats();
    renderProgress();
    if (state.deck.length > 1) next(1);
  }

  function jumpTo(id) {
    state.category = "all";
    state.shuffled = false;
    state.hideKnown = false;
    syncShuffleButton();
    el.hideKnown.checked = false;
    buildDeck(true);
    const i = state.deck.findIndex((s) => s.id === id);
    if (i >= 0) {
      state.index = i;
      state.flipped = false;
      renderCard();
      renderProgress();
    }
    closeSummary();
  }

  function resetProgress() {
    if (!state.known.size && !state.unknown.size) return;
    if (!confirm("Сбросить весь прогресс по изученным знакам?")) return;
    state.known.clear();
    state.unknown.clear();
    saveProgress();
    buildDeck(true);
    if (!el.modal.hidden) renderSummary();
  }

  // ---------- Сводка ----------
  const SUMMARY_TABS = [
    { key: "all", label: "Все" },
    { key: "known", label: "Знаю" },
    { key: "unknown", label: "Не знаю" },
    { key: "todo", label: "Не изучено" },
  ];

  function counts() {
    const known = ALL.filter((s) => state.known.has(s.id)).length;
    const unknown = ALL.filter((s) => state.unknown.has(s.id)).length;
    return { known, unknown, todo: ALL.length - known - unknown, total: ALL.length };
  }

  function openSummary() {
    state.summaryFilter = "all";
    renderSummary();
    el.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSummary() {
    el.modal.hidden = true;
    document.body.style.overflow = "";
  }

  function renderSummary() {
    const c = counts();
    const pct = c.total ? Math.round((c.known / c.total) * 100) : 0;
    el.overallFill.style.width = pct + "%";
    el.overallText.textContent = pct + "%";

    el.modalCounts.innerHTML =
      `<span class="count-pill count-pill--known">Выучено <b>${c.known}</b></span>` +
      `<span class="count-pill count-pill--unknown">Ошибки <b>${c.unknown}</b></span>` +
      `<span class="count-pill count-pill--todo">Осталось <b>${c.todo}</b></span>` +
      `<span class="count-pill">Всего <b>${c.total}</b></span>`;

    el.modalTabs.innerHTML = "";
    SUMMARY_TABS.forEach((tab) => {
      const count = tab.key === "all" ? c.total : c[tab.key];
      const b = document.createElement("button");
      b.className = "modal__tab" + (state.summaryFilter === tab.key ? " is-active" : "");
      b.textContent = `${tab.label} (${count})`;
      b.addEventListener("click", () => {
        state.summaryFilter = tab.key;
        renderSummary();
      });
      el.modalTabs.appendChild(b);
    });

    const rows = ALL.filter((s) => {
      if (state.summaryFilter === "all") return true;
      return statusOf(s.id) === state.summaryFilter;
    });

    if (!rows.length) {
      el.modalTbody.innerHTML = `<tr><td colspan="4" class="sign-table__empty">Нет знаков в этой выборке</td></tr>`;
      return;
    }

    el.modalTbody.innerHTML = rows.map((s) => {
      const st = statusOf(s.id);
      return `<tr data-id="${s.id}">
        <td><img src="${ICON_DIR}${s.file}" alt="" loading="lazy" /></td>
        <td class="col-num">${s.id}</td>
        <td>${escapeHtml(s.name)}<span class="cat-sub">${s.categoryName}</span></td>
        <td><span class="status-badge status-badge--${STATUS[st].cls}">${STATUS[st].label}</span></td>
      </tr>`;
    }).join("");

    el.modalTbody.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", () => jumpTo(tr.getAttribute("data-id")));
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  // ---------- События ----------
  el.card.addEventListener("click", flip);
  el.card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
  });

  el.btnFlip.addEventListener("click", flip);
  el.btnPrev.addEventListener("click", () => next(-1));
  el.btnNext.addEventListener("click", () => next(1));
  el.btnKnow.addEventListener("click", () => grade("known"));
  el.btnUnknown.addEventListener("click", () => grade("unknown"));

  el.btnShuffle.addEventListener("click", () => {
    state.shuffled = !state.shuffled;
    syncShuffleButton();
    buildDeck(true);
  });

  el.hideKnown.addEventListener("change", (e) => {
    state.hideKnown = e.target.checked;
    state.flipped = false;
    buildDeck(true);
  });

  el.btnReset.addEventListener("click", resetProgress);
  el.btnSummary.addEventListener("click", openSummary);

  el.modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeSummary();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.modal.hidden) { closeSummary(); return; }
    if (!el.modal.hidden) return;
    if (e.target.matches("input, textarea, button")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); next(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); next(-1); }
    else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); flip(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); grade("known"); }
    else if (e.key === "ArrowDown") { e.preventDefault(); grade("unknown"); }
  });

  el.frontImg.addEventListener("error", () => { el.frontImg.style.visibility = "hidden"; });
  el.frontImg.addEventListener("load", () => { el.frontImg.style.visibility = "visible"; });

  // ---------- Старт ----------
  loadProgress();
  syncShuffleButton();
  buildDeck(true);
})();
