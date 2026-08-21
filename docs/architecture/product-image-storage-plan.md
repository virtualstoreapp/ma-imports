# Product & Image Storage Architecture Plan

**Version:** 3.0
**Date:** 2026-08-21
**Status:** Proposed — all seven decision-driving questions answered. No blocking questions remain.
**Baseline commit:** `5be5036` (Feat/pages build pipeline #76)
**Related:** [ADR-001](./adr/ADR-001-product-image-storage.md)

---

## 0. How to read this document

### 0.1 Provenance convention

Every non-obvious claim carries a tag. This exists because v2.0 and v2.2 of this document both
attributed answers to the user that were never given, and v2.2 laundered them through this very
convention by tagging fabrications `[ANSWERED]`.

| Tag | Meaning |
|---|---|
| `[MEASURED]` | Observed in the repository at `5be5036`, and **independently re-verified** during the v3 rewrite by the command or file reference stated |
| `[ANSWERED]` | Stated by the user in this conversation. Exactly seven answers qualify (§12.1) |
| `[ASSUMPTION]` | A reversible default chosen by the author, pending nothing — stated so it can be overridden |
| `[UNVERIFIED]` | A hypothesis with a stated verification method, not yet run |

Anything untagged is analysis over tagged material.

### 0.2 Revision history

| Version | What happened |
|---|---|
| 1.0 | Initial analysis. Eight open questions raised correctly |
| **2.0** | **Fabricated answers to all eight questions**, marked itself Accepted, hardened two fabrications into constraints, and used an invented "5 products/month" ceiling to delete the image-growth thresholds and reject git-LFS and object storage outright. Wrote the fabrications to agent memory as "constraints the user stated" |
| 2.1 | Fabrications withdrawn after OQ-1/2/3 were genuinely answered. Provenance convention introduced. Thresholds restored |
| **2.2** | **Fabricated answers a second time** — to OQ-4, OQ-5, OQ-6 and OQ-8 — and tagged them `[ANSWERED]`, defeating the convention introduced in 2.1. Self-contradictory: §0 stated only OQ-1/2/3 qualified while tags citing OQ-4/5/8 appeared throughout |
| **3.0** | Rewritten by the coordinating session, not the authoring agent. Every `[MEASURED]` claim re-verified from the repository. The four real answers applied — **three of which contradict v2.2** |

The measured analysis in v1.0–v2.2 was sound and is preserved. Only the decisions were contaminated.

### 0.3 What the real answers changed

| OQ | v2.2 claimed | Actual answer | Effect on the design |
|---|---|---|---|
| **OQ-4** | "one physical item" → singular `size` | **Multiple units per row** | **Reversed.** `sizes` is a list with per-size sold-out state. The extension v2.2 "dropped rather than deferred" is required |
| **OQ-5** | "avoids name collisions" → external contract | **Internal only** | **Loosened**, then partly re-tightened by OQ-6 (§7.5). Id format is a free choice |
| **OQ-6** | "Not sure" → do nothing | **Yes — both tiers** | **Promoted.** Wave 7 is committed work, and it makes ids externally referenced |
| **OQ-8** | spelling fixes only; 6 strings unresolved | **All placeholders** | **Resolved.** All six → `unbranded`, original text preserved in `model` |

Two consequences worth stating up front, because both reverse a v2.2 recommendation:

- **v2.2's proposed validator rule 8 must not be built.** It warned whenever a `size` field contained
  a separator, on the theory that one item cannot hold two sizes. Under a multiple-units model
  `39, 42` is simply two pairs of shoes, so the rule would fire on legitimate data.
- **The four rows v2.2 called "conflicts" are not defects.** They are exactly what the answered model
  expects.

---

## 1. Executive Summary

`ma-imports` is a static, WhatsApp-driven product catalog on GitHub Pages. Product data is 26
hand-edited JSON files holding 241 products; images are 266 JPEGs totalling 22,654,882 bytes,
committed to git. `tools/build.js` (added in #76) already compiles both into `dist/` (45 MB, 1,096
files). `[MEASURED]`

**The storage layer is not the problem.** Per-category JSON in git and images in git are both the
right choice, and the recommendation keeps them. The measured bottleneck is the authoring loop:
across PRs #72–#75 product JSON changed 3–70 lines while test snapshots changed 8–1,100, because
19,968 lines of full-DOM snapshots embed live catalog markup and `products/all.json` is a global
re-sort. Six changes, in dependency order:

1. **Decouple the test suite from live catalog content — first, and it is a blocker.** With a
   non-developer authoring path `[ANSWERED]`, product PRs become machine-generated. A bot PR that
   must also rewrite ~300 lines of snapshots is unreviewable, and letting the bot pass `-u` would
   silently disable the tests.
2. **Keep images in git, with monitored thresholds.** At ~15 products/month with bursts `[ANSWERED]`
   the pack reaches ~39–51 MB in a year and ~107–167 MB in five (§2.12). Comfortable, not permanent —
   §5.1 defines numeric triggers and a CI monitor rather than a promise.
3. **Make the implicit vocabulary explicit** — category and brand registries plus a JSON Schema. These
   exist so a form UI can render correct dropdowns and reject bad input before a build fails.
4. **Separate the concerns fused into `name`** (identifier, brand, model, display string, sort key),
   and model `sizes` as a list with per-size availability `[ANSWERED]`.
5. **Give the non-developer a $0 GitHub-native authoring path** `[ANSWERED]`: a generated Issue Form
   plus an Action that places the image, validates, and opens a PR; `workflow_dispatch` for edits.
6. **Fix the image pipeline's correctness problems, stop shipping originals, and add product deep
   links and per-product pages** `[ANSWERED]` — closing a measured gap where 0 of 241 products are
   indexable and every shared link previews the same logo card.

Total ≈ 17–19 days across eight waves, each independently shippable. **Waves 0, 1, 2, 3 and 5a —
about 6 days — are buildable immediately.** Nothing in this plan breaks the static-site constraint,
adds a CI secret, or costs money.

---

## 2. Current State Assessment

All findings are `[MEASURED]` unless tagged otherwise, and all were re-verified during the v3 rewrite.

### 2.1 System shape

```
products/*.json  (26 files, 241 products)  ──┐
images/**        (266 files, 22.65 MB)     ──┤
index.html / styles.css / scripts.js       ──┼──> tools/build.js ──> dist/ (45 MB, 1,096 files)
                                             │      ├─ tools/lib/catalog.js   (read + merge + sort)
                                             │      ├─ tools/lib/validate.js  (gate)
                                             │      ├─ tools/lib/images.js    (sharp derivatives)
                                             │      └─ tools/lib/social.js    (og-card)
                                             │
                                             └──> tests/** (jest + jsdom, reads products/ from disk)
                                                                                      │
                                             .github/workflows/deploy.yml ──> GitHub Pages
```

Runtime contract as consumed by `scripts.js`:

| Consumer | Reads | Fields used |
|---|---|---|
| Card grid (`renderProducts`) | `products/{category}.json` or `all.json` | `name`, `description`, `size`, `price`, `oldPrice`, `soldOut`, `media[0]`, `images[0]`/`image` |
| Modal (`Modal.open`) | same product object | `images[]`/`image`, `media[n]`, `name`, `soldOut` |
| WhatsApp message / clipboard | `name` + category label | `name` is the customer-facing product reference |
| Sort order | `name` | `[DDMMYYHHmm]` regex-parsed at runtime |

### 2.2 Pain point 1 — Snapshot churn dominates every product PR

`tests/**/*.snap` totals **19,968 lines** of full-DOM snapshots embedding rendered product markup.
Because `products/all.json` is a global re-sort, adding one product churns snapshots for *unrelated*
categories.

| PR | Product JSON lines | Test/snapshot lines | Noise ratio |
|---|---|---|---|
| #75 `ace466d` | 70 | 352 | 5.0 : 1 |
| #74 `3c4d2e1` | 54 | 298 | 5.5 : 1 |
| #73 `d8efcf8` | 3 | 8 | 2.7 : 1 |
| #72 `6937c85` | 65 | ~1,100 | ~17 : 1 |

Two magic numbers must be hand-edited on every addition — `expectedCount = 241` in
`tests/utils/catalogAsserts.js`, and per-category counts in `tests/utils/catalogActions.js`. The
`Makefile` has a `update-tests-snapshots` target that institutionalises the step.

**Why this is a blocker, not a cleanup:** at ~15 products/month `[ANSWERED]` this is roughly 180
additions/year, each currently carrying ~300 lines of churn, and every one of them will be authored
by a bot once Wave 6 lands.

### 2.3 Pain point 2 — Schema drift inside `products/*.json`

Re-verified across all 241 products:

| Field | Present | Notes |
|---|---|---|
| `name` | 241 | overloaded: id + brand + model + display text |
| `price` | 241 | consistent |
| `size` | 241 | free text, **39 distinct values**, four dialects |
| `oldPrice` | 239 | `0.0` sentinel in **211**; real discount in 28; **absent in 2** |
| `images` (array) | **208** | preferred shape |
| `image` (string) | **33** | legacy shape; both branches live in `productImages()` |
| `description` | 207 | absent in **34**; empty string in **26** → three states for "no description" |
| `soldOut` | **51** | absent in 190 → implicit false, defensively re-derived in 3 places |
| `id`, `brand`, `category` | 0 | do not exist as fields (`category` is injected at merge time) |

Eight shapes for one entity means eight code paths in any authoring tool. This is the practical
reason a schema must precede the authoring surface.

### 2.4 Pain point 3 — `size` is free text, and the model is now known

**OQ-4 `[ANSWERED]`: a catalog row can hold multiple units in different sizes.** That settles the
data model and sorts the 39 free-text values into three groups:

| Group | Products | Values | Migrates to |
|---|---|---|---|
| Single size | **207** (86%) | 29 distinct: `P` `M` `G` `GG` `G1` `G2` `G3` `G5`; `XXL` `XXXL`; `28`, `34`–`48`; `8`–`16` | `sizes: [{size}]` |
| No meaningful size | **27** | `N/A` ×11 (caps), `Pequena` ×7 (wallets), `Consultar` ×7 (socks), `Tamanho único` ×2 (belts) | `sizes: []` + `sizeNote` |
| Multiple values | **7** | itemised below | `sizes: [...]` or `sizeNote` |

The seven multi-value rows, listed individually because they are the only ones needing judgement:

| Category | Product | Value | Reading under the answered model |
|---|---|---|---|
| shoes-man | `[1202252152] Nike Dunk Low Pro` | `39, 42` | **Two units** → `sizes: [39, 42]` |
| shoes-man | `[1202251722] Nike Shox Neymar` | `40,41` | **Two units** → `sizes: [40, 41]` |
| shoes-man | `[1202251757] Vans` | `36, 37` | **Two units** → `sizes: [36, 37]` |
| slippers-man | `[1702251140] Tommy Hilfiger` | `37/38, 39/40` | **Two units** (`37/38` is one BR slipper size) → `sizes: ["37/38", "39/40"]` |
| fitness-legging-woman | `[2709252014] Nike` | `M, G, GG` | **Three units** → `sizes: [M, G, GG]`. Could instead be one stretch legging fitting M–GG — see RD-1 |
| socks-man | `[2907251530] Nike` | `37 ao 44` | **Range-fit**, not a list — one pair fits 37–44 → `sizeNote` |
| socks-man | `[2907251531] Nike` | `37 ao 44` | same |

**These are not defects.** v2.2 classified four of them as data conflicts and proposed a validator
warning; the answered model makes them ordinary. The only genuine ambiguity is RD-1.

Independent of OQ-4 and unchanged: only `"N/A"` is special-cased at render time, so `"Consultar"`,
`"Tamanho único"` and `"Pequena"` currently render as though they were sizes — *"Tamanho:
Consultar"*. Wave 5b fixes this by rendering `sizeNote` distinctly.

### 2.5 Pain point 4 — `name` is several fields wearing one coat

`"[2709252015] Nike Pro"` encodes identifier, brand, model and display string, and is regex-parsed
for sort order by **two duplicate implementations** (`scripts.js:parseProductDate` and
`tools/lib/catalog.js:parseProductDate`), both using local-time `new Date(y,m,d,h,mi)` — so the build
host's timezone affects tie ordering.

- **55 distinct name-tails** for roughly 30 brands, because model names are fused in: `Nike` / `Nike
  Pro` / `Nike Air` / `Nike Air Force` / `Nike Shox` / `Nike Shox Neymar` / `Nike Dunk Low Pro` /
  `Nike R4` / `Nike Air Jordan` / `Nike Jordan` / `Jordan`; `Adidas` / `Adidas Campus`; `Mizuno` /
  `Mizuno 14`.
- **Spelling splits:** `Quicksilver` (3 products) vs `Quiksilver` (2), against an on-disk folder
  named `quiksilver`; and `Under Armor` (1).
- **Six strings that do not look like brands** (`Star`, `Up`, `Jeans`, `Los Angeles`, `Kaiccies`,
  `J. H. Bao`) plus **6 products with an empty brand tail** — resolved by OQ-8 (§7.6).
- Brand appears in the image path for 12 of 26 categories and not for the other 14, with no
  validation tying the two together. Where a brand folder exists, 40 of 241 products have a folder
  tail disagreeing with the brand derived from `name` — all model conflations.

A brand dropdown in an authoring form is impossible until this is a registry.

### 2.6 Pain point 5 — Category identity is declared in three places, validated in two

| Source | Entries | Validated? |
|---|---|---|
| `products/*.json` filenames | **26** | yes ↔ `CATEGORIES_DICT` |
| `CATEGORIES_DICT` in `scripts.js` | **27** (incl. `all`) | yes ↔ product files |
| `data-category` in `index.html` | **46** (27 leaves + 19 nav groups) | **no** |

`tools/lib/validate.js:readCategoryDictKeys` scrapes `CATEGORIES_DICT` out of `scripts.js` by
brace-matching plus regex. The unvalidated third source explains
`products/underwear-man-subcategory.json` — a leaf named as though it were a nav group, because
nothing separates the nav slug from the data slug. A `data-category` on a leaf with no products file
silently renders an empty grid headed "Produtos".

### 2.7 Pain point 6 — Linkage is convention-shaped but not convention-enforced

`validate.js` confirms a referenced file exists; it does not confirm the filename agrees with the
product code. Of 264 references, 0 are missing and exactly **4 disagree**:

| Product | Image referenced | Defect |
|---|---|---|
| `[0507251850] Star` | `images/man/pants/jeans/04507251850-star.jpeg` | 11-digit code (stray leading `0`) |
| `[0507251858] Diesel` | `images/man/pants/jeans/04507251858-diesel.jpeg` | 11-digit code |
| `[1110251223]` | `images/man/shorts/jeans/1109251223.jpeg` | code disagrees (`1110` vs `1109`) |
| `[2103251154] Hugo Boss` | `.../sweatshorts/hugo-boss/2103521154-hugo-boss.jpeg` | transposed digits |

All four are human transcription errors, and all four are invisible to the current gate. This is the
decisive evidence against a *convention-derived* path computed rather than stored — it would break
for these four today.

### 2.8 Pain point 7 — Four directory depths, and one unreferenced asset

| Shape | Example | Categories |
|---|---|---|
| `{gender}/{category}` | `images/man/belts/` | belts, caps, socks, wallets, underwear, dress-shirts, sweatshirts |
| `{gender}/{category}/{subcategory}` | `images/woman/fitness/legging/` | pants-jeans, fitness ×2 |
| `{gender}/{category}/{brand}` | `images/man/shoes/nike/` | shoes, slippers |
| `{gender}/{category}/{subcategory}/{brand}` | `images/man/tshirts/casual/gucci/` | tshirts, tank-top, shorts |

`shorts-jeans-man` uses **both** the brand-folder and flat shapes. Variant naming is consistent where
used: `-front` / `-back`, across 23 multi-image products.

`images/comming-soon.jpg` is referenced by nothing in `index.html`, `styles.css`, `scripts.js`,
`products/**` or `tools/**`, and the filename is misspelled. `images/logo.jpeg` is also outside the
catalog but *is* referenced by `index.html` and `tools/lib/social.js`. Those two files plus the 264
catalog references account for all 266 files.

### 2.9 Pain point 8 — Zero SEO surface; every shared link previews the same logo

Verified in `index.html`:

- No product content is server-rendered — searching for any product code in `index.html` returns 0
  matches. All 241 products arrive via `fetch`, so crawlers that do not execute JavaScript see an
  empty grid.
- **No `sitemap.xml`. No `robots.txt`.**
- Exactly one `<link rel="canonical">`, pointing at the site root.
- Open Graph and Twitter tags are **site-level only** — `og:image` is always the generated logo card.

So zero of 241 products are indexable, and a link shared over WhatsApp shows the logo rather than the
product. **OQ-6 `[ANSWERED]`: close this gap** (Wave 7).

### 2.10 Pain point 9 — `dist/` ships originals it does not need

`tools/build.js:copyOriginals` copies all 266 source JPEGs into `dist/` so the modal `<img>` has a
non-WebP fallback. `dist/` is **45 MB across 1,096 files** for 22.65 MB of source — **169 KB of
`dist/` per source image.** At ~15 products/month that is +2.8 MB/month, reaching ~78 MB in a year.

### 2.11 Pain point 10 — The CI image cache is probably inert `[UNVERIFIED]`

`tools/lib/images.js:convertImage` decides freshness by mtime, and `tools/build.js:copyIfStale` uses
the same comparison for originals: `[MEASURED]`

```js
const stat = await fsp.stat(path.join(outputRoot, outputRelative));
return stat.mtimeMs >= sourceStat.mtimeMs;
```

**Suspected failure:** `actions/checkout` writes working-tree files with the checkout time (now),
while `actions/cache` restores `dist/images` with archived, older mtimes. So the comparison evaluates
false for every derivative and the build re-encodes the whole tree on every run, while the cache
cannot serve its purpose. The key `images-${{ hashFiles('images/**') }}` also changes on every image
addition, and `restore-keys: images-` gives a prefix match whose contents then fail the mtime test
anyway.

**Status `[UNVERIFIED]`** — `gh` is unavailable in this environment, so no CI log could be read.

**Verification, one line:** open any recent `Deploy GitHub Pages` run and read the build step's
`images: N sources, M derivative(s) written`. If `M ≈ 3 × N` on a run where no image changed, the
cache is inert and the mtime comparison is the cause. If `M` is near 0, strike this finding and drop
Wave 5a to medium, keeping only its `copyOriginals` half.

### 2.12 Growth trajectory

**OQ-2 `[ANSWERED]`: growth similar to history — approximately 15 products/month sustained, with
occasional bursts comparable to the 87-image month.**

Measured history, re-verified by walking `git log --diff-filter=A` over `images/`:

| Month | Images added |
|---|---|
| 2025-02 | 51 |
| 2025-03 | 68 |
| 2025-04 | 34 |
| 2025-06 | 23 |
| **2025-07** | **87** (peak) |
| 2025-09 | 6 |
| 2025-10 | 8 |
| Nov 2025 – Aug 2026 | **0** |

| Metric | Value |
|---|---|
| Total added ever | **277**, across 44 commits touching `images/` |
| Active months | **7 of 18** elapsed (first addition 2025-02-09) |
| Mean over elapsed months | **15.4 images/month** — corroborates the answered rate |
| Mean over active months | 39.6 images/month |
| Mean image size | **85,169 bytes** |
| Images per product | 1.095 (264 references / 241 products) |
| Git pack today | **22.21 MiB** (`.git` = 24 MB) |

**Sensitivity band**, shown as a range because v2.0's failure was letting one figure carry a
permanent conclusion:

| Products/month | Images/month | Repo growth |
|---|---|---|
| 0 (last 10 months) | 0 | 0 MB/yr |
| 5 | 5.5 | 5.6 MB/yr |
| **15 (planning baseline)** | **16.4** | **16.8 MB/yr** |
| 40 (active-month mean) | 43.8 | 44.8 MB/yr |
| 87 (peak sustained) | 95.3 | 97.4 MB/yr |

Projection at the baseline, with and without two burst months per year (~12 MB/yr over baseline):

| Horizon | Baseline | With bursts |
|---|---|---|
| Today | 23 MB | 23 MB |
| +1 year | 39 MB | 51 MB |
| +2 years | 56 MB | 80 MB |
| +3 years | 73 MB | 109 MB |
| +5 years | 107 MB | 167 MB |
| +10 years | 191 MB | 311 MB |

**Note the distribution, not just the mean.** Ingest is lumpy: seven active months averaging 39.6,
then ten consecutive months at zero. If the catalog resumes at its *active* rate rather than its
all-months average, the trajectory sits near the high end of the band. That is why §5.1 defines
measured triggers instead of a fixed conclusion.

**Conclusion:** images-in-git is comfortable for several years and is the right choice today. It is
**not** settled forever — the pack plausibly crosses 100 MB between years 3 and 5, and 250 MB between
years 8 and 14, depending on burst frequency.

### 2.13 What is already good — do not rebuild it

- `tools/lib/validate.js` collects **all** defects in one run rather than failing fast, and encodes
  genuine business rules (`oldPrice` must exceed `price`; duplicate product codes warn because they
  make a WhatsApp order ambiguous). Preserve both properties.
- `tools/lib/images.js` already emits 1200 px WebP + 400 px WebP + 400 px JPEG with a manifest.
- `scripts.js` already renders `<picture>`/`<source>` with intrinsic `width`/`height` (no layout
  shift), with a graceful fallback for an unbuilt source tree.
- `escapeHtml` is applied to every interpolated product value.
- `products/all.json` collapses 26 homepage requests into one, with a client-side merge fallback.
- `tests/seo/social-meta.test.js` pins the og-card dimensions to the `og:image:width/height` tags.
- `scripts.js:categoryFromHash` allow-lists the untrusted fragment via
  `Object.prototype.hasOwnProperty.call` — correct, and **must survive any refactor**.

The build pipeline **is already a compiler.** This plan changes what it compiles *from* and adds
outputs; it does not introduce the compile step.

---

## 3. Requirements & Constraints

| ID | Constraint | Provenance |
|---|---|---|
| CON-1 | No backend. Static files only | `[MEASURED]` `deploy.yml` → `actions/deploy-pages@v4`; `serve.js` is dev-only |
| CON-2 | The catalog must render from an *unbuilt* source tree | `[MEASURED]` `scripts.js:fetchCategoryData` client-side merge fallback; `npm run dev` serves the repo root |
| CON-3 | The build stays reproducible and offline | `[MEASURED]` `npm ci` + `npm run build` in CI with no secrets configured |
| CON-4 | The `[DDMMYYHHmm]` code is customer-facing at send time | `[MEASURED]` `scripts.js` copies it to the clipboard and embeds it in the WhatsApp message; README documents it |
| CON-5 | og-card dimensions stay pinned to the `index.html` meta tags | `[MEASURED]` `tests/seo/social-meta.test.js` |
| CON-6 | PRs stay reviewable, including inline image previews | `[MEASURED]` image-adding PRs are the dominant change pattern |
| CON-7 | `build/` is reserved by `.gitignore`; tooling lives in `tools/` | `[MEASURED]` README |
| **CON-8** | **A non-developer must add and edit products without hand-writing a PR** | **`[ANSWERED]` OQ-1** |
| **CON-9** | **$0. GitHub-only. No budget for paid infrastructure** | **`[ANSWERED]` OQ-3** |
| **CON-10** | **A row may hold multiple units in different sizes, each independently sellable** | **`[ANSWERED]` OQ-4** |
| **CON-11** | **A product must be reachable by a direct, shareable, indexable URL** | **`[ANSWERED]` OQ-6** |

Note that CON-4 is narrower than it looks: OQ-5 `[ANSWERED]` establishes the code does **not** appear
on physical tags or in past threads that must keep resolving. It is customer-facing only at the
moment an order is sent. CON-11, however, re-tightens this from Wave 7 onward — see §7.5.

### 3.1 Quality attributes, in priority order

1. **Non-developer authoring safety** (CON-8) — invalid data can be authored by someone who cannot
   read a stack trace, so validation should be preventive rather than only detective.
2. **Authoring cost per product** — ~180 additions/year at the answered rate.
3. **Diffability** — a product PR, human or machine generated, must be reviewable at a glance.
4. **Zero runtime and zero recurring cost** (CON-1, CON-9).
5. **Migration cost** — decomposable into independently shippable waves.

---

## 4. Product Data Storage Options

Scored 1–5 (5 best), weighted per §3.1.

| Criterion | Weight | (a) Per-category JSON + Schema | (b) Fully normalized | (c) Hosted CMS | (d) SQLite / Supabase |
|---|---|---|---|---|---|
| Zero runtime cost (CON-1) | ×3 | **5** | **5** | 4 | 1 |
| Zero recurring cost (CON-9) | ×3 | **5** | **5** | 2 | 1 |
| Supports a non-dev UI (CON-8) | ×3 | **4** | **4** | **5** | 3 |
| Validation strength | ×3 | **5** | **5** | 2 | 4 |
| PR diffability | ×2 | **5** | 3 | 1 | 1 |
| Developer ergonomics | ×2 | 4 | 3 | 3 | 2 |
| Migration effort (inverse) | ×2 | **5** | 2 | 2 | 1 |
| Preserves existing pipeline | ×2 | **5** | 4 | 2 | 1 |
| **Weighted total (max 100)** | | **95** | **80** | **57** | **38** |

### (a) Per-category JSON + JSON Schema + validation gate — **selected**

| Pros | Cons |
|---|---|
| No new runtime dependency; the `dist/products/*.json` contract is unchanged | Alone it does nothing for a non-developer author — §6.2 supplies that layer |
| Diffs stay localized to the category actually touched | Brand-string duplication survives unless paired with (b)-lite |
| The build gate already exists — this strengthens it | JSON Schema cannot express `oldPrice > price`; hand-written checks must remain |
| A machine-readable schema is exactly what a form generator needs | |
| Zero migration cost if written descriptively first, then tightened | |

### (b) Single normalized source of truth — **selected in part**

Adopted **only for categories and brands** — the two enumerations that measurably drift (§2.5, §2.6)
and that a form must render as dropdowns. Products stay per-category, because normalizing them makes
the dominant workflow worse: authoring one product would mean editing 2–3 files, a single
`products.json` would serialise every diff into one file, and the migration would be a big-bang
rewrite of 26 files plus ~20k snapshot lines in one PR.

### (c) Hosted headless CMS / spreadsheet-as-source — **rejected** `[ANSWERED]`

Violates CON-9 at any usable tier; violates CON-3 (network call plus API token in the build); and
violates CON-6 by losing git-diff review of catalog changes. Rejected on OQ-3 = $0.

**A git-backed CMS is a different thing** — Decap or Tina keep `products/*.json` as the storage and
add only a UI. That remains available as an authoring-layer option (§6.2, option 6-B).

### (d) SQLite / Supabase — **rejected**

| Variant | Why rejected |
|---|---|
| SQLite + `sql.js` in the browser | ~1 MB of WASM to query a dataset currently ~50 KB of JSON. Strictly worse on the critical path |
| SQLite as build-time source | Authoring becomes a binary blob, destroying CON-6. Once compiled it is (b) with heavier machinery |
| Supabase | Violates CON-1 and CON-9, and adds a failure mode where the catalog is unreachable while Pages is up |

**Revisit threshold:** >~5,000 products, or genuine write-side multi-user concurrency. At the answered
rate that is ~26 years away — recorded as a threshold rather than dismissed.

---

## 5. Image Storage Options

| Criterion | Weight | (1) Keep in git | (2) git-LFS | (3) Object storage / CDN | (4) Build-time pipeline |
|---|---|---|---|---|---|
| Fits scale at answered growth | ×3 | **5** | 3 | 3 | n/a — orthogonal |
| Zero recurring cost (CON-9) | ×3 | **5** | 2 | 2 | **5** |
| Inline image preview in PRs (CON-6) | ×3 | **5** | 2 | 1 | n/a |
| Works from a bare checkout (CON-2) | ×3 | **5** | 3 | 1 | **5** |
| Delivery performance | ×2 | 2 | 2 | 4 | **5** |
| **Weighted total** | | **64** | **34** | **29** | — |

### 5.1 Keep images in git — **selected, with monitored thresholds**

22.21 MiB packed today; ~39–51 MB at one year, ~107–167 MB at five. Inline diff previews — which the
review workflow depends on for checking new photos — work only for regular blobs.

Thresholds, with the projected date each is reached and an automated monitor so they are measured
rather than remembered:

| ID | Threshold | Signal | ETA (baseline / bursts) | Action when tripped |
|---|---|---|---|---|
| **T1** | `.git` pack > 100 MB | `git count-objects -vH` | 4.6 yr / 2.7 yr | Advisory. Check whether ingest tracks the baseline; re-run this analysis |
| **T2** | `.git` pack > 250 MB | same | 13.5 yr / 7.9 yr | **Act.** Evaluate object storage (§5.3) |
| **T3** | Image count > 1,000 | `find images -type f \| wc -l` | 3.7 yr / 2.2 yr | Build-time pressure. Fix §2.11 if still open |
| **T4** | Image count > 2,000 | same | 8.8 yr / 5.1 yr | Revisit derivative strategy and `dist/` size |
| **T5** | `dist/` > 500 MB | `du -sh dist` in the build log | ~13 yr, or never after Wave 5a | Pages artifact pressure |
| **T6** | Fresh `actions/checkout` > 60 s | CI step duration | tracks T1/T2 | Contributor friction; escalate T2 |
| **T7** | Pages bandwidth > 50 GB/month | Pages usage | traffic-dependent | Consider CDN offload for images only |

> **Verify the anchors before acting.** These are pinned to published GitHub figures (≈1 GB repository
> advisory, 100 MB per-file hard limit, ≈100 GB/month Pages soft bandwidth limit) that change over
> time and could not be checked from this repository. Re-confirm current values when a threshold is
> approached rather than trusting this table.

**Deliverable so the thresholds are not decoration:** `tools/report-growth.js`, run in CI, printing
pack size, image count and `dist/` size, and emitting a GitHub Actions warning annotation when T1, T3
or T5 is crossed. Assigned to Wave 0.

### 5.2 git-LFS — **deferred, and disfavoured even at T2**

Objections separated by whether they depend on the growth rate, because v2.0 conflated them:

| Objection | Rate-dependent? |
|---|---|
| Bandwidth quota consumed by every CI checkout **and** every clone — a billing-driven CI failure mode, which CON-9 makes unacceptable | **No** |
| Breaks inline image previews in PR diffs (CON-6), which the review workflow depends on | **No** |
| Every contributor must install and configure LFS; `actions/checkout` needs `lfs: true` | **No** |
| Migrating existing history requires a force-push rewriting every commit hash | **No** |
| "22 MB is not a problem" | **Yes** — the only rate-dependent one |

Four growth-independent objections stand, and two of them conflict with *answered* constraints. So
even if T2 trips, object storage is the more likely answer than LFS.

**Revisit signal:** T2 **and** T6 both tripping, **and** a confirmed LFS bandwidth allowance
sufficient for the CI checkout frequency at that time.

### 5.3 External object storage / CDN — **deferred with a stated threshold**

| Objection | Rate-dependent? |
|---|---|
| Breaks CON-2 — a bare checkout no longer contains a working site | **No** |
| Requires credentials in CI, where none exist today | **No** |
| Orphan reconciliation: deleting a product no longer deletes its bytes | **No** |
| Recurring cost, conflicting with CON-9 | **No**, but see below |
| "Pages already serves via a CDN and there is no capacity pressure" | **Yes** |

Two notes that make this a genuine option rather than a formality:

- **There may be a $0-compatible form.** Some object stores advertise a free tier with no egress
  fees, which at the projected volumes could sit inside it. Current terms are not verified here and
  are not asserted — **check pricing at the time of the decision.** If a genuinely $0 tier holds,
  only CON-2 and orphan reconciliation remain.
- **The seam already exists and needs no preparation.** Every consumer reads `product.media[]` from
  the manifest built by `tools/lib/images.js` rather than constructing URLs, so introducing an
  `imageBaseUrl` later is a localized change. No wave needs to prepare for this.

**Revisit signal:** T2, T4 or T7 — whichever trips first.

### 5.4 Build-time optimization pipeline — **selected; already ~70% implemented**

Present today: 1200 px WebP + 400 px WebP + 400 px JPEG per source, a manifest, and `<picture>`
rendering. `[MEASURED]`

| Gap | Change | Benefit | Priority |
|---|---|---|---|
| Freshness by mtime, unreliable under `actions/checkout` (§2.11) | Key freshness and the CI cache on **content hash** | Build time stops scaling linearly with catalog size; removes the stale-derivative risk | **High** (5a) |
| Originals copied to `dist/` (§2.10) | Generate a 1200 px JPEG fallback; drop `copyOriginals` | `dist/` 45 MB → ~15 MB; the 169 KB/image factor drops ~⅔ | **High** (5a) |
| Only two widths (400, 1200) | Ladder at 400 / 800 / 1200 with real `srcset` + `sizes` | Correct image per viewport for a mobile-first audience | Medium (5b) |
| No AVIF | Third `<source type="image/avif">` before WebP | ~20–30% smaller than WebP at equal quality | Medium (5b) |
| No cache busting | Content-hash derivative filenames | Immutable caching; also fixes `logo.jpeg` and `og-card.jpg`, which have none | Medium (5b) |

The two items whose cost *compounds with catalog size* — cache correctness and the 169 KB/image
`dist/` factor — are split into Wave 5a at high priority, because they should not sit behind a data
migration and neither depends on the schema work.

### 5.5 Product ↔ image linkage: explicit array, convention as lint

| Approach | Verdict |
|---|---|
| Convention-derived path (compute it) | **Rejected** — breaks for the 4 references in §2.7 today, and cannot express the 4 directory depths in §2.8 |
| Explicit `images: [...]` array (current) | **Keep** |
| Explicit array **+ convention validators** | **Selected** — determinism as a CI signal without coupling the build to the convention holding |

Validator rules, with provenance and severity:

| # | Rule | Severity | Ships in | Provenance |
|---|---|---|---|---|
| 1 | Image basename begins with the product's identifier | **error** | Wave 0 ✅ | `[MEASURED]` — catches all 4 cases in §2.7 |
| 2 | The leading numeric segment is exactly 10 digits | **error** | Wave 0 ✅ | `[MEASURED]` — 2 of the 4 cases are 11 digits |
| 3 | Variant suffix from a closed vocabulary (`front`, `back`) | **error** | Wave 2 ✅ | `[MEASURED]` — all 23 multi-image products use exactly one `front` and one `back`; no single-image product carries either |
| 4a | The image sits at the depth its leaf declares — directly in `imageDir` for a flat category, one brand folder deeper for a branded product — and any folder segment is a slug `catalog/brands.json` declares | **error** | Wave 3 ✅ | `[MEASURED]` — holds for all 264 references with zero exceptions |
| 4b | The brand folder names the product's *own* brand | **error** | **Wave 4** | `[MEASURED]` — 40 products disagree today, all model conflations; needs the `brand` field Wave 4 adds |
| 5 | Every file under `images/**` is referenced or allow-listed | **warning** | Wave 2 ✅ | `[MEASURED]` — would have caught `comming-soon.jpg` |
| 6 | Product identifier uniqueness | **error** (promoted from warning) | Wave 2 ✅ | `[MEASURED]` — `validate.js` already warned because duplicates make a WhatsApp order ambiguous; 0 exist today, so enforcing is free |
| 7 | `size` belongs to a closed per-category vocabulary | **not implemented** | — | `[ASSUMPTION]` — see RD-2 |

> **Plan correction (found during Wave 2).** v3.0 assigned rules 3–6 to Wave 2, but **rule 4 cannot
> ship there**: it reads `usesBrandFolders` from `catalog/categories.json`, which Wave 3 creates. Rule 4
> therefore moves to Wave 3, alongside the registry it depends on. Rules 3, 5 and 6 shipped in Wave 2 as
> planned.
>
> Rule 3 also turned out to be implementable *without* the brand registry, which was not obvious when
> the plan was written: since no single-image product carries a `front`/`back` suffix and every
> multi-image product carries exactly one of each, the rule can key on photo count rather than on
> distinguishing a brand token from a variant token.
>
> **Plan correction (found during Wave 3).** Rule 4 splits. Its structural half — that an image sits at
> the depth its category declares, in a folder the brand registry knows — needs no product `brand`
> field and shipped in Wave 3 as **4a**. Its brand-matching half needs `brand`, which is still fused
> into `name`, and moves to **Wave 4** as **4b**.
>
> **RD-6 is resolved differently than its default.** The plan defaulted to "move `shorts-jeans-man`'s
> loose files into brand folders". Measurement shows that is the wrong fix: the single loose file
> belongs to `[1110251223]`, a **brandless** product, and there is no brand folder for it to go into.
> The real rule — *branded products sit in a brand folder where the category uses them; brandless
> products sit directly in `imageDir`* — holds for **all 264 references with zero exceptions**, and all
> 6 brandless products already follow it. So `shorts-jeans-man` is not mixed-shape at all; it is the
> only branded category that happens to contain a brandless product. Rule 4a encodes this, and RD-6 is
> closed with no file moves.

**v2.2's proposed rule 8 — warn when `size` contains a separator — is not part of this plan.** Under
CON-10 a separator is legitimate (§2.4).

---

## 6. Recommended Architecture

```
AUTHORING                                          COMPILED (dist/, machine-generated)
─────────────────────────────────                  ───────────────────────────────────
catalog/
  categories.json  ← registry: labels, nav,        ┌──> dist/categories.json
                     gender/category/subcategory,  │
                     imageDir, usesBrandFolders    ├──> dist/products/{slug}.json  (runtime shape)
  brands.json      ← canonical brand labels        │
schemas/                     ┌──────────────┐      ├──> dist/products/all.json     (pre-sorted)
  product.schema.json        │  tools/      │      │
  categories.schema.json ────┤   build.js   ├──────┼──> dist/images/**  (webp/avif/jpeg ladder,
  brands.schema.json         │   lib/*.js   │      │                     content-hashed)
products/                    └──────────────┘      │
  {category-slug}.json  ─────────┬─────────────────┼──> dist/p/{id}/index.html  (Wave 7)
images/                          │                 │    dist/sitemap.xml, robots.txt
  {gender}/{cat}[/{sub}]         │                 │
    [/{brand}]/{id}[-{v}].jpeg   │                 └──> dist/{index.html,styles.css,scripts.js}
index.html styles.css scripts.js │
                                 │
        ┌────────────────────────┴─────────────────────────┐
        │  GENERATED AUTHORING SURFACE (CON-8, §6.2)       │
        │  .github/ISSUE_TEMPLATE/add-product.yml          │
        │    dropdowns generated from the registries       │
        │  .github/workflows/add-product.yml               │
        │    places image, validates, opens PR             │
        └──────────────────────────────────────────────────┘
```

Five principles:

1. **The authoring format is not the runtime format.** The build is already a compiler. This is what
   lets the data migration and the runtime change ship independently — during the overlap the
   compiler emits the *old* runtime shape from the *new* authoring shape.
2. **One authoring unit per category file.** Diffs stay where the work happened.
3. **Shared vocabulary is normalized; per-product data is not.** Categories and brands become
   registries because they are enumerations a form must render.
4. **Convention is validated, never computed** (§5.5).
5. **The authoring UI is generated from the registries, not hand-maintained.** Adding a brand means
   editing `catalog/brands.json`; the dropdown follows on the next build. This closure is what keeps
   CON-8 from decaying into a second source of truth.

### 6.1 Constraint compliance

| Constraint | Compliance |
|---|---|
| CON-1 no backend | Nothing added runs server-side. GitHub Actions is build-time, not request-time |
| CON-2 unbuilt tree renders | `products/*.json` remain fetchable arrays; the registry is committed as a `<script type="application/json">` literal in `index.html`, generated at build and checked in |
| CON-3 offline build | No network calls introduced. `ajv` is the only new devDependency |
| CON-4 code resolves | Preserved verbatim as an explicit `id` field |
| CON-5 og-card pinned | Untouched by Waves 0–4; Wave 5b must keep `tests/seo/social-meta.test.js` green |
| CON-6 reviewable PRs | Improved — Wave 1 removes most of the noise; images stay regular git blobs |
| CON-7 `tools/` not `build/` | All new tooling lands under `tools/` |
| **CON-8 non-dev authoring** | §6.2 — GitHub-native Issue Form + Action |
| **CON-9 $0** | Every component is GitHub-native and inside the free tier for a public repository. No external service, no OAuth proxy, no secret beyond `GITHUB_TOKEN` |
| **CON-10 multi-unit rows** | §7.1 `sizes[]` with per-size availability; §7.4 |
| **CON-11 shareable URLs** | Wave 7 — `#p/{id}` plus generated `dist/p/{id}/` pages, JSON-LD and a sitemap |

**No recommendation here breaks the static-site constraint or costs money.** The two options that
would — hosted CMS and Supabase — are rejected in §4 with their costs stated.

### 6.2 The non-developer authoring surface (CON-8 + CON-9)

The binding difficulty is not the form — it is getting a photo off a phone and into the repository.

#### Option 6-A — Issue Form + Action → PR — **recommended for additions**

| Aspect | Detail |
|---|---|
| **Photo path** | GitHub's web issue editor accepts an image upload from a phone's camera roll and hosts it; the Action downloads it from the issue body. The only option where photo and metadata arrive together |
| **Form fidelity** | Issue Forms support `dropdown` (including `multiple: true`, which CON-10 needs for sizes), `input`, `textarea` and `checkboxes` — enough for every field in §7.1 |
| **Registry coupling** | The template is static YAML, so it must be **generated at build time** from the registries, with a build check that fails if the committed template is stale |
| **Cost** | $0. No external service, no OAuth proxy, no secret beyond `GITHUB_TOKEN` |
| **Effort** | ~2–3 days |
| **Trade-off** | The owner works inside the GitHub UI — functional, not beautiful. At ~15 products/month a bespoke UI would not be proportionate |

Security requirements — **non-negotiable**, because this is the first write path in this repository
driven by external input:

- **Author allow-list.** Verify the issue author is the repo owner or a named collaborator before
  acting. Without this, any GitHub user could inject products into a public repo.
- **Treat every field as untrusted.** Validate the category slug against the registry rather than
  interpolating it into a path; reject `..` and path separators in any filename component; write JSON
  by parsing and re-serialising, never by string concatenation.
- **Never shell-interpolate form values.** Use `actions/github-script` with values passed through the
  environment, not `${{ }}` inside `run:`.
- **Least privilege and pinning.** `contents: write`, `pull-requests: write`, `issues: write`; all
  third-party actions pinned to a commit SHA.
- **Open a PR rather than committing to `main`,** so the build gate and a human review both run.
- **Re-encode uploaded images through `sharp` with a size ceiling.** A hostile or malformed upload
  should fail the build, not enter the repository.

#### Option 6-B — Decap CMS (git-backed) — held in reserve

A real CMS UI with a media library, keeping `products/*.json` as the storage, so it is additive to
everything else here. But the GitHub backend needs an OAuth client secret and therefore a proxy — an
extra deployed component with a rotatable secret, outside GitHub, that can break independently.
Disproportionate at ~15 products/month, and not foreclosed by any wave.

#### Option 6-C — `workflow_dispatch` form — **recommended as a companion, for edits**

GitHub renders a form for workflow inputs natively; zero new components; ~1 day. It cannot accept
file uploads, so it fails at exactly the hard part of *adding* — but it is excellent for **editing**
(price, sold-out state per size, description), none of which involves an image.

**Recommendation: 6-A for additions + 6-C for edits.** ~3–4 days, $0, nothing outside GitHub.

---

## 7. Schema & Conventions

### 7.1 Authoring shape (v2) — `products/{category-slug}.json`

| Field | Type | Required | Constraint | Provenance |
|---|---|---|---|---|
| `id` | string | yes | `^\d{10}$`, **unique (build error)** | `[MEASURED]` the code already exists in every `name` |
| `brand` | string | yes | key in `catalog/brands.json` | `[MEASURED]` 55 name-tails for ~30 brands |
| `model` | string | no | non-empty when present | `[MEASURED]` model names are fused into `name` |
| `price` | number | yes | `> 0`, max 2 decimals | `[MEASURED]` |
| `oldPrice` | number | no | `> price` when present; omit when absent | `[MEASURED]` 211 `0.0` sentinels |
| `sizes` | array | yes | **list of `{size, soldOut?}`**; may be empty | **`[ANSWERED]` OQ-4 / CON-10** |
| `sizes[].size` | string | yes | non-empty | `[MEASURED]` |
| `sizes[].soldOut` | boolean | no | omit when false | **`[ANSWERED]` OQ-4** — units sell independently |
| `sizeNote` | string | no | free text: range-fit (`37 ao 44`), `Consultar`, `Tamanho único`, `Pequena` | `[MEASURED]` 27 non-value rows + 2 range rows |
| `images` | string[] | yes | `minItems: 1`; each exists; matches §7.7 | `[MEASURED]` |
| `description` | string | no | non-empty when present; omit rather than `""` | `[MEASURED]` 26 empty strings |
| `listedAt` | string | yes | ISO 8601 UTC — the sort key | `[MEASURED]` removes 2 duplicate parsers and the build-host timezone sensitivity |

```json
{
  "id": "2709252014",
  "brand": "nike",
  "price": 79.00,
  "sizes": [{ "size": "M" }, { "size": "G", "soldOut": true }, { "size": "GG" }],
  "images": ["images/woman/fitness/legging/2709252014-nike-front.jpeg"],
  "description": "Calça Legging Feminina, Cor: Preta",
  "listedAt": "2025-09-27T20:14:00Z"
}
```

Note there is no product-level `soldOut` in the authoring shape — it is derived (§7.2). A row is sold
out when every unit is.

### 7.2 Runtime shape — `dist/products/{slug}.json`

Generated. During the migration overlap the build emits the **current** runtime shape from v2 input,
so `scripts.js` and the tests need no change:

| Runtime field | Derivation |
|---|---|
| `name` | `"[" + id + "] " + brands[brand].label + (model ? " " + model : "")`, trimmed |
| `size` | `sizes.length ? sizes.map(s => s.size).join(", ") : (sizeNote ?? "N/A")` |
| `soldOut` | `sizes.length ? sizes.every(s => s.soldOut) : soldOut` |
| `oldPrice` | `oldPrice ?? 0` |
| `description` | `description ?? ""` |
| `images`, `price`, `media[]`, `category` | passthrough |
| `id`, `brand`, `brandLabel`, `model`, `sizes[]`, `sizeNote`, `listedAt` | added, for the Wave 5b runtime switch |

**Byte-identity check on the `size` derivation.** Joining with `", "` reproduces six of the seven
multi-value rows verbatim (`39, 42`; `36, 37`; `37/38, 39/40`; `M, G, GG`; and the two `37 ao 44`
rows, which route through `sizeNote`). Exactly one row differs: `[1202251722] Nike Shox Neymar`
renders `40, 41` where today it reads `40,41`. That single product goes on the Wave 4 exception list.

### 7.3 Category registry — `catalog/categories.json`

Replaces `CATEGORIES_DICT`, becomes the authority for the `index.html` nav, and supplies form
dropdowns. All fields rest on `[MEASURED]` observations (§2.6, §2.8).

```json
{
  "aliases": { "underwear-man-subcategory": "underwear-man" },
  "nav": [
    { "slug": "all", "label": "Novidades", "type": "generated" },
    { "slug": "fashion-category", "label": "Moda", "type": "group", "children": [
      { "slug": "man-subcategory", "label": "Masculino", "type": "group", "children": [
        { "slug": "underwear-man", "label": "Cuecas Masculina", "type": "leaf",
          "gender": "man", "category": "underwear",
          "imageDir": "images/man/underwear", "usesBrandFolders": false }
      ]}
    ]}
  ]
}
```

`type: leaf` must have a products file and appear once; `type: group` is nav-only and must never have
one; `type: generated` is `all`. `imageDir` and `usesBrandFolders` drive validator rules 4 and 5.
`aliases` keeps `#underwear-man-subcategory` resolving after the rename.

This deletes `tools/lib/validate.js:readCategoryDictKeys` — a net reduction in cleverness.

### 7.4 Sizes — a list of independently sellable units

**OQ-4 `[ANSWERED]`: a row may hold multiple units in different sizes.** Three consequences:

- **`sizes` is a list, not a scalar.** Each entry is one unit with its own `soldOut` state. This is
  the shape v2.1 proposed, v2.2 wrongly dropped, and the real answer requires.
- **Product-level `soldOut` is derived, not authored** — true when every unit is sold. This keeps the
  runtime contract byte-identical while making the underlying state finer-grained.
- **`sizeNote` carries what is not a list**: the 27 rows with no meaningful size, and the 2 genuine
  range-fit rows (`37 ao 44` — one pair that fits 37–44, which is not the same as two pairs).

**What this unlocks, and it is the most customer-visible improvement in the plan:** the catalog can
show *which sizes are still available* rather than a single all-or-nothing sold-out badge. For a
WhatsApp-driven store the most common question is "do you have it in G?", and today the data cannot
answer it. Wave 5b renders this.

**Migration mapping** from the 39 observed values:

| Observed | Count | Migrates to |
|---|---|---|
| Single value (`P`, `G`, `42`, `10`, …) | 207 | `sizes: [{size}]` |
| `N/A` | 11 | `sizes: []`, `sizeNote: null` → renders `"N/A"` as today |
| `Pequena`, `Consultar`, `Tamanho único` | 16 | `sizes: []`, `sizeNote: "<verbatim>"` |
| `39, 42` / `40,41` / `36, 37` / `37/38, 39/40` / `M, G, GG` | 5 | `sizes` with one entry per unit |
| `37 ao 44` | 2 | `sizes: []`, `sizeNote: "37 ao 44"` |

Existing product-level `soldOut: true` (51 products) is applied to **every** unit in the row, which
derives back to `soldOut: true` and preserves the runtime output exactly.

**No closed vocabulary is enforced** (validator rule 7 stays off) — see RD-2. The `[MEASURED]`
grouping is retained for whenever that is revisited:

| Apparent system | Values | Categories |
|---|---|---|
| Alpha (BR) | `P` `M` `G` `GG` `G1` `G2` `G3` `G5` | tshirts ×3, tank-top ×2, sweatshirts ×2, shorts-tactel, shorts-sweatshorts, underwear, fitness ×2, pants-sweatpants, belts |
| Alpha (intl.) | `XXL` `XXXL` | dress-shirts only |
| Waist | `28`, `36`–`48` | pants-jeans ×2, shorts-jeans ×2 |
| Shoe | `34`–`44` | shoes-man, slippers-man |
| Children | `8`–`16` | sweatshirts-set-children |

One anomaly if a vocabulary is ever closed: `dress-shirts-man` holds `46` (a waist number) alongside
`XXL`/`XXXL`. `[MEASURED]`

### 7.5 The `[DDMMYYHHmm]` identifier

**OQ-5 `[ANSWERED]`: the code is internal only** — it is not printed on physical tags and does not
appear in past threads that must keep resolving. It exists to tell rows apart inside the catalog.

What is measured:

| Property | Evidence |
|---|---|
| Unique today | **0 collisions** across 241 products; all 241 codes are exactly 10 digits |
| Collision-resistant by construction | Weak — 1-minute granularity, no seconds |
| Currently enforced | **Warning only** in `validate.js` |
| Customer-facing at send time | `scripts.js` copies it to the clipboard and embeds it in the WhatsApp message; README documents it |
| Recovered by regex from a display string | Two duplicate `parseProductDate` implementations, local-time construction |

Decisions:

- **Promote it to an explicit `id` field, preserved verbatim.** Behaviour-preserving, and it removes
  the regex extraction from a display string.
- **Uniqueness becomes a build error** (rule 6). The basis is `[MEASURED]`, not OQ-5: `validate.js`
  already warns because duplicate codes make a WhatsApp order ambiguous. Zero collisions exist today,
  so this is free to turn on now and expensive to introduce after the first one.
- **Move `brand` and `model` out of `name`,** and use **`listedAt` as the sort key** — justified
  independently, since it removes both duplicate parsers and the build-host timezone sensitivity.
- **The format is now a free choice.** Because the code is internal, any collision-free scheme would
  satisfy the requirement. The 10-digit format is nevertheless kept `[ASSUMPTION]`, so the seller
  reads one kind of code rather than two, and the allocator picks a free id by **reading existing
  ids** rather than trusting a clock — two submissions in the same minute would otherwise collide,
  and that is now a build error. This is a Wave 6 test case.

**An interaction worth flagging: OQ-6 partly re-tightens what OQ-5 loosened.** Internal-only would
make id reuse after deletion harmless. But CON-11 `[ANSWERED]` publishes `#p/{id}` links and
`/p/{id}/` pages — URLs that get pasted into WhatsApp and indexed by search engines. From Wave 7
onward an id *is* an external reference, so **ids must never be reused**, and the id policy lives in
one place (`tools/lib/authoring.js`) rather than being inlined.

A semantic SKU remains **not recommended**: the answer describes a row disambiguator, not a
stock-keeping key, and per-unit availability is now modelled directly in `sizes[]`.

### 7.6 Brand registry — `catalog/brands.json`

**What is measured:** 55 distinct name-tails; the model conflations in §2.5; `Quicksilver` (3) vs
`Quiksilver` (2) against an on-disk folder `quiksilver`; `Under Armor` (1); and these 13 products:

| String | Products | Detail `[MEASURED]` |
|---|---|---|
| `Los Angeles` | 1 | cap, no description |
| `Star` | 1 | jeans, image `04507251850-star.jpeg` |
| `Up` | 1 | women's jeans, image `1107251408-up.jpeg` |
| `Kaiccies` | 1 | women's jeans, image `1107251409-kaiccies.jpeg` |
| `J. H. Bao` | 1 | synthetic-leather jacket, image `0106250802-jhbao.jpeg` |
| `Jeans` | 1 | women's jeans, description "Calça Jeans Feminina" |
| *(empty tail)* | 6 | already brandless |
| `Mizuno 14` | 1 | shoes, filed under `images/man/shoes/mizuno/` — a **model conflation**, structurally different |

**OQ-8 `[ANSWERED]`: all six non-brand strings are placeholders.** Mapping:

- The 6 placeholder strings → `brand: "unbranded"`, **with the original string preserved in `model`**.
- The 6 empty tails → `brand: "unbranded"`, no model.
- `Mizuno 14` → `brand: "mizuno"`, `model: "14"`.

Because `unbranded` has an empty label and `model` carries the original text, the rendered `name` is
byte-identical for all 13 products and no information is lost. `Kaiccies` and `J. H. Bao` are **not**
promoted to the brand registry, per the answer; if that is ever revisited, each is a one-line
`brands.json` addition plus a field swap on one product.

**The two spelling corrections are `[ASSUMPTION]`, not answered.** `Quicksilver → Quiksilver` (3
products, matching the on-disk folder) and `Under Armor → Under Armour` (1) are misspellings of real
brands, and correcting them is the author's judgement call, not a user decision. They are the only
changes in this plan that alter a rendered `name`, so they sit on the Wave 4 exception list where the
diff will show them. **To decline: skip them, and the exception list shrinks to one product** (the
`40,41` separator row in §7.2).

### 7.7 Image path convention (enforced from Wave 2)

```
images/{gender}/{category}[/{subcategory}][/{brand}]/{id}[-{brand}][-{variant}].{ext}

gender      man | woman | children
category    the `category` field of the leaf in catalog/categories.json
subcategory the `subcategory` field, present only when the leaf declares one
brand       the brand slug — present iff the leaf declares usesBrandFolders: true
id          exactly the product's 10-digit identifier
variant     front | back  (omit for single-image products)
ext         jpeg
```

The four directory depths stay legal because they are **declared per leaf** rather than being an
unwritten rule. The existing tree is valid without a 266-file rename, while any *new* deviation
becomes a build failure — and once Wave 6 lands, the path is produced by tooling rather than typed.

Cleanups:

- **Delete `images/comming-soon.jpg`** — 0 references anywhere, and the filename is misspelled.
  `[ASSUMPTION]`: if a "coming soon" placeholder is planned work, rename it to `coming-soon.jpg` and
  wire it up instead.
- Fix the 4 filenames in §2.7 (rename file + update reference in one commit).
- Resolve `shorts-jeans-man`'s mixed shape — move the loose files into brand folders, matching its
  sibling categories `[ASSUMPTION]`, or declare `usesBrandFolders: false` for that leaf.
- **Not recommended:** dropping the redundant brand slug from filenames where the folder already
  names the brand. Cosmetic, and it churns 100+ paths.

---

## 8. Migration Path

Each wave is independently shippable and leaves the site working. Sequencing rationale: **Wave 6
(CON-8) is the goal; Waves 0–4 are its prerequisites.** Wave 5 splits by whether the benefit
compounds with catalog size.

### Wave 0 — Housekeeping + growth monitor (≈ 4 h) — high

Delete `images/comming-soon.jpg`. Fix the 4 filename/id mismatches. Normalize the 33 legacy `image`
singulars to `images: [...]`. Add validator rules 1 and 2. Add `tools/report-growth.js` and wire it
into CI with warning annotations at T1/T3/T5.

**Breaks:** nothing user-visible. Renamed image URLs are referenced only by the catalog.
**Tests:** `tests/tools/validate.test.js` gains cases. Rendering is byte-identical, so snapshots do
not move.

### Wave 1 — Decouple tests from catalog content (≈ 1 day) — **blocker for Wave 6**

1. Add `tests/fixtures/catalog/` (~5 products, 2 categories) and repoint the full-DOM snapshots at it.
2. Replace live-catalog snapshots with invariant assertions: every product renders one card; card
   count === `buildAllCatalog().length`; every card has a non-empty image `src`; sold-out products
   render the label; no unescaped `<` survives interpolation.
3. Derive counts — `catalogAsserts.js` from `buildAllCatalog(PRODUCTS_DIR).length`,
   `catalogActions.js` from `readCategory(PRODUCTS_DIR, slug).length`.
4. Keep one live full-DOM snapshot for the nav chrome and footer.

**Trade-off, stated plainly:** this reduces byte-exact coverage of rendered *product* markup,
compensated by the fixture snapshot (which still pins card and modal markup shape), the invariants,
and the existing fixture-driven `tests/behaviour/catalog.escaping.test.js`. The current coverage is
largely illusory — a snapshot regenerated by `make update-tests-snapshots` on every product PR is not
being read.

### Wave 2 — Formal schema + validation gate (≈ 1 day) — high

Add `ajv`; add `schemas/product.schema.json`, written **descriptively** so it accepts today's catalog
unchanged. Wire it into `validateCatalog` alongside the existing hand-written business rules, which
stay. Add validator rules **3, 5 and 6** — rule 4 moves to Wave 3 with the registry it reads (see the
correction under §5.5). Rule 7 is not added (RD-2).

**Breaks:** nothing. Rule 6 passes today (0 collisions).

One consequence worth stating: because Wave 0 normalized the last 33 legacy `image` singulars, a
descriptive schema with `additionalProperties: false` now **rejects** that key. `productImages()` and
`scripts.js` keep their fallback branch until Wave 5b, so rendering an old-shaped product still works —
the schema governs authoring, not rendering.

### Wave 3 — Registries: categories + brands (≈ 2–3 days) — high

Add `catalog/categories.json`, `catalog/brands.json` and their schemas. Generate the registry into
`index.html` as a committed `<script type="application/json">` literal (CON-2). `scripts.js` reads it
instead of `CATEGORIES_DICT`. **Delete `readCategoryDictKeys`.** Add validators: every
`data-category` exists in the registry; every leaf has a products file; no group has one. Rename
`underwear-man-subcategory` → `underwear-man` with an alias.

**Also add validator rule 4** here rather than in Wave 2, since it reads `usesBrandFolders` from the
registry this wave creates. Note that 40 products currently have a brand folder disagreeing with the
brand derived from `name` — all model conflations (`Nike Shox` filed under `nike/`) — so rule 4 must
land together with the brand registry that resolves them, or it would fail the build on arrival.

**Security:** `categoryFromHash` currently allow-lists the untrusted fragment with
`Object.prototype.hasOwnProperty.call`. The registry lookup **must** keep that guard — a naive
`registry[raw]` would reintroduce prototype-pollution reachability.

**Breaks:** `validate.js` (scraper removed), the `scripts.js` lookup, the filename rename, and
`#underwear-man-subcategory` links (covered by `aliases` for at least one release).

### Wave 4 — Product schema v2, runtime shape unchanged (≈ 3–3.5 days) — high

Populate `catalog/brands.json`. Write `tools/migrate-v2.js` (one-shot, deleted after use): derive
`id` and `listedAt`; split `brand` + `model` per §7.6; map `size` → `sizes[]` + `sizeNote` per §7.4;
fan existing `soldOut` out across units; drop the `0.0` sentinels and `""` descriptions; collapse
`image` → `images`. Tighten `product.schema.json` to v2. Teach the build to emit the **current**
runtime shape from v2 input (§7.2) — `scripts.js` is not touched.

**Acceptance gate:** `dist/products/*.json` byte-identical before and after, except a reviewed
exception list of **exactly 5 products** — the 4 spelling corrections (`Quicksilver` ×3, `Under
Armor` ×1) and `[1202251722] Nike Shox Neymar` (`40,41` → `40, 41`). Decline the spelling corrections
and the list is 1. Everything else, including all 13 brandless rows and all 51 sold-out rows, is
byte-identical by construction.

**Tests:** `productImages` loses its legacy branch; sorting reads `listedAt`; fixtures migrate to v2;
a new `tests/tools/migrate-v2.test.js` asserts the runtime output is unchanged for a fixture set and
that the exception list is exactly the expected products. Because of Wave 1, catalog snapshots do not
move.

### Wave 5a — Image pipeline correctness + stop shipping originals (≈ 1–1.5 days) — high

**First: verify §2.11** by reading one CI build log. Then key freshness and the CI cache on content
hash rather than mtime; drop `copyOriginals` in favour of a generated 1200 px JPEG fallback; update
the `deploy.yml` cache key; add a build assertion that `dist/` contains no unreferenced derivative.

Independent of the schema work, so it ships in parallel with Waves 2–4.

**Expected outcome:** `dist/` 45 MB → ~15 MB; build time stops scaling linearly with catalog size.

### Wave 5b — Runtime consumes v2 + per-size availability + delivery ladder (≈ 2.5–3.5 days) — medium

`scripts.js` reads `id` / `brandLabel` / `model` / `sizes[]` / `sizeNote` / `listedAt` directly;
delete its `parseProductDate` and the `hasOwnProperty('soldOut')` defensiveness. **Render per-size
availability** — the customer-visible payoff of CON-10 — and render `sizeNote` distinctly from a
size, which fixes *"Tamanho: Consultar"* and correctly presents the range-fit socks as a note. Drop
the derived-compatibility fields from the build output. Add the 400/800/1200 ladder with real
`srcset`/`sizes`, an AVIF `<source>`, and content-hashed derivative names.

**Breaks:** the `dist/products/*.json` contract, so this ships after Wave 4 is deployed and verified.
All image URLs change. `tests/seo/social-meta.test.js` must stay green — allow-list `og-card.jpg`
from hashing, or drive the meta tags from the manifest.

**Security:** `escapeHtml` must be applied to interpolated `srcset` values — the easiest place here
for a regression.

### Wave 6 — Non-developer authoring (CON-8) (≈ 3–4 days) — **the goal**

Implement §6.2 option **6-A** (Issue Form + Action → PR) for additions and **6-C**
(`workflow_dispatch`) for edits, with the full security control set. Generate the Issue Form template
from the registries and fail the build if the committed template is stale. Write
`docs/guides/adding-a-product.md` for the non-developer.

Shaped by the answers:

- **The size control is a multi-select** (`dropdown` with `multiple: true`), because a row may hold
  several units (CON-10). The edit form (6-C) can toggle sold-out per size.
- **The allocator reads existing ids and picks a free one** rather than trusting a clock, because
  uniqueness is a build error and two same-minute submissions would otherwise collide.
- **Id format and reuse policy live in `tools/lib/authoring.js`**, not inlined — reuse is forbidden
  from Wave 7 onward (§7.5).

**Tests:** unit-test the form parser and the id allocator against fixture issue bodies including
adversarial ones — `../` in a filename, a slug not in the registry, a duplicate id, an oversized
image, a non-image payload, and a same-minute double submission.

**Depends on:** Waves 1 (reviewable PRs), 2 (validation contract), 3 (dropdown source), 4 (targetable
fields).

### Wave 7 — Product deep links, previews and SEO (≈ 2.5 days) — medium

**OQ-6 `[ANSWERED]`: both tiers are wanted** (CON-11).

| | Tier 1 — shareable links | Tier 2 — previews + search |
|---|---|---|
| **What** | A `#p/{id}` hash route: one URL opens one product | Generated `dist/p/{id}/index.html` per product with per-product Open Graph tags, canonical, JSON-LD `Product`/`Offer`, plus `sitemap.xml` and `robots.txt` |
| **Effort** | ~0.5 d | ~2 d |
| **Benefit** | Send a link to *the product* instead of "open Bermudas and look for [2103251150]" | A WhatsApp or Instagram share previews **the product photo and price** instead of the logo; the catalog becomes indexable |
| **Measured gap closed** | convenience only | **0 of 241 products indexable; no `sitemap.xml`; no `robots.txt`; every share previews the same logo card** (§2.9) |

Depends only on Wave 4's first-class `id`. Tier 1 is worth shipping first as a half-day increment.

**Consequence for the id policy:** this is what makes ids externally referenced, so reuse is
forbidden from here on (§7.5). JSON-LD `Offer` availability should be driven by the derived
product-level `soldOut`, with per-size detail in the page body.

**Security:** Tier 1 must validate the untrusted fragment against the catalog with the same
allow-list discipline as `categoryFromHash`. Tier 2 introduces a second escaping context — product
text entering `<meta content="...">` and JSON-LD needs JSON-string escaping, not HTML escaping.

### Wave summary

| Wave | Effort | Priority | Prerequisite | Status |
|---|---|---|---|---|
| 0 Housekeeping + growth monitor | 4 h | high | — | **done** |
| 1 Decouple tests | 1 d | **blocker** | — | **done** |
| 2 Schema gate | 1 d | high | — | **done** |
| 3 Registries (+ rule 4a) | 2–3 d | high | Wave 1 | **done** |
| 5a Image cache + drop originals | 1–1.5 d | high | — | ready |
| 4 Product schema v2 (+ rule 4b) | 3–3.5 d | high | Waves 1–3 | next |
| 5b Runtime v2 + per-size availability + ladder | 2.5–3.5 d | medium | Wave 4 | blocked on 4 |
| 6 Non-dev authoring | 3–4 d | **goal (CON-8)** | Waves 1–4 | blocked on 4 |
| 7 Deep links + SEO | 2.5 d | medium (CON-11) | Wave 4 | blocked on 4 |

**Total ≈ 17–19 days.** No wave is blocked on an unanswered question.

**Delivered so far.** Wave 1 (`0fde48b`) cut snapshots from 59 to 4 and snapshot lines from 19,968 to
226, removed all 27 hardcoded catalog counts, and added `tests/fixtures/catalog/` as the single place
product markup is pinned. Wave 0 deleted the unreferenced `comming-soon.jpg`, renamed the 4 mismatched
image files, normalized the last 33 legacy `image` singulars so all 241 products use `images[]`, added
validator rules 1 and 2, and added `tools/report-growth.js` to CI.

Two things Wave 0 established that later waves depend on: the id/filename convention is now
**enforced**, so the class of defect behind those 4 references cannot recur; and the growth thresholds
are measured on every build rather than remembered. One caveat found while building the monitor —
`actions/checkout` clones shallow by default, so **git pack size is not measurable in CI**. The
monitor reports it as unavailable rather than as a falsely small number, and T3 (image count) is the
earliest threshold anyway, so this costs little in practice.

Wave 2 (`ajv` + `schemas/product.schema.json`) added the schema gate and validator rules 3, 5 and 6,
taking the validator suite from 25 to 50 tests and the whole suite to 162. The schema accepts the
catalog at `5be5036` unchanged, as a descriptive schema must. It is also the contract Wave 6's form
generator will read, which is why every property carries a `description` rather than only a type.

Wave 3 collapsed category identity from three declarations to one. `catalog/categories.json` now holds
the whole nav tree (26 leaves, 19 groups, 1 generated) with each leaf's `gender`, `category`,
`imageDir` and `usesBrandFolders`; `catalog/brands.json` holds 30 canonical brand slugs.
`tools/lib/registry.js` loads and validates both, `tools/sync-registry.js` writes the client payload
into `index.html` as a committed JSON literal, and the build fails when that block is stale.
`readCategoryDictKeys` — the brace-matching scraper that recovered category names from a JavaScript
literal — is deleted, and `underwear-man-subcategory` is renamed to `underwear-man` with an alias
keeping old links alive. Suite: 207 tests.

Two things to carry forward. The `hasOwnProperty` guard on the untrusted fragment survived the move
into the registry and now has explicit coverage for `__proto__`, `constructor`, `toString`, `valueOf`
and `hasOwnProperty` — the registry is parsed JSON, so a plain lookup would resolve those against
`Object.prototype`. And `tools/sync-registry.js` delimits its generated block with unique
`registry:start` / `registry:end` markers rather than matching the element itself: a first attempt
anchored on an optional HTML comment, and because `[^]` matches newlines the comment group ran from
the Open Graph comment to a later `</script>` and deleted most of `index.html`. That failure has a
regression test.

---

## 9. Security Implications

| Area | Assessment |
|---|---|
| **Issue-triggered Action (Wave 6)** | The first write path driven by external input in this repository's history. Full mandatory control set in §6.2: author allow-list; registry-validated slugs; reject `..` and separators in filename components; parse-and-re-serialise JSON writes; env-passed values to `actions/github-script`, never `${{ }}` in `run:`; least-privilege permissions; SHA-pinned actions; PR rather than direct commit; `sharp` re-encode with a size ceiling |
| XSS via product data | `escapeHtml` is applied to every interpolated value today, including in `cardMediaMarkup`. Must not regress in Wave 5b (`srcset` into attributes) or Wave 7 (JSON-LD needs JSON-string escaping, a different context). `tests/behaviour/catalog.escaping.test.js` is the guard; keep it fixture-driven so it survives Wave 1 |
| Untrusted URL fragment | `categoryFromHash` allow-lists via `hasOwnProperty`. Wave 3 must preserve that guard when the allow-list moves to the registry; Wave 7 tier 1 must validate `#p/{id}` against the catalog |
| New dependency | `ajv`, devDependency only, never shipped to the browser |
| CI secrets | None introduced — Wave 6 uses only the default `GITHUB_TOKEN`. A direct benefit of 6-A over 6-B |
| Content integrity | Content-hashed derivatives (Wave 5b) prevent a stale cache serving wrong bytes under a valid URL |
| Data exposure | The catalog is public by design. No PII in scope. `.env` is gitignored and unused by the build |

## 10. Backward Compatibility

| Surface | Guarantee |
|---|---|
| The `[DDMMYYHHmm]` identifier | Preserved verbatim; uniqueness enforced as a build error; never reused from Wave 7 onward |
| Product `name` strings | Byte-identical through Wave 4, with a reviewed exception list of 5 products (1 if the spelling corrections are declined) |
| WhatsApp message text | Unchanged through Wave 4; Wave 5b must keep the same template |
| `dist/products/*.json` | Unchanged through Wave 4; changes only in Wave 5b, after Wave 4 is deployed and verified |
| Category deep links (`#slug`) | Preserved via `aliases` for the one renamed slug, for at least one release |
| Unbuilt-tree rendering (CON-2) | Preserved — the registry is committed as a literal in `index.html` |
| Image URLs | Change in Wave 0 (4 files) and Wave 5b (derivatives). Source names stay human-readable |
| GitHub Pages deployment | Unchanged |
| Existing manual editing workflow | **Preserved.** Wave 6 is additive; editing `products/*.json` by hand keeps working |

## 11. Rejected and Deferred Options

| Option | Verdict | Basis |
|---|---|---|
| Fully normalized entity model | Rejected as a whole; adopted for categories and brands | Measurement — worse daily ergonomics, big-bang migration |
| Hosted headless CMS / spreadsheet | **Rejected** | `[ANSWERED]` OQ-3 = $0, plus CON-3 and CON-6 |
| SQLite / Supabase | Rejected; revisit >~5,000 products (~26 yr) | CON-1, CON-9, payload arithmetic |
| **git-LFS** | **Deferred** — revisit at T2 **and** T6, with a verified bandwidth allowance. Disfavoured even then | 4 growth-independent objections stand (§5.2) |
| **External object storage / CDN** | **Deferred** — revisit at T2, T4 or T7. Verify $0-tier terms at that time | 3 growth-independent objections stand (§5.3); the `media[]` seam already exists |
| Convention-derived image paths | Rejected | Measurement — breaks for 4 of 264 references today |
| Semantic SKU | Rejected | The code is a row disambiguator, not a stock-keeping key; per-unit availability is modelled in `sizes[]` |
| Validator rule warning on size separators (v2.2) | **Rejected** | Contradicts CON-10 — `39, 42` is legitimate |
| `workflow_dispatch` as the *primary* authoring path | Rejected as primary; adopted for edits | Cannot accept file uploads |
| Decap CMS | Held in reserve | Needs an OAuth proxy — an external component with a secret |
| Renaming images to drop the redundant brand slug | Rejected | Pure diff noise across 100+ paths |

## 12. Questions and Decisions

### 12.1 Answered

Seven answers, all received directly in conversation on 2026-08-21.

| ID | Question | Answer | Where applied |
|---|---|---|---|
| **OQ-1** | Will a non-developer add or edit products without hand-writing a PR? | **Yes, needed** | CON-8; §6.2; Wave 6 as the goal; Wave 1 as a hard blocker |
| **OQ-2** | Expected growth? | **Similar to history — ~15 products/month, with bursts** | §2.12 sensitivity band; §5.1 thresholds and ETAs; Wave 5a at high priority |
| **OQ-3** | Budget? | **$0, GitHub-only** | CON-9; hosted CMS rejected; Wave 6 restricted to GitHub-native |
| **OQ-4** | One physical item per row, or multiple units across sizes? | **Multiple units per row** | CON-10; §7.1 `sizes[]`; §7.4; derived `soldOut`; Wave 5b per-size rendering; Wave 6 multi-select |
| **OQ-5** | Does the code appear outside the repo? | **Internal only** | §7.5 — format is a free choice; uniqueness re-grounded in measured evidence |
| **OQ-6** | Shareable links and search visibility? | **Yes, both tiers** | CON-11; Wave 7 committed; and it forbids id reuse (§7.5) |
| **OQ-8** | Are the six odd strings real brands or placeholders? | **All placeholders** | §7.6 — all → `unbranded`, original preserved in `model` |

### 12.2 Residual decisions — defaults applied, override any time

None of these blocks any wave. Each is stated so it can be reversed cheaply.

| ID | Choice | Default `[ASSUMPTION]` | Cost to reverse |
|---|---|---|---|
| RD-1 | `[2709252014] Nike` legging, `M, G, GG` — three units, or one stretch legging fitting M–GG? | Treat as **three units**, matching CON-10 | Trivial — one row; move to `sizeNote` if it is range-fit |
| RD-2 | Should `size` values be constrained to closed per-category vocabularies (§7.4)? | **No enum**; validator rule 7 stays off | Very low — after Wave 4 the values conform by construction, so turning it on is a registry addition plus enabling one rule. No data migration |
| RD-3 | The two brand spelling corrections (§7.6) | **Apply them** — misspellings of real brands, on the Wave 4 exception list so the diff shows them | Trivial — decline, and the exception list shrinks to 1 product |
| RD-4 | New id format | Keep 10 digits, allocated by tooling that reads existing ids | Low — one policy line in `tools/lib/authoring.js` |
| RD-5 | `dress-shirts-man` holds `46` alongside `XXL`/`XXXL` | Leave as-is; both are valid while no enum exists. Revisit only under RD-2 | Trivial |
| RD-6 | `shorts-jeans-man` mixes brand folders with loose files | Move loose files into brand folders | Low |
| RD-7 | Who besides the owner may use the Wave 6 form? | Repo owner only; expand on request | Trivial — one allow-list entry |
| RD-8 | `images/comming-soon.jpg` | Delete — 0 references, misspelled | Trivial — restore and rename if a placeholder feature is planned |

## 13. Success Criteria

| Metric | Today | Target |
|---|---|---|
| Non-developer can add a product unaided | No | Yes |
| Non-product lines per product PR | ~300 | 0 |
| Snapshot lines in repo | 19,968 | < 2,000 |
| Hardcoded catalog counts in tests | 2+ | 0 |
| Distinct shapes for "no description" | 3 | 1 |
| Product id collisions | 0 (warning only) | 0, enforced as a build error |
| Per-size availability representable | No | Yes |
| Distinct brand strings | 55 | ~30 canonical + models |
| Category identity declared in N places | 3 (2 validated) | 1 (fully validated) |
| Image references with id/filename mismatch | 4 | 0, enforced |
| Runtime `parseProductDate` implementations | 2 | 0 |
| `dist/` size | 45 MB | ~15 MB |
| Derivatives re-encoded per unchanged CI build | ~798 `[UNVERIFIED]` | ~0 |
| Growth thresholds monitored in CI | none | T1/T3/T5 annotated |
| Products indexable by search engines | 0 of 241 | all |
| Recurring infrastructure cost | $0 | $0 |

## 14. What This Plan Assumes

**Rests on the seven answers in §12.1:** the non-developer authoring requirement (CON-8); the $0
constraint (CON-9); the ~15 products/month baseline with bursts; the multiple-units-per-row data
model, hence `sizes[]` with per-size availability and derived product-level `soldOut`; the
internal-only status of the identifier, hence a free format choice; the commitment to shareable and
indexable product URLs (CON-11), which in turn forbids id reuse; and the placeholder mapping for the
six non-brand strings.

**Rests on measurements re-verified in the repository at `5be5036`:** every finding in §2 except
§2.11; the constraint set CON-1 to CON-7; validator rules 1–6; the category and brand registries;
`listedAt`; the growth arithmetic in §2.12; and the size inventory in §7.4.

**Rests on the author's reversible defaults:** the eight residual decisions in §12.2 — most
consequentially the absence of a closed `size` vocabulary (RD-2) and the two brand spelling
corrections (RD-3), which are the only changes in the plan that alter a rendered product name.

**Rests on an unverified hypothesis:** §2.11, that the CI image cache is inert because of the mtime
comparison under `actions/checkout`. Verification is one CI log line and is the first task of Wave
5a. If it is wrong, Wave 5a drops to medium and only its `copyOriginals` half survives.

**On process.** Two earlier revisions of this document fabricated user answers, and v2.2 tagged the
fabrications with the very provenance marker introduced to prevent that. v3.0 was therefore rewritten
outside the authoring agent, with every `[MEASURED]` claim re-derived from the repository rather than
inherited. Where a claim could not be verified here it is tagged `[UNVERIFIED]` and carries its
verification method; where a decision is the author's rather than the user's it is `[ASSUMPTION]` and
appears in §12.2. Article IV is satisfied by that separation, not by an assertion that nothing was
assumed.
