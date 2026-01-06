/**
 * NDJSON (Newline Delimited JSON) output formatter for CLI commands.
 *
 * Provides streaming-friendly output with one JSON record per line.
 * Ideal for piping to tools like `jq` or processing large datasets.
 *
 * @see https://github.com/ndjson/ndjson-spec
 */

/**
 * Custom replacer function to handle special types during JSON serialization.
 * - Converts Date objects to ISO strings
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

/**
 * Format a single record as an NDJSON line (compact JSON with no trailing newline).
 */
export function formatNdjsonLine<T>(record: T): string {
  return JSON.stringify(record, jsonReplacer)
}

/**
 * Format an array of records as NDJSON (one JSON object per line).
 * Each line is a complete, self-contained JSON object.
 */
export function formatNdjson<T>(records: T[]): string {
  return records.map((record) => formatNdjsonLine(record)).join("\n")
}

/**
 * Generator function to yield NDJSON lines one at a time.
 * Useful for streaming large datasets without buffering the entire output.
 */
export function* streamNdjson<T>(records: Iterable<T>): Generator<string, void, unknown> {
  for (const record of records) {
    yield formatNdjsonLine(record)
  }
}

/**
 * Print a single record as an NDJSON line to stdout.
 */
export function printNdjsonLine<T>(record: T): void {
  console.log(formatNdjsonLine(record))
}

/**
 * Print an array of records as NDJSON to stdout.
 * Each record is printed on its own line.
 */
export function printNdjson<T>(records: T[]): void {
  for (const record of records) {
    console.log(formatNdjsonLine(record))
  }
}

/**
 * Stream records to stdout as NDJSON.
 * Flushes each line immediately, making it suitable for real-time output.
 */
export function streamPrintNdjson<T>(records: Iterable<T>): void {
  for (const record of records) {
    console.log(formatNdjsonLine(record))
  }
}
