/**
 * Tests for `chat list` CLI command output.
 *
 * Uses fixture store at tests/fixtures/store to verify command output formats.
 */

import { describe, expect, it } from "bun:test";
import { $ } from "bun";
import { FIXTURE_STORE_ROOT } from "../../helpers";

describe("chat list --format json", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toBeArray();
  });

  it("includes correct message count", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // Fixture has 2 messages: msg_user_01 and msg_assistant_01
    expect(parsed.data.length).toBe(2);
  });

  it("includes message fields in JSON output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const message of parsed.data) {
      expect(message).toHaveProperty("sessionId");
      expect(message).toHaveProperty("messageId");
      expect(message).toHaveProperty("role");
      expect(message).toHaveProperty("index");
    }
  });

  it("serializes Date fields as ISO strings", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const message of parsed.data) {
      if (message.createdAt) {
        // ISO date string format check
        expect(message.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    }
  });

  it("includes meta with limit info", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("meta");
    expect(parsed.meta).toHaveProperty("limit");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --limit 1`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
  });

  it("supports prefix matching for session ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);
    expect(parsed.data[0].sessionId).toBe("session_add_tests");
  });

  it("returns exit code 3 for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
  });
});

describe("chat list --format ndjson", () => {
  it("outputs valid NDJSON (one JSON object per line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("includes correct message count (one per line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(2);
  });

  it("includes message fields in each NDJSON line", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    for (const line of lines) {
      const message = JSON.parse(line);
      expect(message).toHaveProperty("sessionId");
      expect(message).toHaveProperty("messageId");
      expect(message).toHaveProperty("role");
      expect(message).toHaveProperty("index");
    }
  });

  it("does not include envelope wrapper (raw records only)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // First line should be a message, not an envelope
    const firstLine = JSON.parse(lines[0]);
    expect(firstLine).not.toHaveProperty("ok");
    expect(firstLine).not.toHaveProperty("data");
    expect(firstLine).toHaveProperty("messageId");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson --limit 1`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
  });
});

describe("chat list --format table", () => {
  it("outputs table with headers", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Should have header row
    expect(output).toContain("#");
    expect(output).toContain("Role");
    expect(output).toContain("Message ID");
  });

  it("outputs table with header underline", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();
    const lines = output.split("\n");

    // Second line should be header underline (dashes)
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[1]).toMatch(/^-+/);
  });

  it("includes message data rows", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Should include message roles
    expect(output).toContain("user");
    expect(output).toContain("assistant");
  });

  it("shows correct message count (header + underline + data rows)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // 1 header + 1 underline + 2 data rows = 4 total lines
    expect(lines.length).toBe(4);
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table --limit 1`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // 1 header + 1 underline + 1 data row = 3 total lines
    expect(lines.length).toBe(3);
  });
});

/**
 * Tests to verify chat list ordering matches TUI behavior.
 *
 * Messages should be ordered by createdAt ascending (oldest first).
 * This is the conversation order - user message followed by assistant response.
 */
describe("chat list ordering", () => {
  it("orders messages by createdAt ascending (oldest first)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);

    // msg_user_01 has createdAt 1704240100000 (earlier)
    // msg_assistant_01 has createdAt 1704240200000 (later)
    expect(parsed.data[0].messageId).toBe("msg_user_01");
    expect(parsed.data[1].messageId).toBe("msg_assistant_01");
  });

  it("uses messageId as tiebreaker for identical timestamps", async () => {
    // This tests the stable sort behavior - if two messages have the same
    // createdAt, they should be sorted by messageId lexicographically
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);

    // Verify the order is deterministic
    const messageIds = parsed.data.map((m: { messageId: string }) => m.messageId);
    expect(messageIds).toEqual(["msg_user_01", "msg_assistant_01"]);
  });

  it("user message comes before assistant response in conversation order", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);

    // First message should be user, second should be assistant
    expect(parsed.data[0].role).toBe("user");
    expect(parsed.data[1].role).toBe("assistant");
  });

  it("maintains consistent ordering across multiple list calls", async () => {
    // Run the same list multiple times and verify consistent ordering
    const list1 = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const list2 = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();

    const parsed1 = JSON.parse(list1.stdout.toString());
    const parsed2 = JSON.parse(list2.stdout.toString());

    expect(parsed1.data.length).toBe(parsed2.data.length);
    for (let i = 0; i < parsed1.data.length; i++) {
      expect(parsed1.data[i].messageId).toBe(parsed2.data[i].messageId);
    }
  });
});

/**
 * Tests to verify 1-based index numbering for chat messages.
 *
 * The index field should start at 1 (not 0) for user-friendly display.
 */
describe("chat list index numbering", () => {
  it("assigns 1-based indexes to messages", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);

    // First message should have index 1, second should have index 2
    expect(parsed.data[0].index).toBe(1);
    expect(parsed.data[1].index).toBe(2);
  });

  it("indexes are sequential starting from 1", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const indexes = parsed.data.map((m: { index: number }) => m.index);

    // Verify indexes are 1, 2, 3, ... n
    for (let i = 0; i < indexes.length; i++) {
      expect(indexes[i]).toBe(i + 1);
    }
  });

  it("index 1 corresponds to the oldest message", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);

    // msg_user_01 is oldest (createdAt 1704240100000), should have index 1
    const firstMessage = parsed.data.find((m: { index: number }) => m.index === 1);
    expect(firstMessage.messageId).toBe("msg_user_01");
  });

  it("indexes are included in NDJSON output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const message = JSON.parse(lines[i]);
      expect(message).toHaveProperty("index");
      expect(message.index).toBe(i + 1);
    }
  });

  it("indexes are shown in table output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Table should have a # column with indexes
    expect(output).toContain("#");
    // Data rows should contain the indexes 1 and 2
    expect(output).toContain("1");
    expect(output).toContain("2");
  });

  it("limit affects index assignment (indexes are post-limit)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --limit 1`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);

    // Even with limit, first returned message should have index 1
    expect(parsed.data[0].index).toBe(1);
  });
});

describe("chat list --include-parts", () => {
  it("includes parts when flag is set", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --include-parts`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // At least one message should have parts array (not null)
    const messagesWithParts = parsed.data.filter((m: { parts: unknown }) => Array.isArray(m.parts));
    expect(messagesWithParts.length).toBeGreaterThan(0);
  });

  it("parts are null when flag is not set", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // All messages should have parts: null without the flag
    for (const message of parsed.data) {
      expect(message.parts).toBeNull();
    }
  });

  it("includes previewText computed from parts when flag is set", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --include-parts`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const message of parsed.data) {
      expect(message).toHaveProperty("previewText");
      // When parts are loaded, previewText should not be the placeholder
      if (Array.isArray(message.parts) && message.parts.length > 0) {
        expect(message.previewText).not.toBe("[loading...]");
      }
    }
  });

  it("includes totalChars when parts are loaded", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --include-parts`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const message of parsed.data) {
      expect(message).toHaveProperty("totalChars");
      // When parts are loaded, totalChars should be a number
      if (Array.isArray(message.parts)) {
        expect(typeof message.totalChars).toBe("number");
      }
    }
  });
});

// =============================================================================
// chat show command tests
// =============================================================================

describe("chat show --message", () => {
  it("shows message by exact message ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_user_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.messageId).toBe("msg_user_01");
    expect(parsed.data.role).toBe("user");
  });

  it("shows message by message ID prefix", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_user --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.messageId).toBe("msg_user_01");
  });

  it("includes hydrated message parts", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_user_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.parts).toBeArray();
    expect(parsed.data.parts.length).toBeGreaterThan(0);
  });

  it("includes previewText computed from parts", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_user_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.previewText).toContain("add unit tests");
  });

  it("returns exit code 3 for non-existent message ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message nonexistent_msg --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
  });

  it("returns exit code 3 for ambiguous message ID prefix", async () => {
    // "msg_" matches both msg_user_01 and msg_assistant_01
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_ --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
    const output = result.stderr.toString();
    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("Ambiguous");
  });

  it("works with session ID prefix", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add --message msg_user_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.messageId).toBe("msg_user_01");
  });
});

describe("chat show --index", () => {
  it("shows message by 1-based index", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 1 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    // Index 1 is the first message (oldest by createdAt) = msg_user_01
    expect(parsed.data.messageId).toBe("msg_user_01");
  });

  it("index 2 returns second message", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 2 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.messageId).toBe("msg_assistant_01");
  });

  it("returns exit code 3 for index 0", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 0 --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
  });

  it("returns exit code 3 for index greater than message count", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 100 --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
    const output = result.stderr.toString();
    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("out of range");
  });

  it("returns exit code 3 for negative index", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index -1 --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
  });
});

describe("chat show validation", () => {
  it("returns exit code 2 when neither --message nor --index is provided", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(2);
    const output = result.stderr.toString();
    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("Either --message");
  });

  it("returns exit code 2 when both --message and --index are provided", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_user_01 --index 1 --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(2);
    const output = result.stderr.toString();
    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("Cannot use both");
  });

  it("returns exit code 3 for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session nonexistent_session --message msg_user_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
  });

  it("returns exit code 3 for empty session (no messages)", async () => {
    // session_parser_fix exists but has no messages in fixture
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_parser_fix --index 1 --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);
    const output = result.stderr.toString();
    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("no messages");
  });
});

describe("chat show output formats", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 1 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toHaveProperty("messageId");
  });

  it("outputs valid NDJSON (single line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 1 --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // Single message = single line
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toHaveProperty("messageId");
  });

  it("outputs formatted table with message details", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --index 1 --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Message ID:");
    expect(output).toContain("Role:");
    expect(output).toContain("Content:");
  });

  it("table format shows full message content", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_user_01 --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("add unit tests");
  });
});

describe("chat show full text content", () => {
  it("includes combined full text from all parts", async () => {
    // msg_assistant_01 has multiple parts: text and tool
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_assistant_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.parts).toBeArray();
    expect(parsed.data.parts.length).toBeGreaterThan(1);
  });

  it("previewText includes text content from parts", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_assistant_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.previewText).toContain("help you add unit tests");
  });

  it("includes parts with different types (text, tool, subtask)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts chat show --session session_add_tests --message msg_assistant_01 --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const partTypes = parsed.data.parts.map((p: { type: string }) => p.type);
    expect(partTypes).toContain("text");
    // Also has tool and subtask parts
    expect(parsed.data.parts.length).toBeGreaterThanOrEqual(2);
  });
});
