# Catalog fixtures

A small, hand-written catalog used to pin rendered markup byte-for-byte.

It exists so that **adding a real product never rewrites a snapshot.** Before this
fixture, full-DOM snapshots were taken against `products/`, so a one-line product
addition churned hundreds of snapshot lines across unrelated categories — and the
snapshots were regenerated wholesale (`make update-tests-snapshots`) rather than read.

`tests/catalog/fixture/catalog.fixture.test.js` is the only suite that snapshots
product markup. The per-category suites assert **invariants** against `products/`
instead (see `tests/utils/catalogAsserts.js`), so they stay meaningful without
being coupled to catalog content.

## What each fixture product covers

| Product | Shape under test |
|---|---|
| `[0101250900] Fixture Alpha` | `media[]` present → `<picture>` with WebP `<source>` and intrinsic dimensions; two images, so the modal has a second frame |
| `[0201251000] Fixture Beta` | `images[]` only → plain `<img>` fallback for an unbuilt tree; `oldPrice > 0` → `.old-price` + `.new-price`; `size: "N/A"` → size suppressed; no `description` key |
| `[0301251100] Fixture Gamma` | legacy `image` string instead of `images[]`; `soldOut: true` → `.sold-out-label` |
| `[0401251200] Fixture Delta` | the ordinary case — `images[]`, description, size, plain `.price` |
| `[0501251300] Fixture Epsilon` | `description: ""` (the empty-string variant of "no description"); `soldOut: true`; a non-numeric size that is not `N/A` |

Filenames are the category slugs, so the directory is a drop-in for
`buildAllCatalog()` — the fixture exercises the real merge-and-sort path rather
than a reimplementation of it. The `[DDMMYYHHmm]` codes are chosen so the sorted
order is deterministic: Epsilon, Delta, Gamma, Beta, Alpha.

Image paths under `images/fixtures/` are intentionally synthetic; nothing loads
them in jsdom. Their basenames still follow the `{id}[-brand][-variant]` naming
convention enforced by validator rules 1 and 2, so the fixture demonstrates the
convention rather than contradicting it.

## Changing a fixture

Changing these files **will** move the snapshot in
`tests/catalog/fixture/__snapshots__/`. That is the point: the snapshot should
only move when the rendering contract changes, and then the diff is small enough
to read.
