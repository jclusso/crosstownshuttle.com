(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* Show list ------------------------------------------------------------- */

  const showsRoot = $("[data-shows-root]");

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function showMarkup(show, isNext) {
    const dot = isNext ? "border-brand bg-brand" : "border-line-bright bg-ink";
    const weekday = isNext ? "text-brand" : "text-muted";
    const link = (href, label) => `
      <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
         class="font-display text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">${label}</a>`;

    const links = [
      show.map_url ? link(show.map_url, "Directions") : "",
      show.url ? link(show.url, "Venue page") : "",
    ].filter(Boolean).join("");

    return `
      <li class="relative pl-9 sm:pl-12" data-show-date="${escapeHtml(show.date)}">
        <span aria-hidden="true" class="absolute left-0.5 top-7 size-5 rounded-full border-[3px] ${dot}"></span>
        <article class="card">
          <div class="flex gap-4 p-4 sm:gap-6 sm:p-6">
            <div class="flex w-[4.25rem] shrink-0 flex-col border-2 border-line text-center sm:w-20">
              <p class="border-b-2 border-line bg-ink-700 py-1 font-display text-[0.65rem] font-bold uppercase tracking-[0.16em] ${weekday}">${escapeHtml(show.weekday)}</p>
              <div class="flex flex-1 flex-col justify-center px-1 py-2.5">
                <p class="font-display text-2xl font-extrabold leading-none sm:text-3xl">${escapeHtml(show.day)}</p>
                <p class="mt-1 font-display text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted">${escapeHtml(show.month)}</p>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <h3 class="text-xl leading-tight sm:text-2xl">${escapeHtml(show.venue)}</h3>
                ${isNext ? '<span class="plate plate-brand shrink-0 !px-2.5 !py-1.5 text-[0.6rem] tracking-[0.18em]">Next stop</span>' : ""}
              </div>
              <p class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
                ${show.city ? `<span>${escapeHtml(show.city)}</span>` : ""}
                ${show.city && show.time_display ? '<span aria-hidden="true" class="text-line-bright">|</span>' : ""}
                ${show.time_display ? `<span class="font-display font-bold uppercase tracking-[0.1em] text-chalk">${escapeHtml(show.time_display)}</span>` : ""}
              </p>
              ${show.notes ? `<p class="mt-2.5 text-sm leading-relaxed text-muted">${escapeHtml(show.notes)}</p>` : ""}
              ${links ? `<div class="mt-3.5 flex flex-wrap gap-x-4 gap-y-2">${links}</div>` : ""}
            </div>
          </div>
        </article>
      </li>`;
  }

  if (showsRoot) {
    const list = $("[data-shows-list]", showsRoot);
    const loading = $("[data-shows-loading]", showsRoot);
    const empty = $("[data-shows-empty]", showsRoot);
    const error = $("[data-shows-error]", showsRoot);

    // Exactly one of these is on screen at a time.
    const setState = (state) => {
      list.classList.toggle("hidden", state !== "list");
      list.classList.toggle("relative", state === "list");
      loading?.classList.toggle("hidden", state !== "loading");
      empty.classList.toggle("hidden", state !== "empty");
      error?.classList.toggle("hidden", state !== "error");
    };

    const render = (shows) => {
      const rail = '<span aria-hidden="true" class="absolute left-[0.65rem] top-4 bottom-4 w-0.5 bg-line"></span>';
      list.innerHTML = shows.length
        ? `${rail}<ol class="relative space-y-4">${shows.map((s, i) => showMarkup(s, i === 0)).join("")}</ol>`
        : "";
      setState(shows.length ? "list" : "empty");
    };

    // Never claim there are no dates before the function has answered.
    setState("loading");

    fetch("/api/shows", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        // null means nobody has saved from the admin panel yet.
        if (Array.isArray(data.shows)) render(data.shows);
        else setState("empty");
      })
      .catch(() => setState("error"));
  }

  /* Photo lightbox -------------------------------------------------------- */

  const lightbox = $("[data-lightbox]");

  if (lightbox && typeof lightbox.showModal === "function") {
    const image = $("[data-lightbox-image]", lightbox);
    const blank = image.getAttribute("src");

    $$("[data-lightbox-open]").forEach((button) => {
      button.addEventListener("click", () => {
        image.src = button.dataset.src;
        image.alt = button.dataset.alt || "";
        lightbox.showModal();
      });
    });

    $("[data-lightbox-close]", lightbox)?.addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", () => {
      image.src = blank;
      image.alt = "";
    });
  }

  /* Booking form ---------------------------------------------------------- */

  const form = $("[data-booking-form]");

  if (form) {
    const status = $("[data-booking-status]", form);
    const submit = $("[data-booking-submit]", form);

    const announce = (message, tone) => {
      status.textContent = message;
      status.classList.remove("hidden", "text-brand", "text-muted");
      status.classList.add(tone === "error" ? "text-brand" : "text-muted");
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = "Sending";
      announce("Sending your message.", "info");

      try {
        const response = await fetch(window.location.pathname, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!response.ok) throw new Error(String(response.status));

        form.reset();
        announce("Thanks. Your message is on its way and we will be in touch soon.", "info");
        submit.textContent = "Sent";
      } catch {
        submit.disabled = false;
        submit.textContent = original;
        announce("That did not send. Please try again, or email us instead.", "error");
      }
    });
  }
})();
