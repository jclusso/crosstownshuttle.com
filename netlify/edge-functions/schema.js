// Puts the current shows into the homepage JSON-LD.
//
// The visible list comes from /api/shows in the browser, so it is always
// current. Crawlers do not run that script, so the built HTML would otherwise
// carry no events at all. This reads the same endpoint and writes the "event"
// array into the MusicGroup block that _includes/schema.html already renders.
//
// The response is cached for a day, so a show that has gone by leaves the
// structured data within 24 hours without a rebuild. Netlify needs both
// `cache: "manual"` and a cache header before it will cache this at all.

const SCHEMA_BLOCK = /(<script type="application\/ld\+json" data-band-schema>)([\s\S]*?)(<\/script>)/;

function toEvent(show, performerId, bandName) {
  const event = {
    "@type": "MusicEvent",
    name: `${bandName} at ${show.venue}`,
    startDate: show.starts_at,
  };

  if (show.ends_at) event.endDate = show.ends_at;

  event.eventStatus = "https://schema.org/EventScheduled";
  event.eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode";
  event.performer = { "@id": performerId };
  event.location = { "@type": "Place", name: show.venue };

  if (show.city) event.location.address = show.city;
  if (show.map_url) event.location.hasMap = show.map_url;

  return event;
}

export function withEvents(html, shows) {
  if (!shows.length) return html;

  return html.replace(SCHEMA_BLOCK, (whole, open, json, close) => {
    let band;
    try {
      band = JSON.parse(json);
    } catch {
      return whole;
    }
    band.event = shows.map((show) => toEvent(show, band["@id"], band.name));
    return `${open}\n${JSON.stringify(band, null, 2)}\n${close}`;
  });
}

async function readShows(request) {
  try {
    const response = await fetch(new URL("/api/shows", request.url), {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return [];
    const body = await response.json();
    // null means nobody has saved from the admin panel yet.
    return Array.isArray(body.shows) ? body.shows : [];
  } catch {
    return [];
  }
}

export default async (request, context) => {
  const response = await context.next();

  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const patched = withEvents(html, await readShows(request));

  const next = new Response(patched, response);
  next.headers.delete("content-length");
  next.headers.set("Netlify-CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
  next.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return next;
};

export const config = { path: "/", cache: "manual" };
