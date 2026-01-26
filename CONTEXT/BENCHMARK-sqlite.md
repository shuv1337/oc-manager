# SQLite vs JSONL Benchmark

## Summary
Benchmark for `loadProjectRecords` comparing JSONL and SQLite backends using the built-in test fixtures.

## Environment
- Date: 2026-01-22
- Command:
  - `bun scripts/benchmark-sqlite.ts --iterations 50`
- Dataset:
  - JSONL root: `tests/fixtures/store` (2 projects)
  - SQLite DB: `tests/fixtures/test.db`

## Results (50 iterations)
- JSONL loadProjectRecords:
  - avg=0.07ms, median=0.07ms, min=0.04ms, max=0.24ms
- SQLite loadProjectRecords:
  - avg=0.07ms, median=0.06ms, min=0.05ms, max=0.24ms

## Notes
- Results are effectively identical on the small fixture dataset.
- Real-world performance differences will depend on dataset size, disk speed, and cache state.
- Rerun the benchmark with `--root` and `--db` pointing to a production store to evaluate real-world performance.
