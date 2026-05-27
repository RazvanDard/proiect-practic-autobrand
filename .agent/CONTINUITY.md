[PLANS]
- 2026-05-21T21:15:34+03:00 [USER] User requested the scrape cron to run hourly between 12:00 and 18:00 Romania/Bucharest time, then requested a git commit and push command.

[DECISIONS]
- 2026-05-21T21:15:34+03:00 [CODE] Convex cron strings are UTC, so the schedule was changed to UTC candidate hours and the action gates execution by `Europe/Bucharest` local hour to handle DST.
- 2026-05-21T21:15:34+03:00 [CODE] Generated `web/tsconfig.tsbuildinfo` was left uncommitted.

[PROGRESS]
- 2026-05-21T21:15:34+03:00 [CODE] Updated `web/convex/crons.ts`, `web/convex/scrape.ts`, `scraper/app/main.py`, and `README.md` for the Bucharest scrape window.

[DISCOVERIES]
- 2026-05-21T21:15:34+03:00 [TOOL] `date -Is` reported `2026-05-21T21:15:34+03:00`; current Bucharest offset is UTC+03:00.
- 2026-05-21T21:15:34+03:00 [TOOL] Existing cron was `0 12,13,14,15,16,17,18 * * *`, which Convex interprets as UTC.
- 2026-05-21T21:15:34+03:00 [TOOL] `npm run typecheck` passed; `npm run lint` failed because `eslint` was not found.

[OUTCOMES]
- 2026-05-21T21:15:34+03:00 [CODE] Cron behavior now targets 12:00-18:00 in `Europe/Bucharest` instead of 12:00-18:00 UTC.
