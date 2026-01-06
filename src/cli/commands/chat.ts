/**
 * Chat CLI subcommands.
 *
 * Provides commands for listing, showing, and searching chat messages
 * across OpenCode sessions.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions, type GlobalOptions } from "../index"
import {
  loadSessionChatIndex,
  loadSessionRecords,
  hydrateChatMessageParts,
  searchSessionsChat,
  type ChatMessage,
} from "../../lib/opencode-data"
import { copyToClipboard } from "../../lib/clipboard"
import { resolveSessionId } from "../resolvers"
import { withErrorHandling, UsageError, NotFoundError } from "../errors"
import {
  getOutputOptions,
  printChatOutput,
  printChatMessageOutput,
  printChatSearchOutput,
  type IndexedChatMessage,
  type IndexedChatSearchResult,
  type OutputFormat,
} from "../output"

/**
 * Collect all options from a command and its ancestors.
 * Commander stores global options on the root program, not on subcommands.
 */
function collectOptions(cmd: Command): OptionValues {
  const opts: OptionValues = {}
  let current: Command | null = cmd
  while (current) {
    Object.assign(opts, current.opts())
    current = current.parent
  }
  return opts
}

/**
 * Options specific to the chat list command.
 */
export interface ChatListOptions {
  /** Session ID to list messages from */
  session: string
  /** Include message parts in output */
  includeParts: boolean
}

/**
 * Options specific to the chat show command.
 */
export interface ChatShowOptions {
  /** Session ID containing the message */
  session: string
  /** Message ID to show */
  message?: string
  /** Message index (1-based) to show */
  index?: number
  /** Copy message content to clipboard */
  clipboard?: boolean
}

/**
 * Options specific to the chat search command.
 */
export interface ChatSearchOptions {
  /** Search query */
  query: string
  /** Filter by project ID */
  project?: string
}

/**
 * Register chat subcommands on the given parent command.
 */
export function registerChatCommands(parent: Command): void {
  const chat = parent
    .command("chat")
    .description("View and search chat messages")

  chat
    .command("list")
    .description("List messages in a session")
    .requiredOption("--session <sessionId>", "Session ID to list messages from")
    .option("--include-parts", "Include message parts in output", false)
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const listOpts: ChatListOptions = {
        session: String(cmdOpts.session),
        includeParts: Boolean(cmdOpts.includeParts),
      }
      await withErrorHandling(handleChatList, globalOpts.format)(
        globalOpts,
        listOpts
      )
    })

  chat
    .command("show")
    .description("Show a specific message")
    .requiredOption("--session <sessionId>", "Session ID containing the message")
    .option("-m, --message <messageId>", "Message ID to show")
    .option("-i, --index <number>", "Message index (1-based) to show")
    .option("-c, --clipboard", "Copy message content to clipboard")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const showOpts: ChatShowOptions = {
        session: String(cmdOpts.session),
        message: cmdOpts.message as string | undefined,
        index: cmdOpts.index ? parseInt(String(cmdOpts.index), 10) : undefined,
        clipboard: Boolean(cmdOpts.clipboard),
      }
      await withErrorHandling(handleChatShow, globalOpts.format)(
        globalOpts,
        showOpts
      )
    })

  chat
    .command("search")
    .description("Search chat content across sessions")
    .requiredOption("-q, --query <query>", "Search query")
    .option("-p, --project <projectId>", "Filter by project ID")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const searchOpts: ChatSearchOptions = {
        query: String(cmdOpts.query),
        project: cmdOpts.project as string | undefined,
      }
      await withErrorHandling(handleChatSearch, globalOpts.format)(
        globalOpts,
        searchOpts
      )
    })
}

/**
 * Handle the chat list command.
 *
 * Lists messages in a session, ordered by createdAt (ascending).
 * Optionally includes message parts for full content.
 */
async function handleChatList(
  globalOpts: GlobalOptions,
  listOpts: ChatListOptions
): Promise<void> {
  // Resolve session ID (with prefix matching)
  const { session } = await resolveSessionId(listOpts.session, {
    root: globalOpts.root,
    allowPrefix: true,
  })

  // Load message index for the session
  let messages = await loadSessionChatIndex(session.sessionId, globalOpts.root)

  // Hydrate parts if requested
  if (listOpts.includeParts) {
    messages = await Promise.all(
      messages.map((msg) => hydrateChatMessageParts(msg, globalOpts.root))
    )
  }

  // Apply limit
  if (globalOpts.limit && messages.length > globalOpts.limit) {
    messages = messages.slice(0, globalOpts.limit)
  }

  // Add 1-based index for display
  const indexedMessages: IndexedChatMessage[] = messages.map((msg, i) => ({
    ...msg,
    index: i + 1,
  }))

  // Output using configured format
  const outputOpts = getOutputOptions(globalOpts)
  printChatOutput(indexedMessages, outputOpts)
}

/**
 * Handle the chat show command.
 *
 * Shows a specific message by ID or 1-based index.
 * Optionally copies the message content to clipboard.
 */
async function handleChatShow(
  globalOpts: GlobalOptions,
  showOpts: ChatShowOptions
): Promise<void> {
  // Validate that either --message or --index is provided
  if (!showOpts.message && showOpts.index === undefined) {
    throw new UsageError(
      "Either --message <messageId> or --index <number> is required"
    )
  }
  if (showOpts.message && showOpts.index !== undefined) {
    throw new UsageError(
      "Cannot use both --message and --index. Use one or the other."
    )
  }

  // Resolve session ID (with prefix matching)
  const { session } = await resolveSessionId(showOpts.session, {
    root: globalOpts.root,
    allowPrefix: true,
  })

  // Load all messages for the session
  const messages = await loadSessionChatIndex(session.sessionId, globalOpts.root)

  if (messages.length === 0) {
    throw new NotFoundError(
      `Session "${session.sessionId}" has no messages`,
      "message"
    )
  }

  let message: ChatMessage | undefined

  if (showOpts.message) {
    // Find by message ID (exact or prefix match)
    const messageId = showOpts.message
    message = messages.find((m) => m.messageId === messageId)
    if (!message) {
      // Try prefix matching
      const prefixMatches = messages.filter((m) =>
        m.messageId.startsWith(messageId)
      )
      if (prefixMatches.length === 1) {
        message = prefixMatches[0]
      } else if (prefixMatches.length > 1) {
        throw new NotFoundError(
          `Ambiguous message ID prefix "${messageId}" matches ${prefixMatches.length} messages: ${prefixMatches.map((m) => m.messageId).join(", ")}`,
          "message"
        )
      } else {
        throw new NotFoundError(
          `Message "${messageId}" not found in session "${session.sessionId}"`,
          "message"
        )
      }
    }
  } else {
    // Find by index (1-based)
    const index = showOpts.index!
    if (index < 1 || index > messages.length) {
      throw new NotFoundError(
        `Message index ${index} is out of range. Session has ${messages.length} message(s).`,
        "message"
      )
    }
    message = messages[index - 1]
  }

  // Hydrate message parts to get full content
  const hydratedMessage = await hydrateChatMessageParts(message, globalOpts.root)

  // Copy to clipboard if requested
  if (showOpts.clipboard) {
    const content = hydratedMessage.parts
      ?.map((p) => p.text)
      .join("\n\n") ?? hydratedMessage.previewText
    await copyToClipboard(content)
    if (globalOpts.format === "table") {
      console.log("(copied to clipboard)")
    }
  }

  // Output the message
  printChatMessageOutput(hydratedMessage, globalOpts.format)
}

/**
 * Handle the chat search command.
 *
 * Searches chat content across all sessions (or filtered by project).
 * Returns matching messages with context snippets.
 */
async function handleChatSearch(
  globalOpts: GlobalOptions,
  searchOpts: ChatSearchOptions
): Promise<void> {
  // Load sessions to search
  const sessions = await loadSessionRecords({
    root: globalOpts.root,
    projectId: searchOpts.project,
  })

  // Search across sessions using the limit from global options
  const results = await searchSessionsChat(
    sessions,
    searchOpts.query,
    globalOpts.root,
    { maxResults: globalOpts.limit }
  )

  // Add 1-based index for display
  const indexedResults: IndexedChatSearchResult[] = results.map((result, i) => ({
    ...result,
    index: i + 1,
  }))

  // Output using configured format
  const outputOpts = getOutputOptions(globalOpts)
  printChatSearchOutput(indexedResults, outputOpts)
}
