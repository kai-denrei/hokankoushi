# Caching / cache-busting

This is a single self-contained `index.html` (all CSS + JS inline). The only asset a browser
can cache is that one file; Three.js and Tweakpane load from external CDNs whose caches are not
ours to control.

## What's installed

- **Anti-cache `<meta http-equiv>` tags** in `<head>` — a browser-level hint (belt-and-braces).
  Inconsistently respected; **not** a substitute for HTTP headers.
- **A build token** — `<meta name="cb" content="…">`, bumped by `scripts/bust.sh`.
- **A visual version indicator** — 3 shape glyphs + the token, inside the bottom-right *About*
  modal, plus a matching tab **favicon**. Both derive from the token at runtime
  (`renderBuild()` in `index.html`), using the cache-busting skill's `cell = byte mod 64`
  encoding (row = colour band, col = shape). If a reload shows the **same** glyphs/favicon after
  a bump, the cache is stale somewhere upstream.

## Bump the version

```bash
./scripts/bust.sh      # new token → glyphs + favicon change on reload
```

## The real control surface: HTTP headers

Meta tags and fingerprints don't help if the **HTML itself** is served with a long cache TTL —
the browser never refetches it and never sees the new token. On whatever static host you deploy
to, set:

| Response | `Cache-Control` |
|---|---|
| `index.html` (the entry point) | `no-cache` (revalidate every load) |
| any future fingerprinted `?v=…` assets | `public, max-age=31536000, immutable` |

Platform recipes (nginx / Netlify `_headers` / Vercel / S3+CloudFront / Cloudflare) live in the
cache-busting skill's `references/server-headers.md`.

**Local dev note:** `python3 -m http.server` sends no `Cache-Control` and its default caching is
weak, so busting is rarely needed locally — but a hard refresh (Cmd-Shift-R) guarantees a fresh
load. The token/glyphs are the tell that you're actually looking at the latest edit.
