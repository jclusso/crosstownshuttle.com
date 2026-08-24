import { isSignedIn, json } from "../shared/auth.mjs";
import { readShows, writeShows } from "../shared/store.mjs";
import { sanitizeShows } from "../shared/validate.mjs";
import { DEFAULT_TZ, byDate, decorate, upcoming } from "../shared/showtime.mjs";

const timezone = process.env.BAND_TIMEZONE || DEFAULT_TZ;

async function pokeBuild() {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) return;
  try {
    // Refreshes the static HTML. The live page already has the new data.
    await fetch(hook, { method: "POST", body: "{}" });
  } catch {
    // A failed rebuild must not fail the save.
  }
}

function present(rows, scope) {
  const selected = scope === "all" ? [...rows].sort(byDate) : upcoming(rows, timezone);
  return selected.map((row) => decorate(row, timezone));
}

export default async (request) => {
  const scope = new URL(request.url).searchParams.get("scope");

  if (request.method === "GET") {
    let stored;
    try {
      stored = await readShows();
    } catch (error) {
      return json({ error: "Could not reach the show list.", detail: String(error?.message || error) }, 502);
    }
    // null means nobody has saved yet, so the page keeps whatever it was built with.
    if (stored === null) return json({ shows: null });
    return json({ shows: present(stored, scope) });
  }

  if (request.method === "PUT") {
    if (!isSignedIn(request)) return json({ error: "Please sign in again." }, 401);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Send JSON." }, 400);
    }

    const { shows, errors } = sanitizeShows(body?.shows);
    if (errors.length) return json({ error: errors.join(" "), errors }, 422);

    try {
      await writeShows(shows);
    } catch (error) {
      return json({ error: "Could not save the show list.", detail: String(error?.message || error) }, 502);
    }

    await pokeBuild();
    return json({ ok: true, shows: present(shows, scope) });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config = { path: "/api/shows" };
