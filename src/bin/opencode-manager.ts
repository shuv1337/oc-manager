#!/usr/bin/env bun
/**
 * Main CLI entrypoint for opencode-manager.
 *
 * Routes between TUI and CLI modes based on provided subcommands:
 * - No subcommand or "tui" → launches TUI (default)
 * - CLI subcommands (projects, sessions, chat, tokens) → launches CLI
 *
 * Uses dynamic imports to keep initial load fast and avoid loading
 * unused modules.
 */

// Known CLI subcommands that should route to the CLI module
const CLI_SUBCOMMANDS = new Set([
  "projects",
  "sessions",
  "chat",
  "tokens",
])

// Subcommands that explicitly request TUI
const TUI_SUBCOMMANDS = new Set(["tui"])

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const firstArg = args[0]

  // Determine routing based on first argument
  const isCliSubcommand = firstArg && CLI_SUBCOMMANDS.has(firstArg)
  const isTuiSubcommand = firstArg && TUI_SUBCOMMANDS.has(firstArg)

  if (isCliSubcommand) {
    // Route to CLI module (dynamically imported)
    // Using string path to avoid TypeScript errors before CLI module exists
    const cliModulePath = "../cli/index"
    try {
      const cliModule = await import(cliModulePath)
      if (typeof cliModule.runCLI !== "function") {
        throw new Error("CLI module missing runCLI export")
      }
      await cliModule.runCLI(args)
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code
      const errMessage = (error as Error).message
      if (errCode === "ERR_MODULE_NOT_FOUND" || errMessage.includes("Cannot find module")) {
        console.error(`CLI module not yet implemented. Subcommand: ${firstArg}`)
        console.error("Run without subcommand to launch TUI, or use --help for usage.")
        process.exit(1)
      }
      throw error
    }
  } else {
    // Default: launch TUI
    // Strip "tui" subcommand if present so TUI args parser doesn't see it
    const tuiArgs = isTuiSubcommand ? args.slice(1) : args
    const { bootstrap } = await import("../tui/index")
    await bootstrap(tuiArgs)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
