// Writes _data/shows.json so Jekyll can render the show list into the HTML.
//
// Live edits land in Netlify Blobs and the page also fetches /api/shows in the
// browser, so this step is only about what ships inside the built HTML. Reading
// Blobs from a build needs SITE_ID plus NETLIFY_API_TOKEN. Without them the
// build still succeeds and the browser fills the list in.

import { readFile, writeFile } from "node:fs/promises";
import { DEFAULT_TZ, decorate, upcoming } from "../netlify/shared/showtime.mjs";
import { readShows } from "../netlify/shared/store.mjs";

const OUTPUT = "_data/shows.json";
const SAMPLE = "seed/shows.sample.json";
const timezone = process.env.BAND_TIMEZONE || DEFAULT_TZ;
const onNetlify = Boolean(process.env.NETLIFY);

function say(message) {
  process.stdout.write(`[shows] ${message}\n`);
}

async function fromStore() {
  try {
    const rows = await readShows();
    if (rows === null) {
      say("the store is empty, nothing has been saved from the admin panel yet");
      return [];
    }
    say(`read ${rows.length} show(s) from Netlify Blobs`);
    return rows;
  } catch (error) {
    say(`could not read Netlify Blobs (${error?.message || error})`);
    return null;
  }
}

async function fromSample() {
  try {
    return JSON.parse(await readFile(SAMPLE, "utf8"));
  } catch {
    return [];
  }
}

const stored = await fromStore();
let rows = stored;

if (rows === null) {
  if (onNetlify) {
    say("building with an empty list; the browser will load the real one from /api/shows");
    say("to put shows in the HTML too, set SITE_ID and NETLIFY_API_TOKEN in the site environment");
    rows = [];
  } else {
    rows = await fromSample();
    say(`using ${rows.length} sample show(s) from ${SAMPLE} for local work`);
  }
}

const rendered = upcoming(rows, timezone).map((row) => decorate(row, timezone));
await writeFile(OUTPUT, `${JSON.stringify(rendered, null, 2)}\n`, "utf8");
say(`wrote ${rendered.length} upcoming show(s) to ${OUTPUT}`);
