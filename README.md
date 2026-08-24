# crosstownshuttle.com

One page site for Crosstown Shuttle, plus a small password-protected panel at
`/admin` where the band adds and removes show dates themselves.

Jekyll builds the page. Tailwind CSS v4 builds the styles. Netlify Functions and
Netlify Blobs hold the show list. Netlify Forms takes the booking inquiries.

## How the show list works

There are two paths to the same data, so the page is correct with or without
JavaScript and never waits on a rebuild.

1. `scripts/pull-shows.mjs` runs before every build. It reads the saved shows
   out of Netlify Blobs and writes `_data/shows.json`, which Jekyll renders into
   the HTML. This is what search engines and the JSON-LD see.
2. In the browser, `assets/js/site.js` calls `/api/shows` and replaces the list.
   A save from `/admin` therefore appears immediately, with no deploy.

`/api/shows` is the source of truth. `_data/shows.json` is generated and ignored
by git.

While that request is in flight the section shows a skeleton shaped like the
real list. This matters: when the build has no dates in it, the alternative is
telling every visitor the band has nothing booked for as long as the round trip
takes. The "No dates on the board" message only appears once the function has
actually answered with an empty list. Without JavaScript, a `noscript` block
replaces the skeleton with a short message and a link to the booking form.

Reading Blobs from a build needs `SITE_ID` and `NETLIFY_API_TOKEN`. Without
them the build still succeeds, the HTML ships with an empty list, and the
browser fills it in. Set them if you want the dates inside the HTML too.

All date and time formatting lives in `netlify/shared/showtime.mjs`, which the
build script and the function both import, so there is one implementation.

## Setup

Needs Ruby 4.0.6 and Node 20 or newer.

```sh
bundle install
npm install
cp .env.example .env      # then fill in ADMIN_PASSWORD and SESSION_SECRET
```

Generate the session secret with `openssl rand -base64 48`.

## Running it

```sh
npm run serve   # netlify dev on :8888, with the functions and /admin working
npm run dev     # jekyll plus tailwind only, on :4000, no functions
npm run build   # what Netlify runs
```

Use `npm run serve` when you need `/admin` or `/api/shows`. Netlify Blobs runs
in a local sandbox, separate from the real site's data.

## Netlify environment variables

Set these under Site configuration, Environment variables.

| Name | Required | What it does |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | The password for `/admin`. Make it long. |
| `SESSION_SECRET` | yes | Signs the admin session cookie. Any long random string. |
| `BAND_TIMEZONE` | no | Defaults to `America/New_York`. Decides which shows count as past. |
| `SITE_ID` | no | Lets the build read Blobs, so dates land in the HTML. |
| `NETLIFY_API_TOKEN` | no | Goes with `SITE_ID`. A personal access token. |
| `BUILD_HOOK_URL` | no | Pinged after a save so the static HTML catches up. |

Changing `SESSION_SECRET` signs everyone out.

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

## Artwork still to replace

The caricatures are in place. The gallery is still placeholders, which are
obvious on purpose.

| File | Replace with | Size |
| --- | --- | --- |
| `assets/images/photos/placeholder-*.svg` | Real photos | Landscape, 4:3, about 1600px wide |

Point `_data/photos.yml` at whatever filenames you use and delete the
placeholders.

The caricatures at `assets/images/charlie.png` and `beverly.png` must keep a
genuinely transparent background, because they sit straight on the black hero
with no frame. Watch out for art exported as a screenshot: that bakes the
editor's grey chequerboard in as real pixels, and it shows up as a pale square
on the page. Strip it with a flood fill from the corners rather than a plain
"remove white", which would punch holes in the light areas of the drawing:

```sh
magick in.png -alpha set -fuzz 10% \
  -fill none -draw 'alpha 0,0 floodfill' \
  -fill none -draw 'alpha %[fx:w-1],0 floodfill' \
  -resize 800x800 -colors 96 assets/images/charlie.png
```

Ninety-six colours drops the file from about 1MB to about 200KB with no
visible difference at the size the page renders it.

`assets/images/og.png` is the social sharing card. It has the `kicker` and
`tagline` from `_data/band.yml` baked into it, so regenerate it whenever either
of those changes:

```sh
node scripts/og-card.mjs
rsvg-convert -w 1200 -h 630 src/og.svg -o assets/images/og.png
```

`rsvg-convert` comes from `brew install librsvg`.

## Using the admin panel

Go to `/admin`, enter the password, and the show list opens. Each show is one
collapsed row that gives the date, the venue, the town and the time. Press Edit
on a row to open its fields, then press Save. Each show saves on its own. Only
the date and the venue are required.

The list gives the upcoming shows first. Press Past for the shows that have
already happened, or All for both. A past show keeps a "Past" mark, stays in the
list until someone removes it, and never shows on the public page.

The sign in lasts 30 days on that device.

## Booking form

Netlify Forms collects submissions under the name `booking`. Turn on email
notifications under Forms, Form notifications, or nothing reaches anyone. The
form posts through JavaScript and falls back to `/thanks/` without it.

## Layout of the repository

```
_config.yml              Jekyll configuration
_data/band.yml           All the copy except show dates
_data/photos.yml         Gallery list
_data/shows.json         Generated before each build, git ignored
_includes/               Page sections
_includes/nav.html       Section bar, sits under the hero and pins on scroll
_layouts/default.html    The public page
_layouts/panel.html      The admin page
src/site.css             Tailwind entry point and the design tokens
assets/js/site.js        Menu, show list, lightbox, booking form
assets/js/admin.js       The admin panel
netlify/functions/       login, logout, session, shows
netlify/shared/          Auth, validation, formatting, Blobs access
scripts/pull-shows.mjs   Reads Blobs at build time
scripts/og-card.mjs      Rebuilds the social card source
seed/shows.sample.json   Sample dates for local work only
```

## Notes on the admin panel's security

One shared password, checked in constant time, exchanged for an HMAC signed
cookie that is `HttpOnly` and `SameSite=Lax`. The password itself is never
stored in the browser. Failed sign ins are delayed to slow a script down, but
there is no lockout, so the password needs to be long. Everything sent to
`/api/shows` is re-validated on the server: dates must be real, only `http` and
`https` links survive, text is length capped, and unknown fields are dropped.
