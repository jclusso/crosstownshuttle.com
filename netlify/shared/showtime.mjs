export const DEFAULT_TZ = "America/New_York";

export const LIMITS = {
  shows: 200,
  venue: 120,
  city: 120,
  notes: 280,
  url: 300,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function todayInTz(tz = DEFAULT_TZ, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// Noon UTC keeps the calendar day stable no matter the viewer's offset.
function noonUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function clock(value) {
  if (!TIME_RE.test(value || "")) return null;
  const [h, m] = value.split(":").map(Number);
  const meridiem = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return {
    meridiem,
    label: m === 0 ? `${hour12}` : `${hour12}:${String(m).padStart(2, "0")}`,
  };
}

function timeDisplay(start, end) {
  const a = clock(start);
  const b = clock(end);
  if (!a && !b) return "";
  if (a && !b) return `${a.label} ${a.meridiem}`;
  if (!a && b) return `until ${b.label} ${b.meridiem}`;
  return a.meridiem === b.meridiem
    ? `${a.label} - ${b.label} ${b.meridiem}`
    : `${a.label} ${a.meridiem} - ${b.label} ${b.meridiem}`;
}

function utcOffset(at, tz) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  if (!name) return "Z";
  const offset = name.replace("GMT", "");
  return offset === "" ? "Z" : offset;
}

function mapUrl(show) {
  if (show.map_url) return show.map_url;
  const query = [show.venue, show.city].filter(Boolean).join(" ").trim();
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Adds the display-only fields the page and the JSON-LD read. */
export function decorate(show, tz = DEFAULT_TZ) {
  const at = noonUtc(show.date);
  const fmt = (options) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(at);
  const offset = utcOffset(at, tz);

  return {
    ...show,
    weekday: fmt({ weekday: "short" }).toUpperCase(),
    day: String(at.getUTCDate()),
    month: fmt({ month: "short" }).toUpperCase(),
    year: String(at.getUTCFullYear()),
    date_display: fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    time_display: timeDisplay(show.start_time, show.end_time),
    starts_at: show.start_time ? `${show.date}T${show.start_time}:00${offset}` : show.date,
    ends_at: show.end_time ? `${show.date}T${show.end_time}:00${offset}` : "",
    directions_url: mapUrl(show),
  };
}

export function byDate(a, b) {
  return `${a.date} ${a.start_time || "00:00"}`.localeCompare(`${b.date} ${b.start_time || "00:00"}`);
}

export function upcoming(shows, tz = DEFAULT_TZ, now = new Date()) {
  const today = todayInTz(tz, now);
  return shows.filter((show) => show.date >= today).sort(byDate);
}
