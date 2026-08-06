# Badge assets

Drop these files in this folder (`public/badges/`). Filenames must match exactly.

Icons are used as-is, no CSS ring or overlay applied — the artwork should
already include its own tier styling. `BADGE_TIER_COLOR` in
`src/lib/badges.ts` is only used for the colored strip on /badges cards.

## Badge icons

- `100k.png` — 100K Value
- `500k.png` — 500K Value
- `1M.png` — 1M Value
- `5M.png` — 5M Value
- `number1.png` — #1 Serial Owner
- `rare.png` — Rare Owner
- `rare3.png` — Rare Lover
- `crown.png` — Royalty (own any Crown item)
- `crystal.png` — Crystal Keeper (own any Crystalline Growth item)
- `gum.png` — Gum Chewer (own any Chewing Gum item)
- `developer.png` — Developer (auto-granted to user id 15)
- `value_mod.png` — Value Mod (manual-only, grant/revoke from Admin -> Sync -> Community Badges)

To add a new badge later, add its icon here and add an entry to `src/lib/badges.ts` — no
database changes needed.
