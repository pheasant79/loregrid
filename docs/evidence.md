# Verification evidence

Report checks only when they have been run against the current code and data.

## What each check establishes

- `pnpm check`: TypeScript type correctness.
- `pnpm test`: unit and module behavior.
- `pnpm validate -- <file>`: structural validity of one tree file.
- `pnpm build`: production bundle generation.
- `pnpm test:e2e`: browser workflows and visual checks configured in Playwright.
- `pnpm benchmark`: local synthetic performance measurements.

A passing structural validator does not prove that a learning plan is accurate or
complete. A benchmark describes its test data and machine; it is not a universal
performance guarantee.

When sharing results, include the command, date, browser or machine where relevant, and
any skipped checks.
