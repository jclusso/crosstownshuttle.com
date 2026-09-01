# crosstownshuttle.com

One page site for Crosstown Shuttle, plus a password protected panel at
`/band-admin` where the band adds and removes show dates.

Jekyll builds the page. Tailwind CSS v4 builds the styles. Netlify Functions and
Netlify Blobs hold the show list. Netlify Forms takes the booking inquiries.

## Setup

Needs Ruby 4.0.6 and Node 20 or newer.

```sh
bundle install
npm install
cp .env.example .env      # then set ADMIN_PASSWORD
```

## Running it

```sh
npm run serve   # netlify dev on :8888, with the functions and /band-admin working
npm run dev     # jekyll plus tailwind only, on :4000, no functions
npm run build   # what Netlify runs
```

Use `npm run serve` when you need `/band-admin` or `/api/shows`. Netlify Blobs
runs in a local sandbox, separate from the real site's data.

## Environment variables

`ADMIN_PASSWORD` is the only one. It is the password for `/band-admin`. Make it
long. Set it on Netlify under Site configuration, Environment variables.

The session cookie is signed with a key derived from the password, so changing
the password signs everyone out.

## How the show list works

`/api/shows` is the only source of truth. The build never reads the show list,
so nothing goes stale in the HTML. Two readers serve two audiences.

1. People. In the browser, `assets/js/site.js` calls `/api/shows` and renders
   the list. A save from `/band-admin` appears at once, with no deploy.
2. Crawlers. `netlify/edge-functions/schema.js` runs on `/`, calls the same
   endpoint, and writes the `event` array into the JSON-LD that
   `_includes/schema.html` renders. Crawlers do not run the browser script, so
   this is the only machine readable copy of the dates.

The edge function caches its response for a day, so the structured data catches
up with a change within 24 hours. It only ever rewrites JSON, so there is no
second copy of the show markup to keep in step.

While the browser request is in flight the section shows a skeleton shaped like
the real list. The "No dates on the board" message only appears once the
function has answered with an empty list, and a failed request says so instead
of claiming the list is empty. Without JavaScript, a `noscript` block shows a
short message and a link to the booking form.

All date and time formatting lives in `netlify/shared/showtime.mjs`. The
function imports it, and the edge function reads the formatted fields straight
off `/api/shows`, so there is one implementation. Times are always
America/New_York.

## Using the admin panel

Go to `/band-admin`, enter the password, and the show list opens. Each show is
one collapsed row that gives the date, the venue, the town and the time. Press
Edit on a row to open its fields, then press Save. Each show saves on its own.
Only the date and the venue are required.

The list gives the upcoming shows first. Press Past for the shows that have
already happened, or All for both. A past show keeps a "Past" mark, stays in the
list until someone removes it, and never shows on the public page.

The sign in lasts 30 days on that device.

One shared password, checked in constant time, is exchanged for an HMAC signed
cookie that is `HttpOnly` and `SameSite=Lax`. The password itself is never
stored in the browser. Failed sign ins are delayed to slow a script down, but
there is no lockout, so the password needs to be long. Everything sent to
`/api/shows` is re-validated on the server: dates must be real, only `http` and
`https` links survive, text is length capped, and unknown fields are dropped.

## Content the band owns

Everything except the show dates lives in two data files.

- `_data/band.yml` holds the names, roles, biographies, the hero copy, the
  booking text, and the social links. A blank social URL hides that icon. A
  blank `region` hides the location line in the hero. `genres` feeds the
  structured data search engines read and is left out entirely while empty.
  `kicker` is the small red line above the logo, `tagline` the big line below
  it.
- `_data/photos.yml` is the gallery list, in display order. The whole section
  disappears when the list is empty. `featured: true` makes a tile span two
  columns.

## Images

`assets/images/charlie.png` and `beverly.png` are web copies. The full size
originals stay in `src/images` as `charlie-orig.png` and `beverly-orig.png`,
which the build leaves out of the site. Rebuild a web copy with:

```sh
magick src/images/charlie-orig.png -strip -resize 800x800 -colors 256 \
  -define png:compression-level=9 assets/images/charlie.png
```

The hero renders them at 320px at the widest, so 800px covers a retina screen.
A 256 colour palette takes the pair from 2.4MB to 293KB with no difference you
can see.

Both caricatures must keep a transparent background, because they sit straight
on the black hero with no frame. Art exported as a screenshot bakes the editor's
grey chequerboard in as real pixels. Strip it with a flood fill from the corners
rather than a plain "remove white", which would punch holes in the light areas
of the drawing:

```sh
magick in.png -alpha set -fuzz 10% \
  -fill none -draw 'alpha 0,0 floodfill' \
  -fill none -draw 'alpha %[fx:w-1],0 floodfill' \
  src/images/charlie-orig.png
```

`assets/images/meta.png` is the social sharing card. It has the `kicker` and
`tagline` from `_data/band.yml` baked into it, so rebuild it whenever either of
those changes:

```sh
node scripts/og-card.mjs
rsvg-convert -w 1200 -h 630 src/og.svg -o assets/images/meta.png
```

`rsvg-convert` comes from `brew install librsvg`.

## Booking form

Netlify Forms collects submissions under the name `booking`. Turn on email
notifications under Forms, Form notifications, or nothing reaches anyone. The
form posts through JavaScript and falls back to `/thanks/` without it.

## Layout of the repository

```
_config.yml                Jekyll configuration
_data/band.yml             All the copy except show dates
_data/photos.yml           Gallery list
_includes/                 Page sections
_layouts/default.html      The public page
_layouts/panel.html        The admin page
band-admin.html            The admin page content
src/site.css               Tailwind entry point and the design tokens
src/images/                Full size art originals, not published
assets/js/site.js          Menu, show list, lightbox, booking form
assets/js/band-admin.js    The admin panel
netlify/functions/         login, logout, session, shows
netlify/edge-functions/    Puts the current shows into the homepage JSON-LD
netlify/shared/            Auth, validation, formatting, Blobs access
scripts/og-card.mjs        Rebuilds the social card source
seed/shows.sample.json     Reference dates, not read by the build
```
