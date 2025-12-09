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
} from "./lib/opencode-data"

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
  onNotify: (message: string, level?: NotificationLevel) => void
  requestConfirm: (state: ConfirmState) => void
  onClearFilter: () => void
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
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})

const SessionsPanel = forwardRef<PanelHandle, SessionsPanelProps>(function SessionsPanel(
  { root, active, locked, projectFilter, searchQuery, onNotify, requestConfirm, onClearFilter },
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

  const visibleRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const aDate = sortMode === "created" ? (a.createdAt ?? a.updatedAt) : (a.updatedAt ?? a.createdAt)
      const bDate = sortMode === "created" ? (b.createdAt ?? b.updatedAt) : (b.updatedAt ?? b.createdAt)
      const aTime = aDate?.getTime() ?? 0
      const bTime = bDate?.getTime() ?? 0
      if (bTime !== aTime) return bTime - aTime
      return a.sessionId.localeCompare(b.sessionId)
    })
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sorted
    const tokens = q.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return sorted
    return sorted.filter((s) => {
      const title = (s.title || "").toLowerCase()
      const id = (s.sessionId || "").toLowerCase()
      const dir = (s.directory || "").toLowerCase()
      const proj = (s.projectId || "").toLowerCase()
      return tokens.every((tok) => title.includes(tok) || id.includes(tok) || dir.includes(tok) || proj.includes(tok))
    })
  }, [records, sortMode, searchQuery])
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
      if (key.name === "return" || key.name === "enter") {
        if (currentSession) {
          const title = currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : currentSession.sessionId
          onNotify(`Session ${title} [${currentSession.sessionId}] → ${formatDisplayPath(currentSession.directory)}`)
        }
        return
      }
    },
    [active, locked, currentSession, projectFilter, onClearFilter, onNotify, requestDeletion, toggleSelection, isRenaming, executeRename, isSelectingProject, availableProjects, projectCursor, operationMode, executeTransfer, selectedSessions, root],
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
        <text>Filter: {projectFilter ? `project ${projectFilter}` : "none"} | Sort: {sortMode} | Search: {searchQuery || "(none)"} | Selected: {selectedIndexes.size}</text>
        <text>Keys: Space select, S sort, D delete, Y copy ID, Shift+R rename, M move, P copy, C clear filter</text>
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

const App = ({ root }: { root: string }) => {
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
        if (activeTab === "projects") {
          projectsRef.current?.refresh()
        } else {
          sessionsRef.current?.refresh()
        }
        notify("Reload requested...")
        return
      }

      const handler = activeTab === "projects" ? projectsRef.current : sessionsRef.current
      handler?.handleKey(key)
    },
    [activeTab, cancelConfirm, confirmState, executeConfirm, notify, renderer, searchActive, searchQuery, showHelp, switchTab],
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
        <text fg="#a5b4fc">OpenCode Metadata Manager</text>
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
            locked={Boolean(confirmState) || showHelp}
            projectFilter={sessionFilter}
            searchQuery={activeTab === "sessions" ? searchQuery : ""}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onClearFilter={clearSessionFilter}
          />
        </box>
      )}

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
  Tab / 1 / 2  Switch between projects and sessions
  R             Reload the active view
  Q             Quit the application
  Projects view: Space select, A select all, M toggle missing filter, D delete, Enter jump to sessions
  Sessions view: Space select, D delete, C clear project filter, Enter show details
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
