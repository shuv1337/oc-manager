import { performance } from "node:perf_hooks"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadProjectRecords, DEFAULT_ROOT } from "../src/lib/opencode-data"
import { loadProjectRecordsSqlite, DEFAULT_SQLITE_PATH } from "../src/lib/opencode-data-sqlite"

type BenchmarkResult = {
  label: string
  iterations: number
  avgMs: number
  minMs: number
  maxMs: number
  medianMs: number
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx === -1 || idx === process.argv.length - 1) {
    return undefined
  }
  return process.argv[idx + 1]
}

async function runBenchmark(
  label: string,
  iterations: number,
  fn: () => Promise<unknown>
): Promise<BenchmarkResult> {
  const times: number[] = []

  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const total = times.reduce((acc, v) => acc + v, 0)
  return {
    label,
    iterations,
    avgMs: total / iterations,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    medianMs: median(times),
  }
}

async function main() {
  const iterationsArg = parseArg("--iterations")
  const iterations = iterationsArg ? Number(iterationsArg) : 100
  if (!Number.isFinite(iterations) || iterations <= 0) {
    throw new Error(`Invalid --iterations value: ${iterationsArg}`)
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(scriptDir, "..")
  const defaultFixtureRoot = join(repoRoot, "tests", "fixtures", "store")
  const defaultFixtureDb = join(repoRoot, "tests", "fixtures", "test.db")

  const rootArg = parseArg("--root")
  const dbArg = parseArg("--db")

  const root = rootArg ? resolve(rootArg) : defaultFixtureRoot ?? DEFAULT_ROOT
  const dbPath = dbArg ? resolve(dbArg) : defaultFixtureDb ?? DEFAULT_SQLITE_PATH

  // Warm-up runs to reduce first-run noise
  await loadProjectRecords({ root })
  await loadProjectRecordsSqlite({ db: dbPath })

  const jsonl = await runBenchmark("JSONL loadProjectRecords", iterations, () =>
    loadProjectRecords({ root })
  )
  const sqlite = await runBenchmark("SQLite loadProjectRecords", iterations, () =>
    loadProjectRecordsSqlite({ db: dbPath })
  )

  console.log("SQLite vs JSONL benchmark (loadProjectRecords)")
  console.log(`root: ${root}`)
  console.log(`db: ${dbPath}`)
  console.log("")
  for (const result of [jsonl, sqlite]) {
    console.log(
      `${result.label}: avg=${result.avgMs.toFixed(2)}ms ` +
        `median=${result.medianMs.toFixed(2)}ms ` +
        `min=${result.minMs.toFixed(2)}ms max=${result.maxMs.toFixed(2)}ms ` +
        `iterations=${result.iterations}`
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
