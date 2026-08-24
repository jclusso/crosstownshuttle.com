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
  const saveButton = $("[data-save]");
  const revertButton = $("[data-revert]");

  const FIELDS = ["id", "date", "start_time", "end_time", "venue", "city", "address", "url", "notes"];

  let saved = [];
  let dirty = false;

  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const reveal = (element) => element && (element.hidden = false);
  const conceal = (element) => element && (element.hidden = true);

  function status(message, tone = "muted") {
    editorStatus.textContent = message;
    editorStatus.classList.remove("text-muted", "text-brand", "text-chalk");
    editorStatus.classList.add(tone === "error" ? "text-brand" : tone === "strong" ? "text-chalk" : "text-muted");
  }

  function problem(message) {
    if (!message) {
      editorError.classList.add("hidden");
      editorError.textContent = "";
      return;
    }
    editorError.textContent = message;
    editorError.classList.remove("hidden");
    editorError.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function markDirty() {
    dirty = true;
    status("You have changes that are not saved yet.", "strong");
  }

  function refreshRowMeta() {
    const stamp = today();
    $$("[data-show-row]", rows).forEach((row, index) => {
      const date = $('[data-field="date"]', row).value;
      const venue = $('[data-field="venue"]', row).value.trim();
      $("[data-row-label]", row).textContent = venue || `Show ${index + 1}`;
      $("[data-row-past]", row).classList.toggle("hidden", !(date && date < stamp));
    });
    editorEmpty.classList.toggle("hidden", $$("[data-show-row]", rows).length > 0);
  }

  function addRow(show = {}) {
    const row = template.content.firstElementChild.cloneNode(true);
    FIELDS.forEach((name) => {
      const input = $(`[data-field="${name}"]`, row);
      if (input) input.value = show[name] ?? "";
    });

    $("[data-remove-show]", row).addEventListener("click", () => {
      row.remove();
      refreshRowMeta();
      markDirty();
    });

    $$("input", row).forEach((input) => {
      input.addEventListener("input", () => {
        refreshRowMeta();
        markDirty();
      });
    });

    rows.append(row);
    return row;
  }

  function forEditing(shows) {
    const stamp = today();
    const ahead = shows.filter((show) => show.date >= stamp).sort((a, b) => a.date.localeCompare(b.date));
    const behind = shows.filter((show) => show.date < stamp).sort((a, b) => b.date.localeCompare(a.date));
    return [...ahead, ...behind];
  }

  function paint(shows) {
    rows.replaceChildren();
    forEditing(shows).forEach((show) => addRow(show));
    refreshRowMeta();
  }

  function collect() {
    return $$("[data-show-row]", rows).map((row) => {
      const entry = {};
      FIELDS.forEach((name) => {
        const input = $(`[data-field="${name}"]`, row);
        // Some browsers hand back seconds on a time input.
        entry[name] = input ? input.value.trim().slice(0, name.endsWith("_time") ? 5 : undefined) : "";
      });
      return entry;
    });
  }

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

  async function loadShows() {
    const { ok, body } = await api("/api/shows?scope=all");
    if (!ok) {
      problem(body.error || "Could not load the show list.");
      return;
    }
    saved = Array.isArray(body.shows) ? body.shows : [];
    paint(saved);
    dirty = false;
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
    if (dirty && !window.confirm("You have changes that are not saved. Sign out anyway?")) return;
    await api("/api/logout", { method: "POST" });
    openLogin("You are signed out.");
  });

  addButton?.addEventListener("click", () => {
    const row = addRow();
    refreshRowMeta();
    markDirty();
    $('[data-field="date"]', row).focus();
    row.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  revertButton?.addEventListener("click", () => {
    if (dirty && !window.confirm("Throw away the changes you have not saved?")) return;
    problem("");
    paint(saved);
    dirty = false;
    status("Back to the saved list.");
  });

  saveButton?.addEventListener("click", async () => {
    problem("");
    const blank = $$("[data-show-row]", rows).find(
      (row) => !$('[data-field="date"]', row).value || !$('[data-field="venue"]', row).value.trim()
    );
    if (blank) {
      problem("Every show needs a date and a venue name.");
      blank.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving";
    status("Saving.");

    const { ok, statusCode, body } = await api("/api/shows?scope=all", {
      method: "PUT",
      body: JSON.stringify({ shows: collect() }),
    });

    saveButton.disabled = false;
    saveButton.textContent = "Save";

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
    paint(saved);
    dirty = false;
    status("Saved. The website is up to date.");
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
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
