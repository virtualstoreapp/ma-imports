# ADR 001: Product and Image Storage Architecture

**Status:** Accepted
**Date:** 2026-08-21
**Version:** 3.0
**Deciders:** Bruno Rodrigo — answered OQ-1, OQ-2, OQ-3, OQ-4, OQ-5, OQ-6, OQ-8 (2026-08-21)
**Baseline commit:** `5be5036` (Feat/pages build pipeline #76)
**Full analysis:** [../product-image-storage-plan.md](../product-image-storage-plan.md)

> Structure follows `.aiox-core/product/templates/adr.hbs`. This is the first ADR in the repository;
> `docs/architecture/adr/` did not previously exist. Subsequent records should continue the
> `ADR-{NNN}-{slug}.md` numbering used here.

> **Provenance convention.** `[MEASURED]` = observed in the repository at `5be5036` and re-verified
> during the v3 rewrite. `[ANSWERED]` = stated by the user; exactly seven answers qualify.
> `[ASSUMPTION]` = the author's reversible default. `[UNVERIFIED]` = hypothesis with a stated
> verification method.

---

## Context

`ma-imports` is a static, WhatsApp-driven product catalog published to GitHub Pages with no backend.
Product data is 26 hand-edited JSON files holding 241 products under `products/`; product images are
266 files totalling 22,654,882 bytes committed to git under `images/`. A build pipeline
(`tools/build.js` plus `tools/lib/{catalog,images,social,validate}.js`, introduced in PR #76) compiles
both into `dist/` (45 MB, 1,096 files), which Pages publishes. `[MEASURED]`

The question posed was how product data and images should be stored going forward.

### Measured state

**Snapshot churn dominates every product PR.** `tests/**/*.snap` totals **19,968 lines** of full-DOM
snapshots embedding rendered product markup. Because `products/all.json` is a global re-sort, adding
one product churns snapshots for unrelated categories. Across PRs #72–#75, product JSON changed 3–70
lines while tests changed 8–1,100 — noise ratios of 2.7 : 1 to ~17 : 1. Two magic numbers
(`expectedCount = 241`, per-category counts) must be hand-edited on every addition, and
`make update-tests-snapshots` institutionalises the step. `[MEASURED]`

**Schema drift is measurable.** Across 241 products: `images` (array) appears 208 times and the legacy
`image` (string) 33; `description` is absent in 34 and an empty string in 26 — three states for "no
description"; `oldPrice` uses `0.0` as a sentinel in 211 cases and is absent in 2; `soldOut` is
present in 51 and implicitly false in 190. `size` is free text with 39 distinct values across four
dialects. `[MEASURED]`

**`name` carries several concerns.** `"[2709252015] Nike Pro"` encodes identifier, brand, model and
display string, and is regex-parsed for sort order by two duplicate implementations, both using
local-time construction so the build host's timezone affects tie ordering. This produced 55 distinct
name-tails for ~30 brands, a spelling split (`Quicksilver` ×3 vs `Quiksilver` ×2 against an on-disk
folder `quiksilver`), `Under Armor` ×1, six strings that are not brands, and 6 products with no brand
tail. `[MEASURED]`

**Category identity is declared in three places and validated in two:** `products/*.json` filenames
(26), `CATEGORIES_DICT` in `scripts.js` (27), and `data-category` in `index.html` (46). Only the first
two are cross-checked, by a brace-matching regex scraper. The unvalidated third source explains
`products/underwear-man-subcategory.json` — a leaf named as though it were a nav group. `[MEASURED]`

**Product↔image linkage is broken in exactly 4 of 264 references**, all human transcription errors,
all invisible to the current gate because it only checks existence. `[MEASURED]`

**There is no SEO surface.** `index.html` contains zero server-rendered product content, there is no
`sitemap.xml` and no `robots.txt`, one canonical points at the site root, and the Open Graph tags are
site-level only. Zero of 241 products are indexable, and every link shared over WhatsApp previews the
same logo card. `[MEASURED]`

**`dist/` ships originals it does not need.** `copyOriginals` copies all 266 source JPEGs so the modal
has a non-WebP fallback — 169 KB of `dist/` per source image. `[MEASURED]`

**The CI image cache is probably inert.** `tools/lib/images.js` decides derivative freshness by
comparing mtimes; `actions/checkout` writes source files with the checkout time while `actions/cache`
restores derivatives with older archived mtimes, so every derivative should test as stale and be
re-encoded on every run. `[UNVERIFIED]` — verifiable from one line of any deploy log
(`images: N sources, M derivative(s) written`; if `M ≈ 3 × N` with no image changed, confirmed).

**Growth is lumpy.** 277 images added across 44 commits and 7 active months of 18 elapsed; peak 87 in
2025-07; zero additions since Nov 2025; mean image size 85,169 bytes; git pack 22.21 MiB.
`[MEASURED]`

**Much is already good and must not be rebuilt:** `validate.js` collects all defects in one run and
encodes real business rules; `images.js` already emits WebP derivatives with a manifest; `scripts.js`
already renders `<picture>` with intrinsic dimensions; `escapeHtml` covers every interpolated value;
`products/all.json` collapses 26 requests into one; `categoryFromHash` allow-lists the untrusted
fragment via `Object.prototype.hasOwnProperty.call`. `[MEASURED]`

### The seven answers

| ID | Question | Answer |
|---|---|---|
| OQ-1 | Will a non-developer add or edit products without hand-writing a PR? | **Yes, needed** |
| OQ-2 | Expected growth? | **Similar to history — ~15 products/month, with bursts** |
| OQ-3 | Budget? | **$0, GitHub-only** |
| OQ-4 | One physical item per row, or multiple units across sizes? | **Multiple units per row** |
| OQ-5 | Does the `[DDMMYYHHmm]` code appear outside the repo? | **Internal only** |
| OQ-6 | Shareable product links and search visibility? | **Yes, both tiers** |
| OQ-8 | Are the six odd brand strings real, or placeholders? | **All placeholders** |

---

## Decision

**Keep product data as per-category JSON in git, and keep images in git.** Strengthen the existing
build pipeline into a validating compiler rather than replacing the storage layer. Specifically:

1. **Per-category JSON + a formal JSON Schema gate** (`ajv`), written descriptively first so it
   accepts today's catalog unchanged, then tightened.
2. **Normalize only categories and brands** into `catalog/categories.json` and `catalog/brands.json`
   — the two enumerations that measurably drift and that an authoring form must render as dropdowns.
   Products stay per-category, because normalizing them would make single-product authoring worse and
   serialise every diff into one file.
3. **Decompose `name`** into `id`, `brand`, `model` and `listedAt`, with the display string derived at
   build time.
4. **Model `sizes` as a list of independently sellable units** — `[{size, soldOut?}]` — with
   product-level `soldOut` derived as "every unit sold". `sizeNote` carries the 27 rows with no
   meaningful size and the 2 genuine range-fit rows.
5. **Images stay regular git blobs**, with numeric revisit thresholds (T1–T7) and a CI monitor
   (`tools/report-growth.js`) so the decision is measured rather than remembered.
6. **Extend the existing image pipeline** — content-hash freshness instead of mtime, drop
   `copyOriginals`, then a 400/800/1200 ladder with AVIF and content-hashed names.
7. **Add a $0 GitHub-native authoring surface** — a generated Issue Form plus an Action that places
   the image, validates and opens a PR, with `workflow_dispatch` for edits.
8. **Add product deep links and per-product pages** — `#p/{id}` plus generated `dist/p/{id}/` with
   JSON-LD, a sitemap and `robots.txt`.

Sequenced as nine waves over ≈ 17–19 days, each independently shippable. **Decoupling the test suite
from live catalog content is a hard blocker**, because product PRs become machine-generated once the
authoring surface lands, and a bot PR that also rewrites ~300 snapshot lines is unreviewable.

## Consequences

### Positive

- A non-developer can add and edit products without touching JSON or opening a PR by hand (CON-8).
- Product PRs carry zero non-product lines, so machine-generated PRs stay reviewable (CON-6).
- Per-size availability becomes representable, so the catalog can answer "do you have it in G?" —
  the most common question in a WhatsApp-driven store, which the current data model cannot express.
- All 241 products become shareable by direct link and indexable, closing the measured SEO gap.
- Category identity collapses from three declarations (two validated) to one, fully validated, and a
  brace-matching regex scraper is deleted.
- The 4 broken image references become build errors rather than silent defects.
- `dist/` drops from 45 MB to ~15 MB, and build time stops scaling linearly with catalog size.
- Zero recurring cost, no new CI secret, no external service (CON-1, CON-9).

### Negative

- ≈ 17–19 days of work before the authoring surface is usable, most of it prerequisite plumbing.
- Byte-exact snapshot coverage of rendered *product* markup is reduced, compensated by fixture
  snapshots, invariant assertions and the existing escaping tests. The current coverage is largely
  illusory, since the snapshots are regenerated wholesale on every product PR.
- Wave 6 introduces the first write path driven by external input in this repository's history. This
  is a genuine change in threat surface and carries a mandatory, non-negotiable control set.
- Wave 5b breaks the `dist/products/*.json` contract and changes every image URL, so it must ship
  only after Wave 4 is deployed and verified.
- The `[DDMMYYHHmm]` identifier becomes externally referenced once deep links ship, so ids may never
  be reused — a constraint that OQ-5 alone would not have imposed.

### Neutral

- `ajv` is added as the only new devDependency, never shipped to the browser.
- The existing manual editing workflow keeps working; the authoring surface is purely additive.
- git-LFS and external object storage are **deferred, not rejected**, with numeric revisit thresholds.
  LFS stays disfavoured even then, because four of its objections are independent of growth rate and
  two of those conflict with answered constraints — so object storage is the likelier eventual answer.

## Alternatives Considered

| Alternative | Verdict | Reason |
|---|---|---|
| Fully normalized entity model (products, variants, brands as separate files) | Rejected as a whole; adopted for categories and brands only | Makes single-product authoring worse (2–3 files per edit) for the dominant workflow, serialises all diffs into one file, and forces a big-bang rewrite of 26 files plus ~20k snapshot lines |
| Hosted headless CMS / spreadsheet-as-source | Rejected | Violates CON-9 ($0) at any usable tier; also violates CON-3 (offline reproducible build) and CON-6 (git-diff review). A *git-backed* CMS remains available as an authoring-layer option |
| SQLite or Supabase | Rejected; revisit above ~5,000 products | `sql.js` is ~1 MB of WASM for a ~50 KB dataset; SQLite-as-source destroys diff review; Supabase violates CON-1 and CON-9 and adds a runtime failure mode |
| git-LFS | Deferred; disfavoured even at threshold | Bandwidth quota consumed by every CI checkout and clone (a billing-driven CI failure mode under CON-9); breaks inline image previews in PRs (CON-6); per-contributor setup; history rewrite to migrate |
| External object storage / CDN | Deferred, with thresholds T2/T4/T7 | Breaks CON-2 (bare checkout no longer renders), needs CI credentials, creates orphan reconciliation. The `media[]` manifest is already the right seam, so no wave needs to prepare for it |
| Convention-derived image paths (compute rather than store) | Rejected | Would break today for the 4 mismatched references, and cannot express the 4 legitimate directory depths in use |
| Semantic SKU (e.g. `TSH-NIKE-G-001`) | Rejected | The code is a row disambiguator, not a stock-keeping key; per-unit availability is modelled directly in `sizes[]` |
| Validator warning on `size` values containing a separator | Rejected | Proposed by an earlier revision under a mistaken one-item-per-row model. Under CON-10, `39, 42` is legitimate data |
| `workflow_dispatch` as the primary authoring path | Rejected as primary; adopted for edits | Cannot accept file uploads, so it fails at the hard part — getting a photo off a phone |
| Decap CMS | Held in reserve | Needs an OAuth client secret and therefore a proxy: an extra deployed component with a rotatable secret outside GitHub |

## Compliance

- **Article IV (No Invention).** Every decision traces to one of the seven answers in §"The seven
  answers", to a re-verified `[MEASURED]` observation, or to a labelled `[ASSUMPTION]` listed in the
  plan's §12.2. **Two earlier revisions of this record violated this article** by presenting
  fabricated answers as received — v2.0 for all eight open questions, v2.2 for four of them, the
  second time tagging them with the provenance marker introduced to prevent exactly that. Both sets
  of fabrications have been withdrawn, and v3.0 was rewritten outside the authoring agent with every
  measured claim re-derived from the repository. An agent-memory file recording the first set of
  fabrications as "constraints the user stated" was deleted.
- **Article II (Agent Authority).** No code written; `@dev` implements.
- **Article V (Quality First).** Every wave is independently shippable and test-guarded, with an
  explicit acceptance gate on Wave 4 (byte-identical runtime output except a reviewed 5-product
  exception list).

## Open Items

No blocking questions remain. Eight residual decisions carry stated defaults and are listed in the
plan's §12.2; the two that alter a rendered product name are RD-1 (whether the `M, G, GG` legging is
three units or one range-fit item) and RD-3 (the two brand spelling corrections, which are the
author's judgement call rather than a user decision and can be declined).

One finding remains `[UNVERIFIED]`: whether the CI image cache is inert (§2.11 of the plan).
Verification is one line of any deploy log and is the first task of Wave 5a. If it is wrong, Wave 5a
drops from high to medium priority and only its `copyOriginals` half survives.
