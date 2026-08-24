(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const boot = $("[data-boot]");
  const login = $("[data-login]");
  const editor = $("[data-editor]");
  const signOut = $("[data-sign-out]");

  const loginForm = $("[data-login-form]");
  const loginError = $("[data-login-error]");
  const loginSubmit = $("[data-login-submit]");

  const rows = $("[data-show-rows]");
  const template = $("[data-show-template]");
  const editorEmpty = $("[data-editor-empty]");
  const editorError = $("[data-editor-error]");
  const editorStatus = $("[data-editor-status]");
  const addButton = $("[data-add-show]");
  const filterButtons = $$("[data-filter]");

  const FIELDS = ["id", "date", "start_time", "end_time", "venue", "city", "address", "url", "notes"];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  const EMPTY = {
    upcoming: ["No shows coming up", 'Press "Add a show" to put the next date on the website.'],
    past: ["No shows have gone by", "A show moves here the day after it happens."],
    all: ["Nothing on the list", 'Press "Add a show" to put your first date on the website.'],
  };

  let saved = [];
  let listing = "upcoming";
  let draft = false;
  let openRow = null;
  let openDirty = false;

  const reveal = (element) => element && (element.hidden = false);
  const conceal = (element) => element && (element.hidden = true);

  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const byDate = (a, b) =>
    `${a.date} ${a.start_time || "00:00"}`.localeCompare(`${b.date} ${b.start_time || "00:00"}`);

  function status(message, tone = "muted") {
    editorStatus.textContent = message;
    editorStatus.classList.remove("text-muted", "text-brand", "text-chalk");
    editorStatus.classList.add(tone === "error" ? "text-brand" : tone === "strong" ? "text-chalk" : "text-muted");
  }

  function problem(message) {
    if (!message) {
      conceal(editorError);
      editorError.textContent = "";
      return;
    }
    editorError.textContent = message;
    reveal(editorError);
    editorError.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function rowProblem(row, message) {
    const holder = $("[data-row-error]", row);
    holder.textContent = message || "";
    holder.hidden = !message;
  }

  /* Display ---------------------------------------------------------------- */

  function clock(value) {
    if (!TIME_RE.test(value || "")) return null;
    const [h, m] = value.split(":").map(Number);
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return {
      meridiem: h < 12 ? "AM" : "PM",
      label: m === 0 ? `${hour12}` : `${hour12}:${String(m).padStart(2, "0")}`,
    };
  }

  function timeLabel(start, end) {
    const a = clock(start);
    const b = clock(end);
    if (!a && !b) return "";
    if (a && !b) return `${a.label} ${a.meridiem}`;
    if (!a && b) return `until ${b.label} ${b.meridiem}`;
    return a.meridiem === b.meridiem
      ? `${a.label} - ${b.label} ${b.meridiem}`
      : `${a.label} ${a.meridiem} - ${b.label} ${b.meridiem}`;
  }

  function dateParts(value) {
    if (!DATE_RE.test(value)) return { weekday: "TBD", day: "—", month: "" };
    // Noon UTC keeps the calendar day stable no matter the viewer's offset.
    const [y, m, d] = value.split("-").map(Number);
    const at = new Date(Date.UTC(y, m - 1, d, 12));
    const fmt = (options) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(at);
    return {
      weekday: fmt({ weekday: "short" }).toUpperCase(),
      day: String(at.getUTCDate()),
      month: fmt({ month: "short" }).toUpperCase(),
    };
  }

  /* List ------------------------------------------------------------------- */

  function listed() {
    const stamp = today();
    const sorted = [...saved].sort(byDate);
    const ahead = sorted.filter((show) => show.date >= stamp);
    const behind = sorted.filter((show) => show.date < stamp).reverse();
    if (listing === "upcoming") return ahead;
    if (listing === "past") return behind;
    return [...ahead, ...behind];
  }

  function counts() {
    const stamp = today();
    const ahead = saved.filter((show) => show.date >= stamp).length;
    return { upcoming: ahead, past: saved.length - ahead, all: saved.length };
  }

  function refreshChrome() {
    const tally = counts();
    filterButtons.forEach((button) => {
      const name = button.dataset.filter;
      const active = name === listing;
      $(`[data-count="${name}"]`, button).textContent = String(tally[name]);
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("btn-brand", active);
      button.classList.toggle("btn-quiet", !active);
    });

    const bare = rows.children.length === 0;
    editorEmpty.hidden = !bare;
    if (bare) {
      const [title, text] = EMPTY[listing];
      $("[data-empty-title]", editorEmpty).textContent = title;
      $("[data-empty-text]", editorEmpty).textContent = text;
    }
  }

  /* Rows ------------------------------------------------------------------- */

  function value(row, name) {
    const input = $(`[data-field="${name}"]`, row);
    return input ? input.value.trim() : "";
  }

  function fill(row, show) {
    FIELDS.forEach((name) => {
      const input = $(`[data-field="${name}"]`, row);
      if (input) input.value = show[name] ?? "";
    });
  }

  function collect(row) {
    const entry = {};
    FIELDS.forEach((name) => {
      // Some browsers hand back seconds on a time input.
      entry[name] = value(row, name).slice(0, name.endsWith("_time") ? 5 : undefined);
    });
    return entry;
  }

  function refreshSummary(row) {
    const date = value(row, "date");
    const parts = dateParts(date);
    $("[data-summary-weekday]", row).textContent = parts.weekday;
    $("[data-summary-day]", row).textContent = parts.day;
    $("[data-summary-month]", row).textContent = parts.month;
    $("[data-summary-venue]", row).textContent = value(row, "venue") || "New show";
    $("[data-summary-meta]", row).textContent = [
      value(row, "city"),
      timeLabel(value(row, "start_time"), value(row, "end_time")),
    ]
      .filter(Boolean)
      .join(" | ");
    $("[data-summary-past]", row).hidden = !(date && date < today());
  }

  function expand(row) {
    $("[data-form]", row).hidden = false;
    $("[data-edit-show]", row).hidden = true;
    row.classList.add("border-line-bright");
    openRow = row;
    openDirty = false;
  }

  function collapse(row) {
    $("[data-form]", row).hidden = true;
    $("[data-edit-show]", row).hidden = false;
    row.classList.remove("border-line-bright");
    rowProblem(row, "");
    if (openRow === row) {
      openRow = null;
      openDirty = false;
    }
  }

  function restore(row) {
    if (row.dataset.draft === "true") {
      draft = false;
      row.remove();
      openRow = null;
      openDirty = false;
      refreshChrome();
      return;
    }
    const show = saved.find((entry) => entry.id === value(row, "id"));
    if (show) fill(row, show);
    refreshSummary(row);
    collapse(row);
  }

  function releaseOpen() {
    if (!openRow) return true;
    if (openDirty && !window.confirm("Throw away the changes you have not saved?")) return false;
    restore(openRow);
    return true;
  }

  function buildRow(show, isDraft = false) {
    const row = template.content.firstElementChild.cloneNode(true);
    if (isDraft) row.dataset.draft = "true";
    fill(row, show);
    refreshSummary(row);

    $("[data-edit-show]", row).addEventListener("click", () => {
      if (!releaseOpen()) return;
      expand(row);
      $('[data-field="date"]', row).focus();
    });

    $("[data-cancel-edit]", row).addEventListener("click", () => {
      if (openDirty && !window.confirm("Throw away the changes you have not saved?")) return;
      restore(row);
    });

    $("[data-save-show]", row).addEventListener("click", () => saveRow(row));
    $("[data-remove-show]", row).addEventListener("click", () => removeRow(row));

    $$("input", row).forEach((input) => {
      input.addEventListener("input", () => {
        refreshSummary(row);
        rowProblem(row, "");
        openDirty = true;
        status("You have changes that are not saved yet.", "strong");
      });
    });

    return row;
  }

  function paint() {
    rows.replaceChildren();
    draft = false;
    openRow = null;
    openDirty = false;
    listed().forEach((show) => rows.append(buildRow(show)));
    refreshChrome();
  }

  /* Talking to the API ----------------------------------------------------- */

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) },
      ...options,
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      // A gateway error can come back as HTML.
    }
    return { ok: response.ok, statusCode: response.status, body };
  }

  async function commit(next, message, busy) {
    problem("");
    if (busy) busy.disabled = true;
    status("Saving.");

    const { ok, statusCode, body } = await api("/api/shows?scope=all", {
      method: "PUT",
      body: JSON.stringify({ shows: next }),
    });

    if (busy) busy.disabled = false;

    if (statusCode === 401) {
      openLogin("Your sign in ran out. Please sign in again.");
      return;
    }
    if (!ok) {
      problem(body.error || "Could not save. Please try again.");
      status("Not saved.", "error");
      return;
    }

    saved = Array.isArray(body.shows) ? body.shows : [];
    paint();
    status(message);
  }

  async function saveRow(row) {
    const entry = collect(row);
    if (!entry.date) {
      rowProblem(row, "This show needs a date.");
      return;
    }
    if (!entry.venue) {
      rowProblem(row, "This show needs a venue name.");
      return;
    }
    rowProblem(row, "");

    const known = entry.id && saved.some((show) => show.id === entry.id);
    const next = known ? saved.map((show) => (show.id === entry.id ? entry : show)) : [...saved, entry];
    await commit(next, "Saved. The website is up to date.", $("[data-save-show]", row));
  }

  async function removeRow(row) {
    if (row.dataset.draft === "true") {
      restore(row);
      status("Left the new show off the list.");
      return;
    }
    const id = value(row, "id");
    const name = value(row, "venue") || "this show";
    if (!window.confirm(`Remove ${name} from the list?`)) return;
    await commit(saved.filter((show) => show.id !== id), "Removed from the list.", $("[data-remove-show]", row));
  }

  async function loadShows() {
    const { ok, body } = await api("/api/shows?scope=all");
    if (!ok) {
      problem(body.error || "Could not load the show list.");
      return;
    }
    saved = Array.isArray(body.shows) ? body.shows : [];
    paint();
    status(saved.length ? `${saved.length} show${saved.length === 1 ? "" : "s"} on the list.` : "Nothing on the list yet.");
  }

  function openEditor() {
    conceal(boot);
    conceal(login);
    reveal(editor);
    signOut?.classList.remove("hidden");
    return loadShows();
  }

  function openLogin(message) {
    conceal(boot);
    conceal(editor);
    reveal(login);
    signOut?.classList.add("hidden");
    loginError.textContent = message || "";
    loginError.classList.toggle("hidden", !message);
    $("#admin-password")?.focus();
  }

  /* Wiring ---------------------------------------------------------------- */

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.classList.add("hidden");
    loginSubmit.disabled = true;
    loginSubmit.textContent = "Checking";

    const password = $("#admin-password").value;
    const { ok, body } = await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });

    loginSubmit.disabled = false;
    loginSubmit.textContent = "Sign in";

    if (!ok) {
      loginError.textContent = body.error || "That did not work.";
      loginError.classList.remove("hidden");
      return;
    }

    $("#admin-password").value = "";
    await openEditor();
  });

  signOut?.addEventListener("click", async () => {
    if (openDirty && !window.confirm("You have changes that are not saved. Sign out anyway?")) return;
    await api("/api/logout", { method: "POST" });
    openLogin("You are signed out.");
  });

  addButton?.addEventListener("click", () => {
    if (!releaseOpen()) return;
    const row = buildRow({}, true);
    draft = true;
    rows.prepend(row);
    refreshChrome();
    expand(row);
    $('[data-field="date"]', row).focus();
    row.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.filter;
      if (next === listing) return;
      if (!releaseOpen()) return;
      problem("");
      listing = next;
      paint();
    });
  });

  window.addEventListener("beforeunload", (event) => {
    if (!openDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  /* Start ----------------------------------------------------------------- */

  (async () => {
    const { ok, body } = await api("/api/session");
    if (ok && body.configured === false) {
      openLogin("The admin panel is not set up yet. ADMIN_PASSWORD and SESSION_SECRET are missing.");
      return;
    }
    if (ok && body.authenticated) {
      await openEditor();
      return;
    }
    openLogin();
  })();
})();
