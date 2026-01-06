import type { KeyEvent, SelectOption } from "@opentui/core"
import { createRoot, useKeyboard, useRenderer } from "@opentui/react"
import { createCliRenderer } from "@opentui/core"
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { resolve } from "node:path"
import { exec } from "node:child_process"
import {
  DEFAULT_ROOT,
  ProjectRecord,
  SessionRecord,
  deleteProjectMetadata,
  deleteSessionMetadata,
  describeProject,
  describeSession,
  formatDate,
  formatDisplayPath,
  loadProjectRecords,
  loadSessionRecords,
  updateSessionTitle,
  copySession,
  moveSession,
  copySessions,
  moveSessions,
  BatchOperationResult,
  TokenSummary,
  TokenBreakdown,
  AggregateTokenSummary,
  computeSessionTokenSummary,
  computeProjectTokenSummary,
  computeGlobalTokenSummary,
  clearTokenCache,
  ChatMessage,
  ChatPart,
  loadSessionChatIndex,
  hydrateChatMessageParts,
  ChatSearchResult,
  searchSessionsChat,
} from "./lib/opencode-data"
import { Searcher } from "fast-fuzzy"

type TabKey = "projects" | "sessions"

type PanelHandle = {
  handleKey: (key: KeyEvent) => void
  refresh: () => void
}

type NotificationLevel = "info" | "error"

type ConfirmState = {
  title: string
  details?: string[]
  actionLabel?: string
  onConfirm: () => Promise<void> | void
}

type ProjectsPanelProps = {
  root: string
  active: boolean
  locked: boolean
  searchQuery: string
  onNotify: (message: string, level?: NotificationLevel) => void
  requestConfirm: (state: ConfirmState) => void
  onNavigateToSessions: (projectId: string) => void
}

type SessionsPanelProps = {
  root: string
  active: boolean
  locked: boolean
  projectFilter: string | null
  searchQuery: string
  globalTokenSummary: AggregateTokenSummary | null
  onNotify: (message: string, level?: NotificationLevel) => void
  requestConfirm: (state: ConfirmState) => void
  onClearFilter: () => void
  onOpenChatViewer: (session: SessionRecord) => void
}

const MAX_CONFIRM_PREVIEW = 5

// Palette used for subtle color accents
const PALETTE = {
  primary: "#a5b4fc", // lavender
  accent: "#93c5fd", // sky
  success: "#86efac", // green
  danger: "#fca5a5", // red
  info: "#38bdf8", // cyan
  key: "#fbbf24", // amber
  muted: "#9ca3af", // gray
} as const

// Token formatting helpers
function formatTokenCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  }
  return String(n)
}

function formatTokenBreakdown(tokens: TokenBreakdown): string[] {
  return [
    `Input: ${formatTokenCount(tokens.input)}`,
    `Output: ${formatTokenCount(tokens.output)}`,
    `Reasoning: ${formatTokenCount(tokens.reasoning)}`,
    `Cache Read: ${formatTokenCount(tokens.cacheRead)}`,
    `Cache Write: ${formatTokenCount(tokens.cacheWrite)}`,
    `Total: ${formatTokenCount(tokens.total)}`,
  ]
}

function formatTokenSummaryShort(summary: TokenSummary): string {
  if (summary.kind === 'unknown') {
    return '?'
  }
  return formatTokenCount(summary.tokens.total)
}

function formatAggregateSummaryShort(summary: AggregateTokenSummary): string {
  if (summary.total.kind === 'unknown') {
    return '?'
  }
  const base = formatTokenCount(summary.total.tokens.total)
  if (summary.unknownSessions && summary.unknownSessions > 0) {
    return `${base} (+${summary.unknownSessions} unknown)`
  }
  return base
}

function copyToClipboard(text: string): void {
  const cmd = process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard"
  const proc = exec(cmd, (error) => {
    if (error) {
      // We can't easily notify from here without context, but it's a best effort
      console.error("Failed to copy to clipboard:", error)
    }
  })
  proc.stdin?.write(text)
  proc.stdin?.end()
}

type ChildrenProps = { children: React.ReactNode }

const Section = ({ title, children }: { title: string } & ChildrenProps) => (
  <box title={title} style={{ border: true, padding: 1, marginBottom: 1, flexDirection: "column" }}>
    {children}
  </box>
)

const SearchBar = ({
  active,
  context,
  query,
}: {
  active: boolean
  context: string
  query: string
}) => (
  <box style={{ border: true, padding: 1, marginBottom: 1, flexDirection: "row", gap: 1 }}>
    <text fg={PALETTE.accent}>Search</text>
    <text>({context}):</text>
    <text fg={active ? PALETTE.key : PALETTE.muted}>{active ? "/" + query : query || "(none)"}</text>
    <text>—</text>
    <text>Enter apply</text>
    <text>•</text>
    <text>Esc clear</text>
  </box>
)

const Row = ({ children }: ChildrenProps) => {
  const kids = React.Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""))
  return <box style={{ flexDirection: "row", alignItems: "baseline" }}>{kids as any}</box>
}

const Bullet = ({ children }: ChildrenProps) => {
  const kids = React.Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""))
  return (
    <Row>
      <text fg={PALETTE.muted}>• </text>
      <box style={{ flexDirection: "row", flexWrap: "wrap" }}>{kids as any}</box>
    </Row>
  )
}

const Columns = ({ children }: ChildrenProps) => {
  const kids = React.Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""))
  return <box style={{ flexDirection: "row", gap: 2, marginTop: 1, flexGrow: 1 }}>{kids as any}</box>
}

const KeyChip = ({ k }: { k: string }) => <text fg={PALETTE.key}>[{k}]</text>

type ProjectSelectorProps = {
  projects: ProjectRecord[]
  cursor: number
  onCursorChange: (index: number) => void
  onSelect: (project: ProjectRecord) => void
  onCancel: () => void
  operationMode: 'move' | 'copy'
  sessionCount: number
}

const ProjectSelector = ({
  projects,
  cursor,
  onCursorChange,
  onSelect,
  onCancel,
  operationMode,
  sessionCount
}: ProjectSelectorProps) => {
  const options: SelectOption[] = projects.map((p, idx) => ({
    name: `${formatDisplayPath(p.worktree)} (${p.projectId})`,
    description: p.state,
    value: idx
  }))

  return (
    <box
      title={`Select Target Project (${operationMode} ${sessionCount} session${sessionCount > 1 ? 's' : ''})`}
      style={{
        border: true,
        borderColor: operationMode === 'move' ? PALETTE.key : PALETTE.accent,
        padding: 1,
        position: 'absolute',
        top: 5,
        left: 5,
        right: 5,
        bottom: 5,
        zIndex: 100
      }}
    >
      <select
        options={options}
        selectedIndex={cursor}
        onChange={onCursorChange}
        onSelect={(idx) => {
          const project = projects[idx]
          if (project) onSelect(project)
        }}
        focused={true}
        showScrollIndicator
      />
      <text fg={PALETTE.muted}>Enter to select, Esc to cancel</text>
    </box>
  )
}

const ProjectsPanel = forwardRef<PanelHandle, ProjectsPanelProps>(function ProjectsPanel(
  { root, active, locked, searchQuery, onNotify, requestConfirm, onNavigateToSessions },
  ref,
) {
  const [records, setRecords] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingOnly, setMissingOnly] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  // Token state for projects
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([])
  const [currentProjectTokens, setCurrentProjectTokens] = useState<AggregateTokenSummary | null>(null)

  const missingCount = useMemo(() => records.filter((record) => record.state === "missing").length, [records])

  const visibleRecords = useMemo(() => {
    const base = missingOnly ? records.filter((record) => record.state === "missing") : records
    const q = searchQuery?.trim().toLowerCase() ?? ""
    if (!q) return base
    const tokens = q.split(/\s+/).filter(Boolean)
    return base.filter((record) => {
      const id = (record.projectId || "").toLowerCase()
      const path = (record.worktree || "").toLowerCase()
      return tokens.every((tok) => id.includes(tok) || path.includes(tok))
    })
  }, [records, missingOnly, searchQuery])

  const currentRecord = visibleRecords[cursor]

  const refreshRecords = useCallback(
    async (silent = false) => {
      setLoading(true)
      setError(null)
      try {
        const data = await loadProjectRecords({ root })
        setRecords(data)
        if (!silent) {
          onNotify(`Loaded ${data.length} project(s).`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        onNotify(`Failed to load projects: ${message}`, "error")
      } finally {
        setLoading(false)
      }
    },
    [root, onNotify],
  )

  useEffect(() => {
    void refreshRecords(true)
  }, [refreshRecords])

  useEffect(() => {
    setSelectedIndexes((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const validIndexes = new Set(records.map((record) => record.index))
      let changed = false
      const next = new Set<number>()
      for (const index of prev) {
        if (validIndexes.has(index)) {
          next.add(index)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [records])

  useEffect(() => {
    setCursor((prev) => {
      if (visibleRecords.length === 0) {
        return 0
      }
      return Math.min(prev, visibleRecords.length - 1)
    })
  }, [visibleRecords.length])

  // Load all sessions once for token computation
  useEffect(() => {
    let cancelled = false
    loadSessionRecords({ root }).then((sessions) => {
      if (!cancelled) {
        setAllSessions(sessions)
      }
    })
    return () => { cancelled = true }
  }, [root, records]) // Re-fetch when projects change (implies sessions may have changed)

  // Compute token summary for current project
  useEffect(() => {
    setCurrentProjectTokens(null)
    if (!currentRecord || allSessions.length === 0) {
      return
    }
    let cancelled = false
    computeProjectTokenSummary(currentRecord.projectId, allSessions, root).then((summary) => {
      if (!cancelled) {
        setCurrentProjectTokens(summary)
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentRecord, allSessions, root])

  const toggleSelection = useCallback((record: ProjectRecord | undefined) => {
    if (!record) {
      return
    }
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(record.index)) {
        next.delete(record.index)
      } else {
        next.add(record.index)
      }
      return next
    })
  }, [])

  const selectedRecords = useMemo(() => {
    if (selectedIndexes.size === 0) {
      return currentRecord ? [currentRecord] : []
    }
    return records.filter((record) => selectedIndexes.has(record.index))
  }, [records, selectedIndexes, currentRecord])

  const selectOptions: SelectOption[] = useMemo(() => {
    return visibleRecords.map((record) => {
      const selected = selectedIndexes.has(record.index)
      const prefix = selected ? "[*]" : "[ ]"
      const label = `${prefix} #${record.index} ${formatDisplayPath(record.worktree)} (${record.state})`
      return {
        name: label,
        description: "",
        value: record.index,
      }
    })
  }, [visibleRecords, selectedIndexes])

  const requestDeletion = useCallback(() => {
    if (selectedRecords.length === 0) {
      onNotify("No projects selected for deletion.", "error")
      return
    }
    requestConfirm({
      title: `Delete ${selectedRecords.length} project metadata entr${selectedRecords.length === 1 ? "y" : "ies"}?`,
      details: selectedRecords
        .slice(0, MAX_CONFIRM_PREVIEW)
        .map((record) => describeProject(record, { fullPath: true })),
      onConfirm: async () => {
        const { removed, failed } = await deleteProjectMetadata(selectedRecords)
        setSelectedIndexes(new Set())
        const msg = failed.length
          ? `Removed ${removed.length} project file(s). Failed: ${failed.length}`
          : `Removed ${removed.length} project file(s).`
        onNotify(msg, failed.length ? "error" : "info")
        await refreshRecords(true)
      },
    })
  }, [selectedRecords, onNotify, requestConfirm, refreshRecords])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      if (!active || locked) {
        return
      }
      const letter = key.sequence?.toLowerCase()
      if (key.name === "space") {
        key.preventDefault()
        toggleSelection(currentRecord)
        return
      }
      if (letter === "m") {
        setMissingOnly((prev) => !prev)
        setCursor(0)
        return
      }
      if (letter === "a") {
        setSelectedIndexes((prev) => {
          const next = new Set(prev)
          if (next.size >= visibleRecords.length) {
            return new Set<number>()
          }
          for (const record of visibleRecords) {
            next.add(record.index)
          }
          return next
        })
        return
      }
      if (key.name === "escape") {
        setSelectedIndexes(new Set())
        return
      }
      if (letter === "d") {
        requestDeletion()
        return
      }
      if (key.name === "return" || key.name === "enter") {
        if (currentRecord) {
          onNavigateToSessions(currentRecord.projectId)
        }
        return
      }
    },
    [active, locked, currentRecord, visibleRecords, onNavigateToSessions, requestDeletion, toggleSelection],
  )

  useImperativeHandle(
    ref,
    () => ({
      handleKey,
      refresh: () => {
        void refreshRecords(true)
      },
    }),
    [handleKey, refreshRecords],
  )

  return (
    <box
      title="Projects"
      style={{
        border: true,
        borderColor: active ? "#22d3ee" : "#374151",
        flexDirection: "column",
        flexGrow: active ? 6 : 4,
        padding: 1,
      }}
    >
      <box flexDirection="column" marginBottom={1}>
        <text>Filter: {missingOnly ? "missing only" : "all"}</text>
        <text>
          Total: {records.length} | Missing: {missingCount} | Selected: {selectedIndexes.size}
        </text>
        <text>
          Keys: Space select, A select all, M toggle missing, D delete, Enter view sessions, Esc clear
        </text>
      </box>

      {error ? (
        <text fg="red">{error}</text>
      ) : loading ? (
        <text>Loading projects...</text>
      ) : visibleRecords.length === 0 ? (
        <text>No projects found.</text>
      ) : (
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <select
            style={{ flexGrow: 1 }}
            options={selectOptions}
            selectedIndex={Math.min(cursor, selectOptions.length - 1)}
            onChange={(index) => setCursor(index)}
            onSelect={(index) => {
              const record = visibleRecords[index]
              if (record) {
                onNavigateToSessions(record.projectId)
              }
            }}
            focused={active && !locked}
            showScrollIndicator
            showDescription
            wrapSelection={false}
          />
          {currentRecord ? (
            <box title="Details" style={{ border: true, marginTop: 1, padding: 1 }}>
              <text>Project: {currentRecord.projectId}  State: {currentRecord.state}</text>
              <text>Bucket: {currentRecord.bucket}  VCS: {currentRecord.vcs || "-"}</text>
              <text>Created: {formatDate(currentRecord.createdAt)}</text>
              <text>Path:</text>
              <text>{formatDisplayPath(currentRecord.worktree, { fullPath: true })}</text>
              <box style={{ marginTop: 1 }}>
                <text fg={PALETTE.accent}>Tokens: </text>
                {currentProjectTokens?.total.kind === 'known' ? (
                  <>
                    <text fg={PALETTE.success}>Total: {formatTokenCount(currentProjectTokens.total.tokens.total)}</text>
                    {currentProjectTokens.unknownSessions && currentProjectTokens.unknownSessions > 0 ? (
                      <text fg={PALETTE.muted}> (+{currentProjectTokens.unknownSessions} unknown sessions)</text>
                    ) : null}
                  </>
                ) : (
                  <text fg={PALETTE.muted}>{currentProjectTokens ? '?' : 'loading...'}</text>
                )}
              </box>
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})

const SessionsPanel = forwardRef<PanelHandle, SessionsPanelProps>(function SessionsPanel(
  { root, active, locked, projectFilter, searchQuery, globalTokenSummary, onNotify, requestConfirm, onClearFilter, onOpenChatViewer },
  ref,
) {
  const [records, setRecords] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [sortMode, setSortMode] = useState<"updated" | "created">("updated")
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isSelectingProject, setIsSelectingProject] = useState(false)
  const [operationMode, setOperationMode] = useState<'move' | 'copy' | null>(null)
  const [availableProjects, setAvailableProjects] = useState<ProjectRecord[]>([])
  const [projectCursor, setProjectCursor] = useState(0)
  // Token state
  const [currentTokenSummary, setCurrentTokenSummary] = useState<TokenSummary | null>(null)
  const [filteredTokenSummary, setFilteredTokenSummary] = useState<AggregateTokenSummary | null>(null)

  // Build fuzzy search candidates
  const searchCandidates = useMemo(() => {
    return records.map((session) => ({
      session,
      searchText: [
        session.title || "",
        session.sessionId,
        session.directory || "",
        session.projectId,
      ].join(" ").replace(/\s+/g, " ").trim(),
      updatedMs: (session.updatedAt ?? session.createdAt)?.getTime() ?? 0,
      createdMs: session.createdAt?.getTime() ?? 0,
    }))
  }, [records])

  // Build fuzzy searcher
  const searcher = useMemo(() => {
    return new Searcher(searchCandidates, {
      keySelector: (c) => c.searchText,
    })
  }, [searchCandidates])

  const visibleRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const aDate = sortMode === "created" ? (a.createdAt ?? a.updatedAt) : (a.updatedAt ?? a.createdAt)
      const bDate = sortMode === "created" ? (b.createdAt ?? b.updatedAt) : (b.updatedAt ?? b.createdAt)
      const aTime = aDate?.getTime() ?? 0
      const bTime = bDate?.getTime() ?? 0
      if (bTime !== aTime) return bTime - aTime
      return a.sessionId.localeCompare(b.sessionId)
    })
    const q = searchQuery.trim()
    if (!q) return sorted

    // Use fuzzy search
    const results = searcher.search(q, { returnMatchData: true })

    // Sort by score (descending), then by timestamp (based on sortMode), then by sessionId
    const matched = results
      .map((match) => ({
        session: match.item.session,
        score: match.score,
        timeMs: sortMode === "created" ? match.item.createdMs : match.item.updatedMs,
      }))
      .sort((a, b) => {
        // Primary: score descending
        if (b.score !== a.score) return b.score - a.score
        // Secondary: time descending
        if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs
        // Tertiary: sessionId for stability
        return a.session.sessionId.localeCompare(b.session.sessionId)
      })
      .map((m) => m.session)

    // Cap results for very broad queries
    const MAX_RESULTS = 200
    if (matched.length > MAX_RESULTS) {
      return matched.slice(0, MAX_RESULTS)
    }
    return matched
  }, [records, sortMode, searchQuery, searcher])
  const currentSession = visibleRecords[cursor]

  const refreshRecords = useCallback(
    async (silent = false) => {
      setLoading(true)
      setError(null)
      try {
        const data = await loadSessionRecords({ root, projectId: projectFilter || undefined })
        setRecords(data)
        if (!silent) {
          onNotify(`Loaded ${data.length} session(s).`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        onNotify(`Failed to load sessions: ${message}`, "error")
      } finally {
        setLoading(false)
      }
    },
    [root, projectFilter, onNotify],
  )

  useEffect(() => {
    void refreshRecords(true)
  }, [refreshRecords])

  useEffect(() => {
    setSelectedIndexes((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const validIndexes = new Set(records.map((record) => record.index))
      let changed = false
      const next = new Set<number>()
      for (const index of prev) {
        if (validIndexes.has(index)) {
          next.add(index)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [records])

  useEffect(() => {
    setCursor((prev) => {
      if (visibleRecords.length === 0) {
        return 0
      }
      return Math.min(prev, visibleRecords.length - 1)
    })
  }, [visibleRecords.length])

  // Compute token summary for current session
  useEffect(() => {
    setCurrentTokenSummary(null)
    if (!currentSession) {
      return
    }
    let cancelled = false
    computeSessionTokenSummary(currentSession, root).then((summary) => {
      if (!cancelled) {
        setCurrentTokenSummary(summary)
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentSession, root])

  // Compute filtered token summary (deferred to avoid UI freeze)
  useEffect(() => {
    setFilteredTokenSummary(null)
    if (records.length === 0) {
      return
    }

    let cancelled = false

    // Compute filtered (project-only) if filter is active.
    if (projectFilter) {
      computeProjectTokenSummary(projectFilter, records, root).then((summary) => {
        if (!cancelled) {
          setFilteredTokenSummary(summary)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [records, projectFilter, root])

  const toggleSelection = useCallback((session: SessionRecord | undefined) => {
    if (!session) {
      return
    }
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(session.index)) {
        next.delete(session.index)
      } else {
        next.add(session.index)
      }
      return next
    })
  }, [])

  const selectedSessions = useMemo(() => {
    if (selectedIndexes.size === 0) {
      return currentSession ? [currentSession] : []
    }
    return records.filter((record) => selectedIndexes.has(record.index))
  }, [records, selectedIndexes, currentSession])

  const selectOptions: SelectOption[] = useMemo(() => {
    return visibleRecords.map((session, idx) => {
      const selected = selectedIndexes.has(session.index)
      const prefix = selected ? "[*]" : "[ ]"
      const primary = session.title && session.title.trim().length > 0 ? session.title : session.sessionId
      const label = `${prefix} #${idx + 1} ${primary} (${session.version || "unknown"})`
      const stampBase = sortMode === "created" ? (session.createdAt ?? session.updatedAt) : (session.updatedAt ?? session.createdAt)
      const stamp = stampBase ? `${sortMode}: ${formatDate(stampBase)}` : `${sortMode}: ?`
      return {
        name: label,
        description: stamp,
        value: session.index,
      }
    })
  }, [visibleRecords, selectedIndexes, sortMode])

  const requestDeletion = useCallback(() => {
    if (selectedSessions.length === 0) {
      onNotify("No sessions selected for deletion.", "error")
      return
    }
    requestConfirm({
      title: `Delete ${selectedSessions.length} session entr${selectedSessions.length === 1 ? "y" : "ies"}?`,
      details: selectedSessions
        .slice(0, MAX_CONFIRM_PREVIEW)
        .map((session) => describeSession(session, { fullPath: true })),
      onConfirm: async () => {
        const { removed, failed } = await deleteSessionMetadata(selectedSessions)
        setSelectedIndexes(new Set())
        const msg = failed.length
          ? `Removed ${removed.length} session file(s). Failed: ${failed.length}`
          : `Removed ${removed.length} session file(s).`
        onNotify(msg, failed.length ? "error" : "info")
        await refreshRecords(true)
      },
    })
  }, [selectedSessions, onNotify, requestConfirm, refreshRecords])

  const executeRename = useCallback(async () => {
    if (!currentSession || !renameValue.trim()) {
      onNotify('Title cannot be empty', 'error')
      setIsRenaming(false)
      return
    }
    if (renameValue.length > 200) {
      onNotify('Title too long (max 200 characters)', 'error')
      return
    }
    try {
      await updateSessionTitle(currentSession.filePath, renameValue.trim())
      onNotify(`Renamed to "${renameValue.trim()}"`)
      setIsRenaming(false)
      setRenameValue('')
      await refreshRecords(true)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      onNotify(`Rename failed: ${msg}`, 'error')
    }
  }, [currentSession, renameValue, onNotify, refreshRecords])

  const executeTransfer = useCallback(async (
    targetProject: ProjectRecord,
    mode: 'move' | 'copy'
  ) => {
    setIsSelectingProject(false)
    setOperationMode(null)

    const operationFn = mode === 'move' ? moveSessions : copySessions
    const result = await operationFn(selectedSessions, targetProject.projectId, root)

    setSelectedIndexes(new Set())

    const successCount = result.succeeded.length
    const failCount = result.failed.length
    const verb = mode === 'move' ? 'moved' : 'copied'

    if (failCount === 0) {
      onNotify(`Successfully ${verb} ${successCount} session(s) to ${targetProject.projectId}`)
    } else {
      onNotify(
        `${verb} ${successCount} session(s), ${failCount} failed`,
        'error'
      )
    }

    await refreshRecords(true)
  }, [selectedSessions, root, onNotify, refreshRecords])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      if (!active || locked) {
        return
      }

      // Handle project selection mode
      if (isSelectingProject) {
        if (key.name === 'escape') {
          setIsSelectingProject(false)
          setOperationMode(null)
          return
        }
        if (key.name === 'return' || key.name === 'enter') {
          const targetProject = availableProjects[projectCursor]
          if (targetProject && operationMode) {
            void executeTransfer(targetProject, operationMode)
          }
          return
        }
        // Let select component handle up/down via onCursorChange
        return
      }

      // Handle rename mode - takes precedence over other key handling
      if (isRenaming) {
        if (key.name === 'escape') {
          setIsRenaming(false)
          setRenameValue('')
          return
        }
        if (key.name === 'return' || key.name === 'enter') {
          void executeRename()
          return
        }
        if (key.name === 'backspace') {
          setRenameValue(prev => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setRenameValue(prev => prev + ch)
          return
        }
        return
      }

      const letter = key.sequence?.toLowerCase()
      if (key.name === "space") {
        key.preventDefault()
        toggleSelection(currentSession)
        return
      }
      if (letter === "s") {
        setSortMode((prev) => (prev === "updated" ? "created" : "updated"))
        return
      }
      if (letter === "c" && projectFilter) {
        onClearFilter()
        return
      }
      if (key.name === "escape") {
        setSelectedIndexes(new Set())
        return
      }
      if (letter === "d") {
        requestDeletion()
        return
      }
      if (letter === "y") {
        if (currentSession) {
          copyToClipboard(currentSession.sessionId)
          onNotify(`Copied ID ${currentSession.sessionId} to clipboard`)
        }
        return
      }
      // Rename with Shift+R (uppercase R)
      if (key.sequence === 'R') {
        if (currentSession) {
          setIsRenaming(true)
          setRenameValue(currentSession.title || '')
        }
        return
      }
      // Move with M key
      if (letter === 'm') {
        if (selectedSessions.length === 0) {
          onNotify('No sessions selected for move', 'error')
          return
        }
        // Load projects for selection
        loadProjectRecords({ root }).then(projects => {
          // Filter out current project if filtering by project
          const filtered = projectFilter
            ? projects.filter(p => p.projectId !== projectFilter)
            : projects
          setAvailableProjects(filtered)
          setProjectCursor(0)
          setOperationMode('move')
          setIsSelectingProject(true)
        }).catch(err => {
          onNotify(`Failed to load projects: ${err.message}`, 'error')
        })
        return
      }
      // Copy with P key
      if (letter === 'p') {
        if (selectedSessions.length === 0) {
          onNotify('No sessions selected for copy', 'error')
          return
        }
        loadProjectRecords({ root }).then(projects => {
          setAvailableProjects(projects)
          setProjectCursor(0)
          setOperationMode('copy')
          setIsSelectingProject(true)
        }).catch(err => {
          onNotify(`Failed to load projects: ${err.message}`, 'error')
        })
        return
      }
      // View chat history with V key
      if (letter === 'v') {
        if (currentSession) {
          onOpenChatViewer(currentSession)
        }
        return
      }
      if (key.name === "return" || key.name === "enter") {
        if (currentSession) {
          const title = currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : currentSession.sessionId
          onNotify(`Session ${title} [${currentSession.sessionId}] → ${formatDisplayPath(currentSession.directory)}`)
        }
        return
      }
    },
    [active, locked, currentSession, projectFilter, onClearFilter, onNotify, requestDeletion, toggleSelection, isRenaming, executeRename, isSelectingProject, availableProjects, projectCursor, operationMode, executeTransfer, selectedSessions, root, onOpenChatViewer],
  )

  useImperativeHandle(
    ref,
    () => ({
      handleKey,
      refresh: () => {
        void refreshRecords(true)
      },
    }),
    [handleKey, refreshRecords],
  )

  return (
    <box
      title="Sessions"
      style={{
        border: true,
        borderColor: active ? "#22c55e" : "#374151",
        flexDirection: "column",
        flexGrow: active ? 6 : 4,
        padding: 1,
      }}
    >
      <box flexDirection="column" marginBottom={1}>
        <text>Filter: {projectFilter ? `project ${projectFilter}` : "none"} | Sort: {sortMode} | Search: {searchQuery ? `${searchQuery} (fuzzy)` : "(none)"} | Selected: {selectedIndexes.size}</text>
        <text>Keys: Space select, S sort, D delete, Y copy ID, V view chat, F search chats, Shift+R rename, M move, P copy, C clear</text>
      </box>

      {isRenaming ? (
        <box style={{ border: true, borderColor: PALETTE.key, padding: 1, marginBottom: 1 }}>
          <text>Rename: </text>
          <text fg={PALETTE.key}>{renameValue}</text>
          <text fg={PALETTE.muted}> (Enter confirm, Esc cancel)</text>
        </box>
      ) : null}

      {isSelectingProject && operationMode ? (
        <ProjectSelector
          projects={availableProjects}
          cursor={projectCursor}
          onCursorChange={setProjectCursor}
          onSelect={(project) => executeTransfer(project, operationMode)}
          onCancel={() => {
            setIsSelectingProject(false)
            setOperationMode(null)
          }}
          operationMode={operationMode}
          sessionCount={selectedSessions.length}
        />
      ) : null}

      {error ? (
        <text fg="red">{error}</text>
      ) : loading ? (
        <text>Loading sessions...</text>
      ) : visibleRecords.length === 0 ? (
        <text>No sessions found.</text>
      ) : (
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <select
            style={{ flexGrow: 1 }}
            options={selectOptions}
            selectedIndex={Math.min(cursor, selectOptions.length - 1)}
            onChange={(index) => setCursor(index)}
            onSelect={(index) => {
              const session = visibleRecords[index]
              if (session) {
                const title = session.title && session.title.trim().length > 0 ? session.title : session.sessionId
                onNotify(`Session ${title} [${session.sessionId}] → ${formatDisplayPath(session.directory)}`)
              }
            }}
            focused={active && !locked && !isSelectingProject && !isRenaming}
            showScrollIndicator
            showDescription={false}
            wrapSelection={false}
          />
          {currentSession ? (
            <box title="Details" style={{ border: true, marginTop: 1, padding: 1 }}>
              <text>
                Session: {currentSession.sessionId}  Version: {currentSession.version || "unknown"}
              </text>
              <text>Title: {currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : "(no title)"}</text>
              <text>Project: {currentSession.projectId}</text>
              <text>Updated: {formatDate(currentSession.updatedAt || currentSession.createdAt)}</text>
              <text>Directory:</text>
              <text>{formatDisplayPath(currentSession.directory, { fullPath: true })}</text>
              <box style={{ marginTop: 1 }}>
                <text fg={PALETTE.accent}>Tokens: </text>
                {currentTokenSummary?.kind === 'known' ? (
                  <>
                    <text>In: {formatTokenCount(currentTokenSummary.tokens.input)} </text>
                    <text>Out: {formatTokenCount(currentTokenSummary.tokens.output)} </text>
                    <text>Reason: {formatTokenCount(currentTokenSummary.tokens.reasoning)} </text>
                    <text>Cache R: {formatTokenCount(currentTokenSummary.tokens.cacheRead)} </text>
                    <text>Cache W: {formatTokenCount(currentTokenSummary.tokens.cacheWrite)} </text>
                    <text fg={PALETTE.success}>Total: {formatTokenCount(currentTokenSummary.tokens.total)}</text>
                  </>
                ) : (
                  <text fg={PALETTE.muted}>{currentTokenSummary ? '?' : 'loading...'}</text>
                )}
              </box>
              {projectFilter && filteredTokenSummary ? (
                <box style={{ marginTop: 1 }}>
                  <text fg={PALETTE.info}>Filtered ({projectFilter}): </text>
                  <text>{formatAggregateSummaryShort(filteredTokenSummary)}</text>
                </box>
              ) : null}
              {globalTokenSummary ? (
                <box>
                  <text fg={PALETTE.primary}>Global: </text>
                  <text>{formatAggregateSummaryShort(globalTokenSummary)}</text>
                </box>
              ) : null}
              <text fg={PALETTE.muted} style={{ marginTop: 1 }}>Press Y to copy ID</text>
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})

const StatusBar = ({ status, level }: { status: string; level: NotificationLevel }) => (
  <box
    style={{
      border: true,
      borderColor: level === "error" ? "#ef4444" : "#3b82f6",
      paddingLeft: 1,
      paddingRight: 1,
      height: 3,
      marginTop: 1,
    }}
  >
    <text fg={level === "error" ? "#ef4444" : "#38bdf8"}>{status}</text>
  </box>
)

const ConfirmBar = ({ state, busy }: { state: ConfirmState; busy: boolean }) => (
  <box
    style={{
      border: true,
      borderColor: "#f97316",
      flexDirection: "column",
      marginTop: 1,
      padding: 1,
    }}
  >
    <text fg="#f97316">{state.title}</text>
    {state.details?.map((detail, idx) => (
      <text key={idx}>{detail}</text>
    ))}
    <text>
      {busy ? "Working..." : "Press Y/Enter to confirm, N/Esc to cancel"}
    </text>
  </box>
)

const HelpScreen = ({ onDismiss }: { onDismiss: () => void }) => {
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 2, border: true }}>
      <text fg={PALETTE.primary}>OpenCode Metadata Manager — Help</text>
      <text fg={PALETTE.muted}>Quick reference for keys and actions</text>
      <Columns>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          <Section title="Global">
            <Bullet>
              <KeyChip k="Tab" /> <text> / </text> <KeyChip k="1" /> <text> / </text> <KeyChip k="2" />
              <text> — Switch tabs</text>
            </Bullet>
            <Bullet>
              <KeyChip k="R" /> <text> — Reload active view</text>
            </Bullet>
            <Bullet>
              <text>Search current tab: </text>
              <KeyChip k="/" /> <text> — start, </text> <KeyChip k="X" /> <text> — clear</text>
            </Bullet>
            <Bullet>
              <KeyChip k="?" /> <text> / </text> <KeyChip k="H" /> <text> — Toggle help</text>
            </Bullet>
            <Bullet>
              <text>Quit: </text>
              <KeyChip k="Q" />
            </Bullet>
          </Section>

          <Section title="Projects">
            <Bullet>
              <text>Move: </text>
              <KeyChip k="Up" /> <text> / </text> <KeyChip k="Down" />
            </Bullet>
            <Bullet>
              <text>Select: </text>
              <KeyChip k="Space" /> <text> — Toggle highlighted</text>
            </Bullet>
            <Bullet>
              <text>Select all: </text>
              <KeyChip k="A" />
            </Bullet>
            <Bullet>
              <text>Filter: </text>
              <KeyChip k="M" /> <text> — Missing-only</text>
            </Bullet>
            <Bullet>
              <text fg={PALETTE.danger}>Delete: </text>
              <KeyChip k="D" />
              <text> — With confirmation</text>
            </Bullet>
            <Bullet>
              <text>Open sessions: </text>
              <KeyChip k="Enter" />
            </Bullet>
            <Bullet>
              <text>Clear selection: </text>
              <KeyChip k="Esc" />
            </Bullet>
          </Section>
        </box>

        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          <Section title="Sessions">
            <Bullet>
              <text>Move: </text>
              <KeyChip k="Up" /> <text> / </text> <KeyChip k="Down" />
            </Bullet>
            <Bullet>
              <text>Select: </text>
              <KeyChip k="Space" /> <text> — Toggle highlighted</text>
            </Bullet>
            <Bullet>
              <text>Toggle sort (updated/created): </text>
              <KeyChip k="S" />
            </Bullet>
            <Bullet>
              <text>Clear project filter: </text>
              <KeyChip k="C" />
            </Bullet>
            <Bullet>
              <text fg={PALETTE.danger}>Delete: </text>
              <KeyChip k="D" />
              <text> — With confirmation</text>
            </Bullet>
            <Bullet>
              <text>Copy ID: </text>
              <KeyChip k="Y" />
            </Bullet>
            <Bullet>
              <text fg={PALETTE.primary}>View chat: </text>
              <KeyChip k="V" />
              <text> — Open chat history</text>
            </Bullet>
            <Bullet>
              <text fg={PALETTE.info}>Search chats: </text>
              <KeyChip k="F" />
              <text> — Search all chat content</text>
            </Bullet>
            <Bullet>
              <text>Rename: </text>
              <KeyChip k="Shift+R" />
            </Bullet>
            <Bullet>
              <text>Move to project: </text>
              <KeyChip k="M" />
            </Bullet>
            <Bullet>
              <text>Copy to project: </text>
              <KeyChip k="P" />
            </Bullet>
            <Bullet>
              <text>Show details: </text>
              <KeyChip k="Enter" />
            </Bullet>
            <Bullet>
              <text>Clear selection: </text>
              <KeyChip k="Esc" />
            </Bullet>
          </Section>

          <Section title="Tips">
            <Bullet>
              <text>Use </text> <KeyChip k="M" /> <text> to quickly isolate missing projects.</text>
            </Bullet>
            <Bullet>
              <text>Press </text> <KeyChip k="R" /> <text> to refresh after cleanup.</text>
            </Bullet>
            <Bullet>
              <text>Dismiss help with </text> <KeyChip k="Enter" /> <text> or </text> <KeyChip k="Esc" />
            </Bullet>
          </Section>
        </box>
      </Columns>
      <text fg={PALETTE.info}>Press Enter or Esc to dismiss this screen.</text>
    </box>
  )
}

type ChatViewerProps = {
  session: SessionRecord
  messages: ChatMessage[]
  cursor: number
  onCursorChange: (index: number) => void
  loading: boolean
  error: string | null
  onClose: () => void
  onHydrateMessage: (message: ChatMessage) => void
  onCopyMessage: (message: ChatMessage) => void
}

const ChatViewer = ({
  session,
  messages,
  cursor,
  onCursorChange,
  loading,
  error,
  onClose,
  onHydrateMessage,
  onCopyMessage,
}: ChatViewerProps) => {
  const currentMessage = messages[cursor]

  // Trigger hydration for current message if parts not loaded
  useEffect(() => {
    if (currentMessage && currentMessage.parts === null) {
      onHydrateMessage(currentMessage)
    }
  }, [currentMessage, onHydrateMessage])

  const messageOptions: SelectOption[] = useMemo(() => {
    return messages.map((msg, idx) => {
      const roleLabel = msg.role === "user" ? "[user]" : msg.role === "assistant" ? "[asst]" : "[???]"
      const timestamp = msg.createdAt
        ? msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "??:??"
      const preview = msg.previewText.slice(0, 60) + (msg.previewText.length > 60 ? "..." : "")
      return {
        name: `${roleLabel} ${timestamp} - ${preview}`,
        description: "",
        value: idx,
      }
    })
  }, [messages])

  // Render parts for the current message
  const renderMessageContent = () => {
    if (!currentMessage) {
      return <text fg={PALETTE.muted}>No message selected</text>
    }

    if (currentMessage.parts === null) {
      return <text fg={PALETTE.muted}>Loading message content...</text>
    }

    if (currentMessage.parts.length === 0) {
      return <text fg={PALETTE.muted}>[no content]</text>
    }

    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        {currentMessage.parts.map((part, idx) => (
          <box key={part.partId} style={{ flexDirection: "column" }}>
            {part.type === "tool" ? (
              <text fg={PALETTE.accent}>
                [tool: {part.toolName ?? "unknown"}] {part.toolStatus ?? ""}
              </text>
            ) : part.type === "subtask" ? (
              <text fg={PALETTE.info}>[subtask]</text>
            ) : null}
            <text>{part.text.slice(0, 2000)}{part.text.length > 2000 ? "\n[... truncated]" : ""}</text>
          </box>
        ))}
        {currentMessage.totalChars !== null && currentMessage.totalChars > 2000 ? (
          <text fg={PALETTE.muted}>
            Showing first 2000 chars of {currentMessage.totalChars} total
          </text>
        ) : null}
      </box>
    )
  }

  const title = session.title && session.title.trim() ? session.title : session.sessionId

  return (
    <box
      title={`Chat: ${title} (READ-ONLY)`}
      style={{
        position: 'absolute',
        top: 2,
        left: 2,
        right: 2,
        bottom: 2,
        border: true,
        borderColor: PALETTE.primary,
        flexDirection: 'column',
        padding: 1,
        zIndex: 200,
      }}
      backgroundColor="#1a1a2e"
    >
      {/* Header */}
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text fg={PALETTE.accent}>Session: </text>
        <text>{session.sessionId}</text>
        <text fg={PALETTE.muted}> | </text>
        <text fg={PALETTE.accent}>Project: </text>
        <text>{session.projectId}</text>
        <text fg={PALETTE.muted}> | </text>
        <text fg={PALETTE.accent}>Messages: </text>
        <text>{messages.length}</text>
        {loading ? <text fg={PALETTE.key}> (loading...)</text> : null}
      </box>

      {error ? (
        <text fg={PALETTE.danger}>Error: {error}</text>
      ) : messages.length === 0 && !loading ? (
        <text fg={PALETTE.muted}>No messages found in this session.</text>
      ) : (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          {/* Left pane: message list */}
          <box
            style={{
              border: true,
              borderColor: PALETTE.muted,
              flexGrow: 4,
              flexDirection: "column",
              padding: 1,
            }}
            title="Messages"
          >
            <select
              options={messageOptions}
              selectedIndex={cursor}
              onChange={onCursorChange}
              focused={true}
              showScrollIndicator
              wrapSelection={false}
            />
          </box>

          {/* Right pane: message detail */}
          <box
            style={{
              border: true,
              borderColor: currentMessage?.role === "user" ? PALETTE.accent : PALETTE.primary,
              flexGrow: 6,
              flexDirection: "column",
              padding: 1,
              overflow: "hidden",
            }}
            title={currentMessage ? `${currentMessage.role} message` : "Details"}
          >
            {currentMessage ? (
              <box style={{ flexDirection: "column" }}>
                <box style={{ flexDirection: "row", marginBottom: 1 }}>
                  <text fg={PALETTE.accent}>Role: </text>
                  <text fg={currentMessage.role === "user" ? PALETTE.accent : PALETTE.primary}>
                    {currentMessage.role}
                  </text>
                  <text fg={PALETTE.muted}> | </text>
                  <text fg={PALETTE.accent}>Time: </text>
                  <text>{formatDate(currentMessage.createdAt)}</text>
                </box>
                {currentMessage.tokens ? (
                  <box style={{ flexDirection: "row", marginBottom: 1 }}>
                    <text fg={PALETTE.info}>Tokens: </text>
                    <text>
                      In: {formatTokenCount(currentMessage.tokens.input)} |
                      Out: {formatTokenCount(currentMessage.tokens.output)} |
                      Total: {formatTokenCount(currentMessage.tokens.total)}
                    </text>
                  </box>
                ) : null}
                <box style={{ flexGrow: 1, overflow: "hidden" }}>
                  {renderMessageContent()}
                </box>
              </box>
            ) : (
              <text fg={PALETTE.muted}>Select a message to view details</text>
            )}
          </box>
        </box>
      )}

      {/* Footer */}
      <box style={{ marginTop: 1 }}>
        <text fg={PALETTE.muted}>
          Esc close | Up/Down navigate | PgUp/PgDn jump | Y copy message
        </text>
      </box>
    </box>
  )
}

export const App = ({ root }: { root: string }) => {
  const renderer = useRenderer()
  const projectsRef = useRef<PanelHandle>(null)
  const sessionsRef = useRef<PanelHandle>(null)

  const [activeTab, setActiveTab] = useState<TabKey>("projects")
  const [sessionFilter, setSessionFilter] = useState<string | null>(null)
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [status, setStatus] = useState("Ready")
  const [statusLevel, setStatusLevel] = useState<NotificationLevel>("info")
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [showHelp, setShowHelp] = useState(true)
  const [confirmBusy, setConfirmBusy] = useState(false)
  // Global token state
  const [globalTokens, setGlobalTokens] = useState<AggregateTokenSummary | null>(null)
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0)

  // Chat viewer state
  const [chatViewerOpen, setChatViewerOpen] = useState(false)
  const [chatSession, setChatSession] = useState<SessionRecord | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatCursor, setChatCursor] = useState(0)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatPartsCache, setChatPartsCache] = useState<Map<string, ChatMessage>>(new Map())

  // Chat search overlay state
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState("")
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([])
  const [chatSearchCursor, setChatSearchCursor] = useState(0)
  const [chatSearching, setChatSearching] = useState(false)
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([])

  // Load global tokens
  useEffect(() => {
    let cancelled = false
    loadSessionRecords({ root }).then((sessions) => {
      if (cancelled) return
      return computeGlobalTokenSummary(sessions, root)
    }).then((summary) => {
      if (!cancelled && summary) {
        setGlobalTokens(summary)
      }
    })
    return () => { cancelled = true }
  }, [root, tokenRefreshKey])

  // Load all sessions for chat search
  useEffect(() => {
    let cancelled = false
    loadSessionRecords({ root }).then((sessions) => {
      if (!cancelled) {
        setAllSessions(sessions)
      }
    })
    return () => { cancelled = true }
  }, [root, tokenRefreshKey])

  const notify = useCallback((message: string, level: NotificationLevel = "info") => {
    setStatus(message)
    setStatusLevel(level)
  }, [])

  const requestConfirm = useCallback((state: ConfirmState) => {
    setConfirmState(state)
    setConfirmBusy(false)
  }, [])

  const cancelConfirm = useCallback(() => {
    setConfirmState(null)
    setConfirmBusy(false)
  }, [])

  const executeConfirm = useCallback(async () => {
    if (!confirmState || confirmBusy) {
      return
    }
    try {
      setConfirmBusy(true)
      await confirmState.onConfirm()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notify(`Action failed: ${message}`, "error")
    } finally {
      setConfirmBusy(false)
      setConfirmState(null)
    }
  }, [confirmState, confirmBusy, notify])

  const switchTab = useCallback((direction: "next" | "prev" | TabKey) => {
    setActiveTab((prev) => {
      if (direction === "next" || direction === "prev") {
        return prev === "projects" ? "sessions" : "projects"
      }
      return direction
    })
  }, [])

  // Chat viewer controls
  const openChatViewer = useCallback(async (session: SessionRecord) => {
    setChatViewerOpen(true)
    setChatSession(session)
    setChatMessages([])
    setChatCursor(0)
    setChatLoading(true)
    setChatError(null)
    setChatPartsCache(new Map())

    try {
      const messages = await loadSessionChatIndex(session.sessionId, root)
      setChatMessages(messages)
      if (messages.length > 0) {
        setChatCursor(0)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setChatError(msg)
    } finally {
      setChatLoading(false)
    }
  }, [root])

  const closeChatViewer = useCallback(() => {
    setChatViewerOpen(false)
    setChatSession(null)
    setChatMessages([])
    setChatCursor(0)
    setChatLoading(false)
    setChatError(null)
    setChatPartsCache(new Map())
  }, [])

  const hydrateMessage = useCallback(async (message: ChatMessage) => {
    // Check cache first
    const cached = chatPartsCache.get(message.messageId)
    if (cached) {
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? cached : m
      ))
      return
    }

    try {
      const hydrated = await hydrateChatMessageParts(message, root)
      setChatPartsCache(prev => new Map(prev).set(message.messageId, hydrated))
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? hydrated : m
      ))
    } catch (err) {
      // On error, set a placeholder
      const errorMsg: ChatMessage = {
        ...message,
        parts: [],
        previewText: "[failed to load]",
        totalChars: 0,
      }
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? errorMsg : m
      ))
    }
  }, [root, chatPartsCache])

  const copyChatMessage = useCallback((message: ChatMessage) => {
    if (!message.parts || message.parts.length === 0) {
      notify("No content to copy", "error")
      return
    }
    const text = message.parts.map(p => p.text).join('\n\n')
    copyToClipboard(text)
    notify(`Copied ${text.length} chars to clipboard`)
  }, [notify])

  // Chat search controls
  const openChatSearch = useCallback(() => {
    setChatSearchOpen(true)
    setChatSearchQuery("")
    setChatSearchResults([])
    setChatSearchCursor(0)
    setChatSearching(false)
  }, [])

  const closeChatSearch = useCallback(() => {
    setChatSearchOpen(false)
    setChatSearchQuery("")
    setChatSearchResults([])
    setChatSearchCursor(0)
    setChatSearching(false)
  }, [])

  const executeChatSearch = useCallback(async () => {
    if (!chatSearchQuery.trim()) {
      setChatSearchResults([])
      return
    }

    setChatSearching(true)

    try {
      // Filter to project if filter is active
      const sessionsToSearch = sessionFilter
        ? allSessions.filter(s => s.projectId === sessionFilter)
        : allSessions

      const results = await searchSessionsChat(sessionsToSearch, chatSearchQuery, root, { maxResults: 100 })
      setChatSearchResults(results)
      setChatSearchCursor(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notify(`Search failed: ${msg}`, "error")
      setChatSearchResults([])
    } finally {
      setChatSearching(false)
    }
  }, [chatSearchQuery, sessionFilter, allSessions, root, notify])

  const handleChatSearchResult = useCallback(async (result: ChatSearchResult) => {
    // Find the session and open chat viewer at the matching message
    const session = allSessions.find(s => s.sessionId === result.sessionId)
    if (!session) {
      notify("Session not found", "error")
      return
    }

    closeChatSearch()
    await openChatViewer(session)

    // Find the message index in the chat viewer
    // Wait a bit for the chat viewer to load
    setTimeout(() => {
      setChatMessages(prev => {
        const idx = prev.findIndex(m => m.messageId === result.messageId)
        if (idx !== -1) {
          setChatCursor(idx)
        }
        return prev
      })
    }, 100)
  }, [allSessions, closeChatSearch, openChatViewer, notify])

  const handleGlobalKey = useCallback(
    (key: KeyEvent) => {
      // Search input mode takes precedence
      if (searchActive) {
        if (key.name === "escape") {
          setSearchActive(false)
          setSearchQuery("")
          return
        }
        if (key.name === "return" || key.name === "enter") {
          setSearchActive(false)
          return
        }
        if (key.name === "backspace") {
          setSearchQuery((prev) => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + ch)
          return
        }
        return
      }
      if (confirmState) {
        const letter = key.sequence?.toLowerCase()
        if (key.name === "escape" || letter === "n") {
          cancelConfirm()
          return
        }
        if (key.name === "return" || key.name === "enter" || letter === "y") {
          void executeConfirm()
          return
        }
        return
      }

      // Chat viewer takes precedence when open
      if (chatViewerOpen) {
        const letter = key.sequence?.toLowerCase()
        if (key.name === "escape") {
          closeChatViewer()
          return
        }
        if (key.name === "up") {
          setChatCursor(prev => Math.max(0, prev - 1))
          return
        }
        if (key.name === "down") {
          setChatCursor(prev => Math.min(chatMessages.length - 1, prev + 1))
          return
        }
        if (key.name === "pageup" || (key.ctrl && letter === "u")) {
          setChatCursor(prev => Math.max(0, prev - 10))
          return
        }
        if (key.name === "pagedown" || (key.ctrl && letter === "d")) {
          setChatCursor(prev => Math.min(chatMessages.length - 1, prev + 10))
          return
        }
        if (key.name === "home") {
          setChatCursor(0)
          return
        }
        if (key.name === "end") {
          setChatCursor(chatMessages.length - 1)
          return
        }
        if (letter === "y") {
          const msg = chatMessages[chatCursor]
          if (msg) {
            copyChatMessage(msg)
          }
          return
        }
        // Block other keys while viewer is open
        return
      }

      // Chat search overlay takes precedence when open
      if (chatSearchOpen) {
        const letter = key.sequence?.toLowerCase()
        if (key.name === "escape") {
          closeChatSearch()
          return
        }
        if (key.name === "return" || key.name === "enter") {
          if (chatSearchResults.length > 0) {
            // Select current result
            const result = chatSearchResults[chatSearchCursor]
            if (result) {
              void handleChatSearchResult(result)
            }
          } else {
            // Execute search
            void executeChatSearch()
          }
          return
        }
        if (key.name === "backspace") {
          setChatSearchQuery(prev => prev.slice(0, -1))
          return
        }
        if (key.name === "up") {
          setChatSearchCursor(prev => Math.max(0, prev - 1))
          return
        }
        if (key.name === "down") {
          setChatSearchCursor(prev => Math.min(chatSearchResults.length - 1, prev + 1))
          return
        }
        // Type characters
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setChatSearchQuery(prev => prev + ch)
          return
        }
        return
      }

      if (showHelp) {
        const letter = key.sequence?.toLowerCase()
        if (key.name === "escape" || key.name === "return" || key.name === "enter" || letter === "?" || letter === "h") {
          setShowHelp(false)
          return
        }
        return
      }

      const letter = key.sequence?.toLowerCase()

      if (letter === "q" || (key.ctrl && key.name === "c")) {
        renderer.destroy()
        return
      }

      if (letter === "?" || letter === "h") {
        setShowHelp((v) => !v)
        return
      }

      if (letter === "/") {
        setSearchActive(true)
        setSearchQuery("")
        return
      }
      if (letter === "x" && searchQuery) {
        setSearchQuery("")
        return
      }

      if (key.name === "tab") {
        switchTab("next")
        return
      }

      if (letter === "1") {
        switchTab("projects")
        return
      }
      if (letter === "2") {
        switchTab("sessions")
        return
      }

      if (letter === "r") {
        // Clear token cache on reload
        clearTokenCache()
        setTokenRefreshKey((k) => k + 1)
        if (activeTab === "projects") {
          projectsRef.current?.refresh()
        } else {
          sessionsRef.current?.refresh()
        }
        notify("Reload requested...")
        return
      }

      // Open chat search with F key (Sessions tab only)
      if (letter === "f" && activeTab === "sessions") {
        openChatSearch()
        return
      }

      const handler = activeTab === "projects" ? projectsRef.current : sessionsRef.current
      handler?.handleKey(key)
    },
    [activeTab, cancelConfirm, confirmState, executeConfirm, notify, renderer, searchActive, searchQuery, showHelp, switchTab, chatViewerOpen, chatMessages, chatCursor, closeChatViewer, copyChatMessage, chatSearchOpen, chatSearchResults, chatSearchCursor, closeChatSearch, executeChatSearch, handleChatSearchResult, openChatSearch],
  )

  useKeyboard(handleGlobalKey)

  const handleNavigateToSessions = useCallback(
    (projectId: string) => {
      setSessionFilter(projectId)
      setActiveTab("sessions")
      notify(`Filtering sessions by ${projectId}`)
    },
    [notify],
  )

  const clearSessionFilter = useCallback(() => {
    setSessionFilter(null)
    notify("Cleared session filter")
  }, [notify])

  return (
    <box style={{ flexDirection: "column", padding: 1, flexGrow: 1 }}>
      <box flexDirection="column" marginBottom={1}>
        <box style={{ flexDirection: "row", gap: 2 }}>
          <text fg="#a5b4fc">OpenCode Metadata Manager</text>
          <text fg={PALETTE.muted}>|</text>
          <text fg={PALETTE.accent}>Global Tokens: </text>
          {globalTokens?.total.kind === 'known' ? (
            <>
              <text fg={PALETTE.success}>{formatTokenCount(globalTokens.total.tokens.total)}</text>
              {globalTokens.unknownSessions && globalTokens.unknownSessions > 0 ? (
                <text fg={PALETTE.muted}> (+{globalTokens.unknownSessions} unknown)</text>
              ) : null}
            </>
          ) : (
            <text fg={PALETTE.muted}>{globalTokens ? '?' : 'loading...'}</text>
          )}
        </box>
        <text>Root: {root}</text>
        <text>
          Tabs: [1] Projects [2] Sessions | Active: {activeTab} | Global: Tab switch, / search, X clear, R reload, Q quit, ? help
        </text>
        {sessionFilter ? <text fg="#a3e635">Session filter: {sessionFilter}</text> : null}
      </box>

      {showHelp
        ? null
        : searchActive || searchQuery
        ? <SearchBar active={searchActive} context={activeTab} query={searchQuery} />
        : null}

      {showHelp ? (
        <HelpScreen onDismiss={() => setShowHelp(false)} />
      ) : (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          <ProjectsPanel
            ref={projectsRef}
            root={root}
            active={activeTab === "projects"}
            locked={Boolean(confirmState) || showHelp}
            searchQuery={activeTab === "projects" ? searchQuery : ""}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onNavigateToSessions={handleNavigateToSessions}
          />
          <SessionsPanel
            ref={sessionsRef}
            root={root}
            active={activeTab === "sessions"}
            locked={Boolean(confirmState) || showHelp || chatViewerOpen || chatSearchOpen}
            projectFilter={sessionFilter}
            searchQuery={activeTab === "sessions" ? searchQuery : ""}
            globalTokenSummary={globalTokens}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onClearFilter={clearSessionFilter}
            onOpenChatViewer={openChatViewer}
          />
        </box>
      )}

      {/* Chat Viewer Overlay */}
      {chatViewerOpen && chatSession ? (
        <ChatViewer
          session={chatSession}
          messages={chatMessages}
          cursor={chatCursor}
          onCursorChange={setChatCursor}
          loading={chatLoading}
          error={chatError}
          onClose={closeChatViewer}
          onHydrateMessage={hydrateMessage}
          onCopyMessage={copyChatMessage}
        />
      ) : null}

      {/* Chat Search Overlay */}
      {chatSearchOpen ? (
        <box
          title={`Search Chat Content ${sessionFilter ? `(project: ${sessionFilter})` : "(all sessions)"}`}
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            right: 2,
            bottom: 2,
            border: true,
            borderColor: PALETTE.info,
            flexDirection: 'column',
            padding: 1,
            zIndex: 200,
          }}
          backgroundColor="#1a1a2e"
        >
          {/* Search input */}
          <box style={{ flexDirection: "row", marginBottom: 1 }}>
            <text fg={PALETTE.accent}>Search: </text>
            <text fg={PALETTE.key}>{chatSearchQuery}</text>
            <text fg={PALETTE.muted}>_</text>
            {chatSearching ? <text fg={PALETTE.info}> (searching...)</text> : null}
          </box>

          <box style={{ marginBottom: 1 }}>
            <text fg={PALETTE.muted}>
              Searching {sessionFilter ? allSessions.filter(s => s.projectId === sessionFilter).length : allSessions.length} sessions | Found: {chatSearchResults.length} matches
            </text>
          </box>

          {chatSearchResults.length === 0 && chatSearchQuery && !chatSearching ? (
            <text fg={PALETTE.muted}>No results found. Try a different search term.</text>
          ) : chatSearchResults.length > 0 ? (
            <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
              {/* Results list */}
              <box
                style={{
                  border: true,
                  borderColor: PALETTE.muted,
                  flexGrow: 4,
                  flexDirection: "column",
                  padding: 1,
                }}
                title="Results"
              >
                <select
                  options={chatSearchResults.map((r, idx) => ({
                    name: `${r.sessionTitle.slice(0, 25)} | ${r.role === "user" ? "[user]" : "[asst]"} ${r.matchedText.slice(0, 40)}...`,
                    description: "",
                    value: idx,
                  }))}
                  selectedIndex={chatSearchCursor}
                  onChange={setChatSearchCursor}
                  focused={true}
                  showScrollIndicator
                  wrapSelection={false}
                />
              </box>

              {/* Preview pane */}
              <box
                style={{
                  border: true,
                  borderColor: chatSearchResults[chatSearchCursor]?.role === "user" ? PALETTE.accent : PALETTE.primary,
                  flexGrow: 6,
                  flexDirection: "column",
                  padding: 1,
                  overflow: "hidden",
                }}
                title={chatSearchResults[chatSearchCursor] ? `${chatSearchResults[chatSearchCursor].role} message` : "Preview"}
              >
                {chatSearchResults[chatSearchCursor] ? (
                  <box style={{ flexDirection: "column" }}>
                    <box style={{ flexDirection: "row", marginBottom: 1 }}>
                      <text fg={PALETTE.accent}>Session: </text>
                      <text>{chatSearchResults[chatSearchCursor].sessionTitle}</text>
                    </box>
                    <box style={{ flexDirection: "row", marginBottom: 1 }}>
                      <text fg={PALETTE.accent}>Time: </text>
                      <text>{formatDate(chatSearchResults[chatSearchCursor].createdAt)}</text>
                      <text fg={PALETTE.muted}> | </text>
                      <text fg={PALETTE.accent}>Type: </text>
                      <text>{chatSearchResults[chatSearchCursor].partType}</text>
                    </box>
                    <box style={{ flexGrow: 1 }}>
                      <text>{chatSearchResults[chatSearchCursor].fullText.slice(0, 1500)}{chatSearchResults[chatSearchCursor].fullText.length > 1500 ? "\n[... truncated]" : ""}</text>
                    </box>
                  </box>
                ) : (
                  <text fg={PALETTE.muted}>Select a result to preview</text>
                )}
              </box>
            </box>
          ) : (
            <text fg={PALETTE.muted}>Type a search query and press Enter to search chat content.</text>
          )}

          {/* Footer */}
          <box style={{ marginTop: 1 }}>
            <text fg={PALETTE.muted}>
              Type query, Enter to search | Esc close | Up/Down navigate | Enter on result opens chat
            </text>
          </box>
        </box>
      ) : null}

      <StatusBar status={status} level={statusLevel} />
      {confirmState ? <ConfirmBar state={confirmState} busy={confirmBusy} /> : null}
    </box>
  )
}

function parseArgs(): { root: string } {
  const args = process.argv.slice(2)
  let root = DEFAULT_ROOT

  for (let idx = 0; idx < args.length; idx += 1) {
    const token = args[idx]
    if (token === "--root" && args[idx + 1]) {
      root = resolve(args[idx + 1])
      idx += 1
      continue
    }
    if (token === "--help" || token === "-h") {
      printUsage()
      process.exit(0)
    }
  }

  return { root }
}

function printUsage(): void {
  console.log(`OpenCode Metadata TUI
Usage: bun run tui [-- --root /path/to/storage]

Key bindings:
  Tab / 1 / 2     Switch between projects and sessions
  /               Start search (active tab)
  X               Clear search
  ? / H           Toggle help
  R               Reload (and refresh token cache)
  Q               Quit the application

Projects view:
  Space           Toggle selection
  A               Select all (visible)
  M               Toggle missing-only filter
  D               Delete selected (with confirmation)
  Enter           Jump to Sessions for project
  Esc             Clear selection

Sessions view:
  Space           Toggle selection
  S               Toggle sort (updated/created)
  V               View chat history for selected session
  F               Search across all chat content in sessions
  Shift+R         Rename session
  M               Move selected sessions to project
  P               Copy selected sessions to project
  Y               Copy session ID to clipboard
  C               Clear project filter
  D               Delete selected (with confirmation)
  Enter           Show details
  Esc             Clear selection

Chat search (when open):
  Type            Enter search query
  Enter           Search / open selected result
  Up/Down         Navigate results
  Esc             Close search

Chat viewer (when open):
  Esc             Close viewer
  Up/Down         Navigate messages
  PgUp/PgDn       Jump 10 messages
  Home/End        Jump to first/last message
  Y               Copy message content to clipboard
`)
}

async function bootstrap() {
  const { root } = parseArgs()
  const renderer = await createCliRenderer()
  createRoot(renderer).render(<App root={root} />)
}

bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
