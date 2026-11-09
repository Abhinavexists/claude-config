import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, ToolCallResult } from 'claude-code'

import type { AgentRow, AgentState, Call, CallState, Todos } from '../types'

const PANE = 'activity'
const MAX_CALLS = 200
const MAX_AGENTS = 40
const MAX_TURNS = 50
const TURN_CALLS = 60
const AGENT_LIVE_CALLS = 3
const AGENT_OPEN_CALLS = 15
const DONE_AGENTS = 5
const TAIL_LINES = 20
const STORED_LINES = 40
const STORED_CHARS = 4000
const MAX_TAIL_BYTES = 2_000_000
const LIVE_LINES = 3
const BAND_LINES = 4
const CODE_LINES = 8
const QUIET_MS = 30_000
// p90 per tool from ~/.claude/projects transcripts (4.4k calls, 2026-11-10); AskUserQuestion is excluded: it waits on the person.
const SLOW_MS: Record<string, number> = {
  Bash: 30_000,
  Agent: 30_000,
  WebFetch: 20_000,
  Edit: 10_000,
  Write: 10_000,
}
const SLOW_DEFAULT_MS = 15_000

const calls = atom({ plugin: 'activity', key: 'calls' } as const, [], {
  shape: 'calls-2',
})
const expanded = atom({ plugin: 'activity', key: 'expanded' } as const, null)
const agents = atom({ plugin: 'activity', key: 'agents' } as const, [], {
  shape: 'agents-1',
})
const folds = atom({ plugin: 'activity', key: 'folds' } as const, {}, {
  shape: 'folds-1',
})
const bandDetail = atom({ plugin: 'activity', key: 'bandDetail' } as const, false)
const turns = atom({ plugin: 'activity', key: 'turns' } as const, [], {
  shape: 'turns-1',
})
const todos = atom({ plugin: 'activity', key: 'todos' } as const, null, {
  shape: 'todos-1',
})
const tasks = atom({ plugin: 'activity', key: 'tasks' } as const, {}, {
  shape: 'tasks-1',
})

type Input = Record<string, unknown>

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
const isLive = (state: CallState) =>
  state === 'running' || state === 'waiting' || state === 'background'
const slowAfter = (tool: string) => SLOW_MS[tool] ?? SLOW_DEFAULT_MS

const shortPath = (path: string) => path.split('/').slice(-2).join('/')

function labelOf(tool: string, input: Input): string {
  switch (tool) {
    case 'Bash':
      return str(input.description) ?? str(input.command) ?? ''
    case 'Read':
    case 'Write':
    case 'Edit':
      return shortPath(str(input.file_path) ?? '')
    case 'NotebookEdit':
      return shortPath(str(input.notebook_path) ?? '')
    case 'Grep':
    case 'Glob':
      return str(input.pattern) ?? ''
    case 'Agent':
    case 'Monitor':
      return str(input.description) ?? ''
    case 'WebFetch':
      return str(input.url) ?? ''
    case 'WebSearch':
      return str(input.query) ?? ''
    case 'Skill':
      return str(input.skill) ?? ''
    case 'TaskStop':
      return str(input.task_id) ?? str(input.shell_id) ?? ''
    case 'TaskCreate':
      return str(input.subject) ?? ''
    case 'TaskUpdate':
      return `#${str(input.taskId) ?? '?'}${str(input.status) ? ` → ${str(input.status)}` : ''}`
    case 'TodoWrite':
      return Array.isArray(input.todos) ? `${input.todos.length} items` : ''
    case 'AskUserQuestion':
      return 'question for you'
  }
  return tool.startsWith('mcp__') ? tool.split('__').slice(2).join(' ') : ''
}

const FILE_TOOLS = new Set(['Read', 'Write', 'Edit', 'NotebookEdit', 'Grep', 'Glob'])

const IMPLICIT = 'implicit:'

// The main loop's live turn; one that started before this load gets a stand-in, adopted at its turn.complete.
async function currentTurnId($: EngineInterface): Promise<string> {
  const live = (await read($, turns))[0]
  if (live !== undefined && live.endedAt === undefined) return live.turnId
  const startedAt = await $.clock.now()
  const turnId = `${IMPLICIT}${startedAt}`
  await update($, turns, all =>
    all[0] !== undefined && all[0].endedAt === undefined ? all : [{ turnId, seq: (all[0]?.seq ?? 0) + 1, prompt: '(started before the pane loaded)', startedAt, calls: 0 }, ...all].slice(0, MAX_TURNS),
  )
  return (await read($, turns))[0]?.turnId ?? turnId
}

// A short coloured tag per tool family, so rows of different kinds read apart at a glance.
function tagOf(tool: string): { tag: string; color: string } {
  if (tool === 'Bash') return { tag: '$', color: 'bashBorder' }
  if (FILE_TOOLS.has(tool)) return { tag: tool, color: 'ide' }
  if (tool === 'Agent' || tool === 'Monitor') return { tag: tool, color: 'suggestion' }
  if (tool === 'WebFetch' || tool === 'WebSearch') return { tag: tool === 'WebFetch' ? 'Fetch' : 'Search', color: 'remember' }
  if (tool === 'TaskStop') return { tag: 'Stop', color: 'warning' }
  if (tool === 'TaskCreate' || tool === 'TaskUpdate' || tool === 'TodoWrite') return { tag: tool === 'TaskCreate' ? 'Task+' : tool === 'TodoWrite' ? 'Todos' : 'Task', color: 'planMode' }
  if (tool === 'Skill') return { tag: 'Skill', color: 'merged' }
  if (tool === 'AskUserQuestion') return { tag: 'Ask', color: 'permission' }
  if (tool.startsWith('mcp__')) return { tag: tool.split('__')[1] ?? 'mcp', color: 'autoAccept' }
  return { tag: tool, color: 'inactive' }
}

const RESERVED = new Set(['tool', 'tool_use_id', 'agentId', 'requestMeta', 'consent'])

function detailOf(tool: string, input: Input): string {
  if (tool === 'Bash') return str(input.command) ?? ''
  const args = Object.fromEntries(Object.entries(input).filter(([k]) => !RESERVED.has(k)))
  return JSON.stringify(args, null, 1).slice(0, 1500)
}

function tail(text: string, lines: number, chars = Infinity) {
  const all = text.replace(/\s+$/, '').split('\n')
  return { output: all.slice(-lines).join('\n').slice(-chars), outputLines: all.length }
}

function settle(call: Call, ran: ToolCallResult, endedAt: number): Call {
  if (ran.deny !== undefined) return { ...call, state: 'denied', endedAt, note: ran.deny }
  if (ran.isError) {
    const text = ran.text ?? String(ran.result ?? '')
    const exit = /Exit code (\d+)/.exec(text)?.[1]
    const isInterrupted = /interrupted/i.test(text.slice(0, 200))
    return {
      ...call,
      state: isInterrupted ? 'interrupted' : 'failed',
      endedAt,
      note: exit ? `exit ${exit}` : undefined,
      ...tail(text, STORED_LINES, STORED_CHARS),
    }
  }
  const result = (ran.result ?? {}) as Input
  const taskId =
    str(result.backgroundTaskId) ??
    (result.status === 'async_launched' ? str(result.agentId) : undefined) ??
    (call.tool === 'Monitor' ? str(result.taskId) : undefined)
  if (taskId) {
    const outputPath = /written to: (\S+?\.output)\b/.exec(ran.text ?? '')?.[1]
    const note = result.backgroundedByUser
      ? 'moved to background'
      : typeof result.timedOutAfterMs === 'number'
        ? `timed out after ${fmt(result.timedOutAfterMs)}, moved to background`
        : undefined
    return { ...call, state: 'background', taskId, outputPath, note }
  }
  if (call.tool === 'Bash') {
    const out = [str(result.stdout), str(result.stderr)].filter(Boolean).join('\n')
    return {
      ...call,
      state: result.interrupted ? 'interrupted' : 'ok',
      endedAt,
      note: str(result.returnCodeInterpretation),
      ...tail(out, STORED_LINES, STORED_CHARS),
    }
  }
  return { ...call, state: 'ok', endedAt, ...tail(ran.text ?? '', STORED_LINES, STORED_CHARS) }
}

function countTodos(list: readonly { status: string; activeForm?: string }[]): Todos {
  return {
    done: list.filter(t => t.status === 'completed').length,
    total: list.length,
    active: list.find(t => t.status === 'in_progress')?.activeForm,
  }
}

async function trackTodos($: EngineInterface, tool: string, input: Input, ran: ToolCallResult) {
  if (ran.deny !== undefined || ran.isError) return
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    await update($, todos, () => countTodos(input.todos as { status: string; activeForm: string }[]))
    return
  }
  const result = (ran.result ?? {}) as Input
  const created = str((result.task as Input | undefined)?.id)
  const id = tool === 'TaskCreate' ? created : tool === 'TaskUpdate' ? str(input.taskId) : undefined
  if (id === undefined) return
  const status = tool === 'TaskCreate' ? 'pending' : str(input.status)
  if (status === undefined) return
  const next = await update($, tasks, map => {
    const { [id]: _, ...rest } = map
    return status === 'deleted' ? rest : { ...rest, [id]: status }
  })
  await update($, todos, () => countTodos(Object.values(next).map(status => ({ status }))))
}

async function finishTasks($: EngineInterface, text: string) {
  const ended = [...text.matchAll(/<task-id>([^<]+)<\/task-id>[\s\S]*?<status>([^<]+)<\/status>(?:[\s\S]*?<summary>([^<]*)<\/summary>)?/g)]
    .map(m => ({ id: (m[1] ?? '').trim(), status: (m[2] ?? '').trim(), summary: m[3]?.trim() }))
    .filter(hit => /^(completed|failed|killed|stopped)$/.test(hit.status))
  if (ended.length === 0) return
  const endedAt = await $.clock.now()
  await update($, calls, list =>
    list.map(call => {
      const hit = ended.find(one => one.id === call.taskId)
      if (hit === undefined || call.state !== 'background') return call
      const state: CallState = hit.status === 'completed' ? 'done' : hit.status === 'failed' ? 'failed' : 'killed'
      return { ...call, state, endedAt, note: hit.summary || call.note }
    }),
  )
}

function fmt(ms: number): string {
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.floor(s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(Math.floor(s % 60)).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

const clip = (text: string, width: number) =>
  text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`

const ICON: Record<CallState, string> = {
  running: '▶',
  waiting: '?',
  ok: '✓',
  done: '✓',
  failed: '✗',
  denied: '⊘',
  interrupted: '■',
  killed: '■',
  background: '◷',
}

function colorOf(call: Call, now: number) {
  switch (call.state) {
    case 'running':
      return now - call.startedAt > slowAfter(call.tool) ? 'warning' : 'claude'
    case 'waiting':
      return 'permission'
    case 'ok':
    case 'done':
      return 'success'
    case 'failed':
    case 'denied':
      return 'error'
    case 'background':
      return 'suggestion'
    default:
      return 'inactive'
  }
}

async function fileTail($: EngineInterface, path: string) {
  const stat = await $.fs.stat(path).catch(() => undefined)
  if (stat === undefined) return { text: '(output file not found)', mtimeMs: undefined }
  if (stat.size > MAX_TAIL_BYTES) return { text: `(${Math.round(stat.size / 1e6)} MB of output; open ${path})`, mtimeMs: stat.mtimeMs }
  const text = await $.fs.read(path).catch(() => '(output file unreadable)')
  return { text: typeof text === 'string' ? text : '', mtimeMs: stat.mtimeMs }
}

const OPEN = { id: PANE, title: 'Activity', backgroundColor: 'transparent' } as const
const SIZE_STEP = { rows: 4, columns: 8 }

type PaneSize = { rows: number; columns: number }

// The size the mod asks for; a size the person keys or drags wins over it (PaneOpenArgs).
let paneSize: PaneSize = { rows: 16, columns: 60 }
let seenPlacement: 'dock' | 'inline' | undefined
let seenColumns: number | undefined
let seenRows: number | undefined

const clampSize = (size: PaneSize): PaneSize => ({
  rows: Math.max(6, Math.min(60, Math.round(size.rows))),
  columns: Math.max(24, Math.min(200, Math.round(size.columns))),
})

async function openPane($: EngineInterface) {
  return $.ui.open({ ...OPEN, rows: paneSize.rows, columns: paneSize.columns })
}

async function resizePane($: EngineInterface, size: PaneSize) {
  paneSize = clampSize(size)
  await $.store.set('paneSize', paneSize)
  // A second open of an open id only retitles it (ui.open), so the new size needs a fresh open.
  if ((await $.ui.panes()).some(p => p.id === PANE)) await $.ui.close({ id: PANE })
  return openPane($)
}

function describePane(): string {
  if (seenPlacement === 'dock')
    return `docked beside the chat, asking for ${paneSize.columns} columns (last drawn ${seenColumns ?? '?'} wide; the engine caps a dock at 45% of the terminal)`
  if (seenPlacement === 'inline') return `above the prompt, asking for ${paneSize.rows} rows (last drawn ${seenRows ?? '?'} tall; the side dock needs the fullscreen layout)`
  return `not drawn yet (asks for ${paneSize.rows} rows inline, ${paneSize.columns} columns docked)`
}

let tasksDir: string | undefined

// Claude Code streams every Bash call into <tmp>/claude-<uid>/<cwd-slug>/<session-id>/tasks/<id>.output (deleted on exit).
async function findTasksDir($: EngineInterface): Promise<string | undefined> {
  if (tasksDir !== undefined) return tasksDir
  const id = await $.session.id()
  for (const base of ['/private/tmp', '/tmp']) {
    const roots = (await $.fs.list(base).catch(() => [])).filter(e => e.kind === 'dir' && e.name.startsWith('claude-'))
    for (const root of roots) {
      for (const slug of await $.fs.list(`${base}/${root.name}`).catch(() => [])) {
        const dir = `${base}/${root.name}/${slug.name}/${id}/tasks`
        if (await $.fs.stat(dir).then(st => st.kind === 'dir').catch(() => false)) return (tasksDir = dir)
      }
    }
  }
  return undefined
}

// Best effort: pairs running Bash rows with unclaimed output files created since they started, oldest first.
async function claimOutputs($: EngineInterface) {
  const list = await read($, calls)
  const pending = list.filter(c => c.tool === 'Bash' && c.state === 'running' && c.outputPath === undefined).sort((a, b) => a.startedAt - b.startedAt)
  const first = pending[0]
  if (first === undefined) return
  const dir = await findTasksDir($)
  if (dir === undefined) return
  const claimed = new Set(list.map(c => c.outputPath))
  const fresh: { path: string; mtimeMs: number }[] = []
  for (const entry of await $.fs.list(dir).catch(() => [])) {
    const path = `${dir}/${entry.name}`
    if (entry.kind !== 'file' || !entry.name.endsWith('.output') || claimed.has(path)) continue
    const st = await $.fs.stat(path).catch(() => undefined)
    if (st !== undefined && !st.isLink && st.mtimeMs >= first.startedAt - 2000) fresh.push({ path, mtimeMs: st.mtimeMs })
  }
  fresh.sort((a, b) => a.mtimeMs - b.mtimeMs)
  const byId = new Map<string, string>()
  const newest = fresh[fresh.length - 1]
  if (pending.length === 1 && newest !== undefined) byId.set(first.id, newest.path)
  else if (pending.length === fresh.length) pending.forEach((c, i) => fresh[i] && byId.set(c.id, fresh[i].path))
  if (byId.size === 0) return
  await update($, calls, all => all.map(c => (c.state === 'running' && c.outputPath === undefined && byId.has(c.id) ? { ...c, outputPath: byId.get(c.id) } : c)))
}

const AGENT_ICON: Record<AgentState, string> = {
  pending: '…',
  running: '▶',
  waiting: '?',
  idle: '◌',
  done: '✓',
  failed: '✗',
  killed: '■',
}

const AGENT_COLOR: Record<AgentState, string> = {
  pending: 'inactive',
  running: 'claude',
  waiting: 'permission',
  idle: 'inactive',
  done: 'success',
  failed: 'error',
  killed: 'inactive',
}

const isAgentLive = (state: AgentState) => state === 'pending' || state === 'running' || state === 'waiting'

const agentState = (status: string): AgentState =>
  status === 'completed' ? 'done' : (['pending', 'running', 'waiting', 'idle', 'failed', 'killed'] as const).find(s => s === status) ?? 'running'

// Rows for agents this load did not see spawn (it started before a reload) come from the engine's own list.
async function ensureAgent($: EngineInterface, id: string) {
  if ((await read($, agents)).some(a => a.id === id)) return
  const info = (await $.agent.list().catch(() => [])).find(one => one.id === id)
  const row: AgentRow = {
    id,
    description: info?.description ?? id,
    type: info?.type ?? 'agent',
    isBackground: false,
    parentId: info?.parentId,
    startedAt: await $.clock.now(),
    status: info ? agentState(info.status) : 'running',
    calls: 0,
  }
  await update($, agents, all => (all.some(a => a.id === id) ? all : [row, ...all].slice(0, MAX_AGENTS)))
}

// The engine's list is the authority on where each agent stands (a stop or a failure raises no event here).
async function syncAgents($: EngineInterface) {
  const rows = await read($, agents)
  if (!rows.some(a => isAgentLive(a.status) || a.status === 'idle')) return
  const infos = await $.agent.list().catch(() => [])
  if (infos.length === 0) return
  const now = await $.clock.now()
  await update($, agents, all =>
    all.map(a => {
      const info = infos.find(one => one.id === a.id)
      const status = info ? agentState(info.status) : a.status
      if (status === a.status) return a
      return { ...a, status, endedAt: isAgentLive(status) || status === 'idle' ? undefined : (a.endedAt ?? now) }
    }),
  )
}

async function tick($: EngineInterface) {
  const [list, turnRows] = await Promise.all([read($, calls), read($, turns)])
  const t = turnRows[0]
  const isTurnLive = t !== undefined && t.endedAt === undefined
  if (isTurnLive || list.some(c => isLive(c.state))) $.ui.invalidate('ui.render')
  await claimOutputs($)
  await syncAgents($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'activity',
      description: 'Toggle the live activity pane; bigger, smaller or size N resizes it',
      argumentHint: '[bigger | smaller | size N | info]',
    })
    const keptDetail = await $.store.get('bandDetail').catch(() => undefined)
    if (typeof keptDetail === 'boolean') await update($, bandDetail, () => keptDetail)
    const keptSize = (await $.store.get('paneSize').catch(() => undefined)) as Partial<PaneSize> | undefined
    if (typeof keptSize?.rows === 'number' && typeof keptSize.columns === 'number') paneSize = clampSize({ rows: keptSize.rows, columns: keptSize.columns })
    void openPane($)
    $.clock.every(1000, () => void tick($).catch(() => undefined))

    return next(e)
  })

  on('command.run', { command: 'activity' }, async ($, e) => {
    const [verb = '', arg] = e.args.trim().toLowerCase().split(/\s+/)
    const step = ['bigger', 'wider', 'taller', '+'].includes(verb) ? 1 : ['smaller', 'narrower', 'shorter', '-'].includes(verb) ? -1 : 0
    if (step !== 0) {
      await resizePane($, { rows: paneSize.rows + step * SIZE_STEP.rows, columns: paneSize.columns + step * SIZE_STEP.columns })
      return { text: `Activity pane ${step > 0 ? 'bigger' : 'smaller'}: ${describePane()}.` }
    }
    if (verb === 'size') {
      const n = Number(arg)
      if (!Number.isFinite(n) || n <= 0) return { text: 'Usage: /activity size N (rows above the prompt, columns when docked)' }
      await resizePane($, seenPlacement === 'dock' ? { ...paneSize, columns: n } : { ...paneSize, rows: n })
      return { text: `Activity pane resized: ${describePane()}.` }
    }
    if (verb === 'info') {
      return { text: `Activity pane: ${describePane()}. Fullscreen layout: ${e.presentation.isFullscreen ? 'on' : 'off'}, terminal ${e.presentation.columns} columns.` }
    }
    if ((await $.ui.panes()).some(p => p.id === PANE && p.isPlaced)) {
      await $.ui.close({ id: PANE })
      return { text: 'Activity pane closed.' }
    }
    const opened = await openPane($)

    return { text: opened.isPlaced ? 'Activity pane opened.' : `Activity pane waiting: ${opened.reason}` }
  })
  // The bottom bar offers "open activity" only while the pane is closed, so it redraws on every close.
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE) $.ui.invalidate('ui.render')
    return closed
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId === undefined) {
      const startedAt = await $.clock.now()
      const prompt = e.text.trim().split('\n')[0]?.slice(0, 120) ?? ''
      await update($, turns, all =>
        [{ turnId: e.turnId, seq: (all[0]?.seq ?? 0) + 1, prompt, startedAt, calls: 0 }, ...all.map(one => (one.endedAt === undefined ? { ...one, endedAt: startedAt } : one))].slice(0, MAX_TURNS),
      )
    } else {
      await ensureAgent($, agentId)
      await update($, agents, all => all.map(a => (a.id === agentId ? { ...a, status: 'running', endedAt: undefined } : a)))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const latest = (await read($, turns))[0]
    if (latest?.turnId === e.turnId || (e.agentId === undefined && latest?.turnId.startsWith(IMPLICIT) && latest.endedAt === undefined)) {
      const endedAt = await $.clock.now()
      await update($, turns, all => all.map((t, i) => (i === 0 ? { ...t, endedAt } : t)))
      // Safety net: a foreground row still live at turn end was cut short (Esc).
      await update($, calls, list =>
        list.map(c => (!c.isSub && (c.state === 'running' || c.state === 'waiting') ? { ...c, state: 'interrupted', endedAt } : c)),
      )
    }
    const agentId = e.agentId
    if (agentId !== undefined) {
      const endedAt = await $.clock.now()
      const status: AgentState = e.isAborted ? 'killed' : 'done'
      await update($, agents, all => all.map(a => (a.id === agentId ? { ...a, status, endedAt, answer: e.answer.slice(0, 4000) || a.answer } : a)))
      await update($, calls, list =>
        list.map(c => (c.agentId === agentId && (c.state === 'running' || c.state === 'waiting') ? { ...c, state: 'interrupted', endedAt } : c)),
      )
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const id = spawned.agentId
    if (id !== undefined) {
      const row: AgentRow = {
        id,
        toolUseId: e.tool_use_id,
        description: e.description,
        type: e.subagentType || 'agent',
        model: spawned.model,
        isBackground: e.background,
        parentId: e.parentAgentId,
        startedAt: await $.clock.now(),
        status: 'running',
        calls: 0,
      }
      await update($, agents, all => [row, ...all.filter(a => a.id !== id)].slice(0, MAX_AGENTS))
    }

    return spawned
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') await finishTasks($, e.text)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as Input
    const startedAt = await $.clock.now()
    const call: Call = {
      id: e.tool_use_id ?? `${tool}-${startedAt}`,
      tool,
      label: labelOf(tool, input),
      detail: detailOf(tool, input),
      startedAt,
      state: tool === 'AskUserQuestion' ? 'waiting' : 'running',
      isSub: e.agentId !== undefined,
      agentId: e.agentId,
      turnId: e.agentId === undefined ? await currentTurnId($) : undefined,
      path: FILE_TOOLS.has(tool) && tool !== 'Grep' && tool !== 'Glob' ? (str(input.file_path) ?? str(input.notebook_path)) : undefined,
    }
    await update($, calls, list => [call, ...list].slice(0, MAX_CALLS))
    const agentId = e.agentId
    if (agentId !== undefined) {
      await ensureAgent($, agentId)
      await update($, agents, all => all.map(a => (a.id === agentId ? { ...a, calls: a.calls + 1 } : a)))
    }
    if (call.turnId !== undefined) await update($, turns, all => all.map(t => (t.turnId === call.turnId ? { ...t, calls: t.calls + 1 } : t)))

    const ran = await next(e)

    const done = settle(call, ran, await $.clock.now())
    const stopped = tool === 'TaskStop' && done.state === 'ok' ? (str(input.task_id) ?? str(input.shell_id)) : undefined
    await update($, calls, list =>
      list.map(c =>
        c.id === call.id ? done : stopped !== undefined && c.taskId === stopped && c.state === 'background' ? { ...c, state: 'killed', endedAt: done.endedAt } : c,
      ),
    )
    await trackTodos($, tool, input, ran)
    const spawnedId = tool === 'Agent' && ran.deny === undefined && !ran.isError ? str((ran.result as Input | undefined)?.agentId) : undefined
    if (spawnedId !== undefined) {
      const isAsync = (ran.result as Input).status === 'async_launched'
      await update($, agents, all =>
        all.map(a =>
          a.id !== spawnedId ? a : { ...a, toolUseId: a.toolUseId ?? call.id, ...(isAsync || !isAgentLive(a.status) ? {} : { status: 'done' as const, endedAt: done.endedAt }) },
        ),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code, Markdown } = $.ui.resolve(e)
    seenPlacement = e.props.placement
    seenColumns = e.props.bodyColumns
    seenRows = e.props.scroll.bodyRows
    const now = await $.clock.now()
    const [list, open, agentRows, turnRows, foldMap, td] = await Promise.all([
      read($, calls),
      read($, expanded),
      read($, agents),
      read($, turns),
      read($, folds),
      read($, todos),
    ])
    const width = Math.max(24, e.props.bodyColumns - 2) // one column of padding each side
    const barWidth = Math.max(10, Math.min(48, width - 18))
    const t = turnRows[0]
    const isTurnLive = t !== undefined && t.endedAt === undefined
    // An Agent call is drawn as its agent's folder, and a subagent's calls inside it.
    const linked = new Set(agentRows.map(a => a.toolUseId))
    const main = list.filter(c => !c.isSub && !(c.tool === 'Agent' && linked.has(c.id)))
    const live = main.filter(c => isLive(c.state))
    const finished = main.filter(c => !isLive(c.state))
    const runningCount = main.filter(c => c.state === 'running' || c.state === 'waiting').length
    const backgroundCount = main.filter(c => c.state === 'background').length
    const liveAgents = agentRows.filter(a => isAgentLive(a.status))

    const tails = new Map<string, { text: string; mtimeMs?: number }>()
    for (const c of list.filter(one => isLive(one.state)).slice(0, 8)) if (c.outputPath) tails.set(c.id, await fileTail($, c.outputPath))

    const elapsedOf = (c: Call) => fmt((c.endedAt ?? now) - c.startedAt)
    const toggle = (id: string) => () => update($, expanded, cur => (cur === id ? null : id))
    const isOpen = (key: string, fallback: boolean) => foldMap[key] ?? fallback
    const fold = (key: string, fallback: boolean) => () => update($, folds, m => ({ ...m, [key]: !(m[key] ?? fallback) }))
    const copy = (text: string, what: string) => async (press: { surface: Parameters<EngineInterface['ui']['copy']>[0]['surface'] }) => {
      const copied = await $.ui.copy({ text, surface: press.surface })
      $.ui.toast(copied.isCopied ? `Copied ${what}` : `Copy failed: ${copied.reason}`)
    }

    function bar(key: string, filled: number, color: string, label?: string) {
      const lit = Math.max(0, Math.min(barWidth, Math.round(filled * barWidth)))
      return (
        <Box key={key} flexDirection="row">
          <Text color={color}>{'━'.repeat(lit)}</Text>
          <Text dimColor>{'━'.repeat(barWidth - lit)}</Text>
          {label !== undefined && <Text color="inactive"> {label}</Text>}
        </Box>
      )
    }

    // Indeterminate: a lit segment sweeping across while the turn runs with no todo list to measure.
    function sweep(key: string) {
      const span = Math.max(4, Math.floor(barWidth / 5))
      const at = (Math.floor(now / 1000) * 3) % (barWidth + span) - span
      const lit = Math.max(0, Math.min(barWidth, at + span) - Math.max(0, at))
      const before = Math.max(0, Math.min(barWidth, at))
      return (
        <Box key={key} flexDirection="row">
          <Text dimColor>{'━'.repeat(before)}</Text>
          <Text color="claude">{'━'.repeat(lit)}</Text>
          <Text dimColor>{'━'.repeat(barWidth - before - lit)}</Text>
        </Box>
      )
    }

    function outputLines(c: Call, count: number): string[] {
      const text = tail(tails.get(c.id)?.text ?? c.output ?? '', count).output
      return text === '' ? [] : text.split('\n')
    }

    // Output reads in its own readable grey, its gutter in the row's state colour.
    function outputLine(line: string, gutter: string) {
      return (
        <Text wrap="truncate-end">
          <Text color={gutter}>│ </Text>
          <Text color="inactive">{line === '' ? ' ' : line}</Text>
        </Text>
      )
    }

    function tailBlock(key: string, lines: string[], gutter: string) {
      return (
        <Box key={key} flexDirection="column" paddingLeft={2}>
          {lines.map(line => outputLine(line, gutter))}
        </Box>
      )
    }

    // A section or folder header: a chevron that folds it, then its own content.
    function head(key: string, fallback: boolean, depth: number, content: RenderChildren[]) {
      return (
        <Button key={key} plain onPress={fold(key, fallback)}>
          {'  '.repeat(depth)}
          <Text color="inactive">{isOpen(key, fallback) ? '▾ ' : '▸ '}</Text>
          {content}
        </Button>
      )
    }

    function section(key: string, title: string, summary: string, fallback: boolean, kids: () => RenderChildren[]) {
      return (
        <Box flexDirection="column" marginTop={1}>
          {head(key, fallback, 0, [
            <Text bold color="claude">
              {title}
            </Text>,
            summary ? <Text color="inactive">{`  ${summary}`}</Text> : '',
          ])}
          {isOpen(key, fallback) ? kids() : null}
        </Box>
      )
    }

    // `indent` is the padding of the box the row sits in; labels pad to `room` so times line up in a column.
    function row(c: Call, time: string, guide: string, indent: number, extra?: string) {
      const tag = tagOf(c.tool)
      const room = Math.max(8, width - indent - guide.length - 2 - tag.tag.length - 1 - 1 - time.length - (extra ? extra.length + 1 : 0) - 1)
      const timeColor = c.state === 'running' ? colorOf(c, now) : c.state === 'background' ? 'suggestion' : 'inactive'
      return (
        <Button key={c.id} plain onPress={toggle(c.id)}>
          {guide ? <Text color="inactive">{guide}</Text> : ''}
          <Text color={colorOf(c, now)}>{ICON[c.state]}</Text>{' '}
          <Text color={tag.color} bold>
            {tag.tag}
          </Text>{' '}
          {c.id === open ? (
            <Text bold color="claude">
              {clip(c.label, room).padEnd(room)}
            </Text>
          ) : (
            clip(c.label, room).padEnd(room)
          )}{' '}
          <Text color={timeColor}>{time}</Text>
          {extra ? <Text color={c.state === 'failed' || c.state === 'denied' ? 'error' : 'warning'}> {extra}</Text> : ''}
        </Button>
      )
    }

    const problem = (c: Call) => (c.state === 'failed' || c.state === 'denied' || c.state === 'killed' || c.state === 'interrupted' ? (c.note ?? c.state) : undefined)

    // An opened call: a card in its state colour, the command above a rule, the output below it.
    function details(c: Call) {
      const lines = outputLines(c, TAIL_LINES)
      const output = lines.join('\n')
      const stateColor = colorOf(c, now)
      const codeKey = `code:${c.id}`
      const codeLines = c.detail.replace(/\s+$/, '').split('\n')
      const isFull = isOpen(codeKey, false)
      const stop = async () => {
        if (c.taskId === undefined) return
        const res = await $.tool.call({ tool: 'TaskStop', task_id: c.taskId })
        const isStopped = res.deny === undefined && !res.isError
        if (isStopped) {
          const endedAt = await $.clock.now()
          await update($, calls, all => all.map(one => (one.id === c.id && one.state === 'background' ? { ...one, state: 'killed', endedAt } : one)))
        }
        $.ui.toast(res.deny !== undefined ? `Stop refused: ${res.deny}` : res.isError ? `Stop failed: ${res.text ?? ''}` : `Stopped ${c.taskId}`)
      }

      return (
        <Box key={`${c.id}:details`} flexDirection="column" borderStyle="round" borderColor={stateColor} paddingX={1} marginLeft={2} marginBottom={1}>
          <Text bold color="claude">
            {c.tool === 'Bash' ? 'COMMAND' : 'INPUT'}
          </Text>
          <Code source={(isFull ? codeLines : codeLines.slice(0, CODE_LINES)).join('\n')} language={c.tool === 'Bash' ? 'bash' : 'json'} wrap="truncate-end" />
          {codeLines.length > CODE_LINES && (
            <Button key={codeKey} plain onPress={fold(codeKey, false)}>
              <Text color="inactive">{isFull ? '▴ show less' : `▾ ${codeLines.length - CODE_LINES} more lines`}</Text>
            </Button>
          )}
          <Text color="inactive">{'─'.repeat(Math.max(4, width - 12))}</Text>
          <Text>
            <Text bold color="claude">
              OUTPUT
            </Text>
            <Text color="inactive">{'  '}</Text>
            <Text color={stateColor}>{c.state}</Text>
            {c.note ? <Text color={c.state === 'failed' || c.state === 'denied' ? 'error' : 'inactive'}> · {c.note}</Text> : ''}
            {c.taskId ? <Text color="inactive"> · task {c.taskId}</Text> : ''}
            {c.outputLines && c.outputLines > TAIL_LINES ? <Text color="inactive"> · last {TAIL_LINES} of {c.outputLines} lines</Text> : ''}
          </Text>
          {lines.length === 0 ? (
            <Text color="inactive" italic>
              {c.state === 'running' ? '(no output yet)' : '(no output)'}
            </Text>
          ) : (
            lines.map(line => (
              <Text color="inactive" wrap="truncate-end">
                {line === '' ? ' ' : line}
              </Text>
            ))
          )}
          <Box flexDirection="row" gap={1} marginTop={1}>
            <Button key={`${c.id}:copy-cmd`} label={c.tool === 'Bash' ? 'Copy command' : 'Copy input'} onPress={copy(c.detail, c.tool === 'Bash' ? 'command' : 'input')} />
            {lines.length > 0 && <Button key={`${c.id}:copy-out`} label="Copy output" onPress={copy(output, 'output')} />}
            {c.outputPath && <Button key={`${c.id}:copy-path`} label="Copy log path" onPress={copy(c.outputPath, 'log path')} />}
            {c.state === 'background' && c.taskId && <Button key={`${c.id}:stop`} label="Stop" onPress={stop} />}
          </Box>
        </Box>
      )
    }

    // A call inside a folder: its row under a tree guide, then its details when opened.
    function child(c: Call, isLast: boolean) {
      const r = row(c, elapsedOf(c), isLast ? '└ ' : '├ ', 4, problem(c))
      return c.id === open ? [r, details(c)] : [r]
    }

    function liveItem(c: Call) {
      const isExpanded = c.id === open
      const mtime = tails.get(c.id)?.mtimeMs
      if (c.state === 'background') {
        const isQuiet = mtime !== undefined && now - mtime > QUIET_MS
        const time = `${elapsedOf(c)} · ${isQuiet ? `quiet ${fmt(now - mtime)}` : 'live'}`
        return [row(c, time, '  ', 0), isExpanded ? details(c) : tailBlock(`${c.id}:tail`, outputLines(c, LIVE_LINES), 'suggestion')]
      }
      if (c.state === 'waiting') return [row(c, `${elapsedOf(c)} · waiting for you`, '  ', 0)]
      const elapsed = now - c.startedAt
      const typical = slowAfter(c.tool)
      const isSlow = elapsed > typical
      return [
        row(c, elapsedOf(c), '  ', 0),
        <Box key={`${c.id}:bar`} paddingLeft={4}>
          {bar(`${c.id}:fill`, isSlow ? 1 : elapsed / typical, isSlow ? 'warning' : 'claude', isSlow ? `+${fmt(elapsed - typical)} over typical` : `typical ≤${fmt(typical)}`)}
        </Box>,
        isExpanded ? details(c) : tailBlock(`${c.id}:tail`, outputLines(c, LIVE_LINES), colorOf(c, now)),
      ]
    }

    function agentFolder(a: AgentRow) {
      const key = `agent:${a.id}`
      const isRunning = isAgentLive(a.status)
      const opened = isOpen(key, isRunning)
      const time = `${fmt((a.endedAt ?? now) - a.startedAt)} · ${a.calls} call${a.calls === 1 ? '' : 's'}`
      const room = Math.max(8, width - 4 - 2 - (a.parentId ? 3 : 1) - a.type.length - 2 - time.length - 1)
      const own = list.filter(c => c.agentId === a.id)
      const shown = own.slice(0, AGENT_OPEN_CALLS)
      const header = head(key, isRunning, 1, [
        <Text color={AGENT_COLOR[a.status]}>{AGENT_ICON[a.status]}</Text>,
        a.parentId ? ' ↳ ' : ' ',
        <Text color="suggestion" bold>
          {a.type}
        </Text>,
        ` ${clip(a.description, room).padEnd(room)} `,
        <Text color={isRunning ? 'claude' : 'inactive'}>{time}</Text>,
      ])
      if (!opened) return [header]
      return [
        header,
        <Box key={`${key}:kids`} flexDirection="column" paddingLeft={4}>
          {shown.flatMap((c, i) => child(c, i === shown.length - 1))}
          {own.length > shown.length && <Text color="inactive">… {own.length - shown.length} earlier calls</Text>}
          {agentDetails(a)}
        </Box>,
      ]
    }

    function agentDetails(a: AgentRow) {
      const openTranscript = async () => {
        const viewed = (await $.ui.view({ agentId: a.id })) as { deny?: string }
        if (viewed.deny) $.ui.toast(`Can't open its transcript: ${viewed.deny}`)
      }
      const stop = async () => {
        const res = await $.tool.call({ tool: 'TaskStop', task_id: a.id })
        $.ui.toast(res.deny !== undefined ? `Stop refused: ${res.deny}` : res.isError ? `Stop failed: ${res.text ?? ''}` : `Stopped ${a.description}`)
      }
      return (
        <Box key={`agent:${a.id}:details`} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color={AGENT_COLOR[a.status]}>{a.status}</Text>
            <Text color="inactive">
              {' · '}
              {a.isBackground ? 'background' : 'foreground'}
              {a.model ? ` · ${a.model}` : ''}
            </Text>
          </Text>
          {a.answer ? (
            <Markdown text={clip(a.answer, 1500)} />
          ) : (
            <Text color="inactive" italic>
              {isAgentLive(a.status) ? '(working; its answer shows here when it finishes)' : '(no answer recorded)'}
            </Text>
          )}
          <Box flexDirection="row">
            <Button key={`agent:${a.id}:view`} label="Open transcript" onPress={openTranscript} />
            {a.answer && <Button key={`agent:${a.id}:copy`} label="Copy answer" onPress={copy(a.answer, 'the answer')} />}
            {isAgentLive(a.status) && a.isBackground && <Button key={`agent:${a.id}:stop`} label="Stop" onPress={stop} />}
          </Box>
        </Box>
      )
    }

    // FILES: every path read or changed, grouped by folder, lettered as VS Code's source control does.
    type FileEntry = { path: string; letter: 'W' | 'M' | 'R'; count: number }
    const fileMap = new Map<string, Map<string, FileEntry>>()
    for (const c of list) {
      if (c.path === undefined || (c.state !== 'ok' && c.state !== 'running')) continue
      const cut = c.path.lastIndexOf('/')
      const dir = c.path.slice(0, cut + 1).replace(/^\/(Users|home)\/[^/]+\//, '~/') || '/'
      const name = c.path.slice(cut + 1)
      const letter: FileEntry['letter'] = c.tool === 'Write' ? 'W' : c.tool === 'Read' ? 'R' : 'M'
      const files = fileMap.get(dir) ?? new Map<string, FileEntry>()
      const prev = files.get(name)
      const rank = { R: 0, M: 1, W: 2 }
      files.set(name, { path: c.path, letter: prev && rank[prev.letter] > rank[letter] ? prev.letter : letter, count: (prev?.count ?? 0) + 1 })
      fileMap.set(dir, files)
    }
    const allFiles = [...fileMap.values()].flatMap(m => [...m.values()])
    const changed = allFiles.filter(f => f.letter !== 'R').length
    const LETTER_COLOR = { W: 'success', M: 'warning', R: 'inactive' }

    function fileTree() {
      return [...fileMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([dir, files]) => {
          const key = `dir:${dir}`
          const entries = [...files.entries()].sort(([a], [b]) => a.localeCompare(b))
          const header = head(key, true, 1, [<Text color="ide">{clip(dir, width - 8)}</Text>])
          if (!isOpen(key, true)) return [header]
          return [
            header,
            <Box key={`${key}:kids`} flexDirection="column" paddingLeft={4}>
              {entries.map(([name, f], i) => (
                <Button key={`file:${f.path}`} plain onPress={copy(f.path, 'the path')}>
                  <Text color="inactive">{i === entries.length - 1 ? '└ ' : '├ '}</Text>
                  <Text color={LETTER_COLOR[f.letter]} bold>
                    {f.letter}
                  </Text>{' '}
                  {clip(name, width - 16)}
                  {f.count > 1 ? <Text color="inactive"> ×{f.count}</Text> : ''}
                </Button>
              ))}
            </Box>,
          ]
        })
    }

    // HISTORY: finished calls in one folder per turn, named by the prompt that started it; the newest is open.
    const groups: { key: string; calls: Call[] }[] = []
    for (const c of finished) {
      const key = `turn:${c.turnId ?? 'none'}`
      const group = groups.find(g => g.key === key)
      if (group) group.calls.push(c)
      else groups.push({ key, calls: [c] })
    }

    function turnFolder(g: { key: string; calls: Call[] }, index: number) {
      const meta = turnRows.find(tr => `turn:${tr.turnId}` === g.key)
      const failures = g.calls.filter(c => c.state === 'failed' || c.state === 'denied').length
      const time = meta ? `${fmt((meta.endedAt ?? now) - meta.startedAt)} · ${meta.calls} calls` : `${g.calls.length} calls`
      const title = meta ? meta.prompt || '(continuation)' : 'outside a turn'
      const seq = meta ? `#${meta.seq}` : '#'
      const room = Math.max(8, width - 4 - seq.length - 2 - time.length - (failures > 0 ? 4 : 0) - 1)
      const header = head(g.key, index === 0, 1, [
        <Text color="claude">{seq}</Text>,
        ` ${clip(title, room).padEnd(room)} `,
        <Text color={meta && meta.endedAt === undefined ? 'claude' : 'inactive'}>{time}</Text>,
        failures > 0 ? <Text color="error"> ✗{failures}</Text> : '',
      ])
      if (!isOpen(g.key, index === 0)) return [header]
      const shown = g.calls.slice(0, TURN_CALLS)
      return [
        header,
        <Box key={`${g.key}:kids`} flexDirection="column" paddingLeft={4}>
          {shown.flatMap((c, i) => child(c, i === shown.length - 1))}
          {g.calls.length > shown.length && <Text color="inactive">… {g.calls.length - shown.length} more</Text>}
        </Box>,
      ]
    }

    const turnText =
      t === undefined ? '' : isTurnLive ? `turn ${fmt(now - t.startedAt)} · ${t.calls} calls` : `last turn ${fmt((t.endedAt ?? now) - t.startedAt)} · ${t.calls} calls`
    const status = [
      runningCount > 0 ? `▶ ${runningCount} running` : isTurnLive ? '▶ thinking' : '○ idle',
      backgroundCount > 0 ? `◷ ${backgroundCount} in background` : '',
      liveAgents.length > 0 ? `◆ ${liveAgents.length} agent${liveAgents.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join('  ')
    const hasTodos = td !== null && td.total > 0

    const sizeNote = e.props.placement === 'dock' ? `${e.props.bodyColumns} cols wide` : `${e.props.scroll.bodyRows} rows tall`

    return (
      <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {e.props.view.agentId !== undefined && (
          <Button key="back-to-main" plain onPress={() => $.ui.view({})}>
            <Text color="suggestion">◂ viewing a subagent's transcript · back to main</Text>
          </Button>
        )}
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={runningCount > 0 || isTurnLive || liveAgents.length > 0 ? 'claude' : 'inactive'}>{status}</Text>
          <Text color="inactive">{turnText}</Text>
        </Box>
        {hasTodos ? bar('turn-bar', td.done / td.total, 'success', `todos ${td.done}/${td.total}`) : isTurnLive ? sweep('turn-bar') : bar('turn-bar', t === undefined ? 0 : 1, 'inactive')}
        {hasTodos && td.active && <Text color="planMode" wrap="truncate-end">→ {td.active}</Text>}

        {live.length > 0 && section('sec:running', 'RUNNING', String(live.length), true, () => live.flatMap(liveItem))}
        {agentRows.length > 0 &&
          section('sec:agents', 'AGENTS', `${liveAgents.length} running · ${agentRows.length - liveAgents.length} done`, true, () => agentRows.flatMap(agentFolder))}
        {allFiles.length > 0 && section('sec:files', 'FILES', `${allFiles.length} file${allFiles.length === 1 ? '' : 's'} · ${changed} changed`, false, fileTree)}
        {section('sec:history', 'HISTORY', groups.length > 0 ? `${finished.length} calls` : '', true, () =>
          groups.length === 0 ? [<Text color="inactive">  No tool calls yet.</Text>] : groups.slice(0, MAX_TURNS).flatMap(turnFolder),
        )}

        <Box flexDirection="row" marginTop={1}>
          <Button key="size-down" label="−" onPress={() => resizePane($, { rows: paneSize.rows - SIZE_STEP.rows, columns: paneSize.columns - SIZE_STEP.columns })} />
          <Text> </Text>
          <Button key="size-up" label="+" onPress={() => resizePane($, { rows: paneSize.rows + SIZE_STEP.rows, columns: paneSize.columns + SIZE_STEP.columns })} />
          <Text color="inactive" wrap="truncate-end">
            {'  '}
            {sizeNote} · /activity bigger | smaller
          </Text>
        </Box>
      </Box>
    )
  })

  // The bottom bar: progress while anything is in flight; otherwise, with the pane closed, a way back to it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [list, turnRows, td, isDetailed, agentRows] = await Promise.all([read($, calls), read($, turns), read($, todos), read($, bandDetail), read($, agents)])
    const t = turnRows[0]
    const isTurnLive = t !== undefined && t.endedAt === undefined
    const linked = new Set(agentRows.map(a => a.toolUseId))
    const running = list.filter(c => !c.isSub && (c.state === 'running' || c.state === 'waiting') && !(c.tool === 'Agent' && linked.has(c.id)))
    const background = list.filter(c => c.state === 'background' && !(c.tool === 'Agent' && linked.has(c.id)))
    const liveAgents = agentRows.filter(a => isAgentLive(a.status))
    const isBusy = isTurnLive || running.length > 0 || background.length > 0 || liveAgents.length > 0
    const isPaneShown = (await $.ui.panes()).some(p => p.id === PANE && p.isPlaced)
    if (e.props.hasSurvey || (!isBusy && isPaneShown)) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const reopen = async () => {
      await openPane($)
      $.ui.invalidate('ui.render')
    }
    const openButton = isPaneShown ? null : <Button key="open-pane" plain hotkey="a" label="◧ open activity" onPress={reopen} />
    if (!isBusy) return <Box flexDirection="row">{openButton}</Box>

    const now = await $.clock.now()
    const head = running[0]
    const hasTodos = td !== null && td.total > 0
    const facts = [
      hasTodos ? `todos ${td.done}/${td.total}` : '',
      running.length > 1 ? `+${running.length - 1} running` : '',
      background.length > 0 ? `◷ ${background.length} bg` : '',
      liveAgents.length > 0 ? `◆ ${liveAgents.length} agent${liveAgents.length === 1 ? '' : 's'}` : '',
      isTurnLive ? fmt(now - t.startedAt) : '',
    ].filter(Boolean).join(' · ')
    const width = Math.max(30, e.props.bodyColumns)
    const barWidth = Math.max(8, Math.min(24, Math.floor(width / 4)))
    const frac = head !== undefined ? Math.min(1, (now - head.startedAt) / slowAfter(head.tool)) : hasTodos ? td.done / td.total : 0
    const lit = Math.round(frac * barWidth)
    const color = head !== undefined ? colorOf(head, now) : 'success'
    const agent = liveAgents[0]
    const tag = head !== undefined ? tagOf(head.tool) : agent !== undefined ? { tag: agent.type, color: 'suggestion' } : undefined
    const label = head !== undefined ? head.label : agent !== undefined ? agent.description : hasTodos && td.active ? `→ ${td.active}` : '▶ thinking'
    const time = head !== undefined ? ` ${fmt(now - head.startedAt)}` : ''
    const controls = (isPaneShown ? 0 : 20) + 10
    const room = width - barWidth - facts.length - controls - time.length - (tag ? tag.tag.length + 3 : 1) - 4
    const toggleDetail = async () => {
      const value = await update($, bandDetail, v => !v)
      await $.store.set('bandDetail', value)
    }
    const watched = head ?? background[0]
    const lines =
      isDetailed && watched?.outputPath ? tail((await fileTail($, watched.outputPath)).text, BAND_LINES).output.split('\n').filter(Boolean) : []

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color={color}>{'━'.repeat(lit)}</Text>
          <Text dimColor>{'━'.repeat(barWidth - lit)}</Text>
          <Text color={color}> {head !== undefined ? ICON[head.state] : ''}</Text>
          {tag && (
            <Text color={tag.color} bold>
              {' '}
              {tag.tag}
            </Text>
          )}
          <Text> {clip(label, Math.max(10, room))}</Text>
          <Text color={color}>{time}</Text>
          <Text color="inactive">{facts ? `  ${facts}  ` : '  '}</Text>
          <Button key="band-size" plain hotkey="d" label={isDetailed ? '▾ less' : '▸ more'} onPress={toggleDetail} />
          {openButton && <Text> </Text>}
          {openButton}
        </Box>
        {isDetailed && watched && lines.length === 0 && <Text color="inactive">  │ (no output yet)</Text>}
        {lines.map(line => (
          <Text wrap="truncate-end">
            <Text color={color}>{'  │ '}</Text>
            <Text color="inactive">{line}</Text>
          </Text>
        ))}
      </Box>
    )
  })
}
