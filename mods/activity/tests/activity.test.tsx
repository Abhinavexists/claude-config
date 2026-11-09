import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'activity',
  component: 'Pane',
  requestId: 'activity',
  props: {
    title: 'Activity',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const
const BASH_OK = { result: { stdout: 'a\nb', stderr: '', interrupted: false }, text: 'a\nb' }

test('a finished call shows as ok with its time and output', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('tool.call', () => BASH_OK)
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const row = await ui.find({ type: 'Button', text: /List files/ })
    expect(row?.text).toContain('✓')
    await ui.press({ key: row?.key ?? '' })
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('ls')
    expect((await ui.find({ type: 'Text', text: /^\$$/ }))?.props.color).toBe('bashBorder')
    expect((await ui.find({ type: 'Text', text: /^b$/ }))?.text).toBe('b')
    await ui.press({ key: row?.key ?? '' })
    await ui.unmount()
  }
})

test('a failed call shows its exit code and error output', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => ({ isError: true, result: 'Exit code 2\nboom', text: 'Exit code 2\nboom' }))
  await $.tool.call({ tool: 'Bash', command: 'false', description: 'Fail on purpose' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ type: 'Button', text: /Fail on purpose/ })
  expect(row?.text).toContain('✗')
  await ui.press({ key: row?.key ?? '' })
  expect(row?.text).toContain('exit 2')
  expect(await ui.find({ type: 'Text', text: /failed · exit 2/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^boom$/ })).toBeDefined()
  await ui.unmount()
})

test('a running call ticks and turns amber past its p90', async ($, on) => {
  const clock = mock.clock(on)
  let release = () => {}
  const gate = new Promise<void>(done => (release = done))
  on('tool.call', async () => {
    await gate
    return BASH_OK
  })
  const pending = $.tool.call({ tool: 'Bash', command: 'sleep 40', description: 'Sleep forty' })
  await clock.advance(5_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /Sleep forty/ }))?.text).toContain('5.0s')
  expect(await ui.find({ type: 'Text', text: /typical ≤30s/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^▶$/ }))?.props.color).toBe('claude')
  await ui.unmount()

  await clock.advance(30_000)
  const later = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await later.find({ type: 'Button', text: /Sleep forty/ }))?.text).toContain('35s')
  expect(await later.find({ type: 'Text', text: /\+5\.0s over typical/ })).toBeDefined()
  expect((await later.find({ type: 'Text', text: /^▶$/ }))?.props.color).toBe('warning')
  await later.unmount()

  release()
  await pending
})

test('a background shell tails its log, then finishes on its notification', async ($, on) => {
  mock.clock(on, { now: 100_000 })
  on('tool.call', () => ({
    result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' },
    text: 'Command running in background with ID: b1. Output is being written to: /tmp/t/tasks/b1.output. You will be notified.',
  }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 20, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: 'starting\nserver up on :3000\n' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.tool.call({ tool: 'Bash', command: 'npm run dev', description: 'Start dev server', run_in_background: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const row = await ui.find({ type: 'Button', text: /Start dev server/ })
  expect(row?.text).toContain('◷')
  expect(row?.text).toContain('quiet')
  expect((await ui.find({ type: 'Text', text: /in background/ }))?.text).toContain('1 in background')
  await ui.press({ key: row?.key ?? '' })
  expect(await ui.find({ type: 'Text', text: /server up on :3000/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: `${row?.key}:stop` })).toBeDefined()
  await ui.unmount()

  await $.prompt.submit({
    text: '<task-notification><task-id>b1</task-id><status>completed</status><summary>exit code 0</summary></task-notification>',
    origin: { kind: 'task-notification' },
  } as never)
  const after = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await after.find({ type: 'Button', text: /Start dev server/ }))?.text).toContain('✓')
  expect(await after.find({ type: 'Text', text: /in background/ })).toBeUndefined()
  await after.unmount()
})

test('subagents get their own rows with their calls, answer and transcript link', async ($, on) => {
  const clock = mock.clock(on)
  const viewed: unknown[] = []
  let status = 'running'
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Explore repo', type: 'Explore', status }] as never }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.view', (_, e) => {
    viewed.push(e)
    return { value: {} }
  })
  on('tool.call', () => ({ result: {}, text: 'ok' }))

  await $.agent.spawn({ prompt: 'look', description: 'Explore repo', subagentType: 'Explore', background: true } as never)
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/a.ts', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'register', agentId: 'a1' } as never)
  await clock.advance(3_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^AGENTS$/ })).toBeDefined()
    const agent = await ui.find({ type: 'Button', key: 'agent:a1' })
    expect(agent?.text).toContain('▾ ▶ Explore Explore repo')
    expect(agent?.text).toContain('2 calls')
    expect((await ui.find({ type: 'Button', text: /a\.ts/ }))?.text).toMatch(/^[├└] ✓ Read/)
    expect((await ui.find({ type: 'Text', text: /agent/ }))?.text).toContain('◆ 1 agent')
    await ui.press({ key: 'agent:a1:view' })
    expect(await ui.find({ type: 'Button', key: 'agent:a1:stop' })).toBeDefined()
    await ui.press({ key: 'agent:a1' })
    expect(await ui.find({ type: 'Button', text: /a\.ts/ })).toBeUndefined()
    await ui.press({ key: 'agent:a1' })
    await ui.unmount()
  }
  expect(viewed).toEqual([{ agentId: 'a1' }, { agentId: 'a1' }])

  status = 'completed'
  await $.turn.complete({ turnId: 't9', agentId: 'a1', answer: 'Found **3** files', durationMs: 1, isAborted: false, reason: 'end_turn', text: '' } as never)
  const done = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await done.find({ type: 'Button', text: /Explore repo/ }))?.text).toContain('✓')
  // The person left this folder open, so it stays open now the agent is done.
  expect(await done.find({ type: 'Button', text: /a\.ts/ })).toBeDefined()
  expect((await done.find({ type: 'Markdown' }))?.props.text).toBe('Found **3** files')
  await done.press({ key: 'agent:a1' })
  expect(await done.find({ type: 'Markdown' })).toBeUndefined()
  await done.unmount()
})

test("an Agent call's own row folds into its agent's row", async ($, on) => {
  mock.clock(on)
  on('agent.list', () => ({ value: [{ id: 'a2', description: 'Fix tests', type: 'general-purpose', status: 'completed' }] as never }))
  on('tool.call', (_, e) => (e.tool === 'Agent' ? { result: { agentId: 'a2', content: [] }, text: 'fixed' } : { result: {}, text: '' }))

  await $.tool.call({ tool: 'Read', file_path: '/repo/x.ts', agentId: 'a2' } as never)
  await $.tool.call({ tool: 'Agent', description: 'Fix tests', prompt: 'go', subagent_type: 'general-purpose' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const rows = await ui.findAll({ type: 'Button', text: /Fix tests/ })
  expect(rows).toHaveLength(1)
  expect(rows[0]?.key).toBe('agent:a2')
  expect(rows[0]?.text).toContain('✓')
  await ui.unmount()
})

test('the header counts todos and names the active one', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => ({ result: { oldTodos: [], newTodos: [] }, text: '' }))
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'a', status: 'completed', activeForm: 'Doing a' },
      { content: 'b', status: 'in_progress', activeForm: 'Running tests' },
      { content: 'c', status: 'pending', activeForm: 'Doing c' },
    ],
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /todos/ }))?.text).toContain('todos 1/3')
  expect((await ui.find({ type: 'Text', text: /→/ }))?.text).toBe('→ Running tests')
  await ui.unmount()
})

test('a value an earlier version stored is declined', async ($, on) => {
  mock.clock(on)
  on('state.get', () => ({ value: { value: [{ tool: 'Bash' }], version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /No tool calls yet/ })).toBeDefined()
  await ui.unmount()
})

test('/activity opens a pane that is open but not placed, and closes a placed one', async ($, on) => {
  const opened: string[] = []
  const closed: string[] = []
  let isPlaced = false
  on('ui.panes', () => ({ value: [{ id: 'activity', title: 'Activity', isShown: isPlaced, isFocused: false, isPlaced }] }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    closed.push(e.id)
    return { value: undefined }
  })

  await $.command.run({ command: 'activity', args: '' } as never)
  expect(opened).toEqual(['activity'])
  expect(closed).toEqual([])

  isPlaced = true
  await $.command.run({ command: 'activity', args: '' } as never)
  expect(closed).toEqual(['activity'])
})

test('Stop ends a background row even without a notification', async ($, on) => {
  mock.clock(on)
  const stopped: unknown[] = []
  on('tool.call', (_, e) => {
    if (e.tool === 'TaskStop') {
      stopped.push(e.task_id)
      return { result: { message: 'stopped', task_id: 'b9', task_type: 'shell' }, text: 'stopped' }
    }
    return { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b9' }, text: 'Command running in background with ID: b9.' }
  })
  await $.tool.call({ tool: 'Bash', command: 'tail -f x', description: 'Follow log', run_in_background: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ type: 'Button', text: /Follow log/ })
  await ui.press({ key: row?.key ?? '' })
  await ui.press({ key: `${row?.key}:stop` })
  expect(stopped).toEqual(['b9'])
  expect((await ui.find({ type: 'Button', text: /Follow log/ }))?.text).toContain('■')
  expect(await ui.find({ type: 'Button', key: `${row?.key}:stop` })).toBeUndefined()
  await ui.unmount()
})

test("a subagent's turn ending leaves the main turn's running call alone", async ($, on) => {
  mock.clock(on)
  let release = () => {}
  const gate = new Promise<void>(done => (release = done))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', async () => {
    await gate
    return { result: {}, text: '' }
  })

  await $.turn.start({ text: 'go', turnId: 'main' } as never)
  const pending = $.tool.call({ tool: 'Agent', description: 'Explore repo', prompt: 'x' } as never)
  await $.turn.complete({ turnId: 'sub', agentId: 'a1', answer: '', durationMs: 1, isAborted: false, reason: 'end_turn', text: '' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /Explore repo/ }))?.text).toContain('▶')
  expect((await ui.find({ type: 'Text', text: /calls/ }))?.text).toMatch(/^turn .* 1 calls/)
  await ui.unmount()

  await $.turn.complete({ turnId: 'main', answer: '', durationMs: 1, isAborted: true, reason: 'aborted', text: '' } as never)
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await after.find({ type: 'Button', text: /Explore repo/ }))?.text).toContain('■')
  expect((await after.find({ type: 'Text', text: /calls/ }))?.text).toMatch(/^last turn/)
  await after.unmount()
  release()
  await pending
})

const PLACED = { id: 'activity', title: 'Activity', isShown: true, isFocused: false, isPlaced: true }

const BAND = {
  plugin: 'activity',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

test('a running foreground command shows its live output, found in the session tasks folder', async ($, on) => {
  const clock = mock.clock(on, { now: 50_000 })
  const DIR = '/private/tmp/claude-501/-Users-x/S1/tasks'
  on('command.register', () => ({ value: { command: 'activity' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'S1' }))
  on('fs.list', (_, e) => {
    const entries: Record<string, { name: string; kind: 'dir' | 'file'; size: number }[]> = {
      '/private/tmp': [{ name: 'claude-501', kind: 'dir', size: 0 }, { name: 'other', kind: 'dir', size: 0 }],
      '/private/tmp/claude-501': [{ name: '-Users-x', kind: 'dir', size: 0 }],
      [DIR]: [{ name: 'old.output', kind: 'file', size: 9 }, { name: 'b42.output', kind: 'file', size: 30 }],
    }
    return { value: (entries[e.path] ?? []) as never }
  })
  on('fs.stat', (_, e) => ({
    value: e.path === DIR ? { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } : { kind: 'file', size: 30, mtimeMs: e.path.endsWith('old.output') ? 1_000 : 51_000, isLink: false },
  }))
  on('fs.read', () => ({ value: 'compiling\nstep 2\nstep 3\nstep 4\n' }))
  let release = () => {}
  const gate = new Promise<void>(done => (release = done))
  on('tool.call', async () => {
    await gate
    return BASH_OK
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const pending = $.tool.call({ tool: 'Bash', command: 'make', description: 'Build it' })
  await clock.advance(2_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /RUNNING/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /│ step 4/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /│ compiling/ })).toBeUndefined()
    const row = await ui.find({ type: 'Button', text: /Build it/ })
    await ui.press({ key: row?.key ?? '' })
    expect(await ui.find({ type: 'Text', text: /^compiling$/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: `${row?.key}:copy-path` })).toBeDefined()
    await ui.press({ key: row?.key ?? '' })
    await ui.unmount()
  }

  release()
  await pending
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /RUNNING/ })).toBeUndefined()
  expect((await after.find({ type: 'Button', text: /Build it/ }))?.text).toContain('✓')
  await after.unmount()
})

test('the bottom bar shows the running call while busy and steps aside when idle', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('ui.panes', () => ({ value: [PLACED] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  let release = () => {}
  const gate = new Promise<void>(done => (release = done))
  on('tool.call', async () => {
    await gate
    return BASH_OK
  })

  await $.turn.start({ text: 'go', turnId: 'm' } as never)
  const pending = $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run tests' })
  await clock.advance(15_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Run tests/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ 15s$/ }))?.props.color).toBe('claude')
    expect(await ui.find({ type: 'Text', text: /engine/ })).toBeUndefined()
    await ui.unmount()
  }

  release()
  await pending
  await $.turn.complete({ turnId: 'm', answer: '', durationMs: 1, isAborted: false, reason: 'end_turn', text: '' } as never)
  const idle = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await idle.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await idle.unmount()
})

test('with the pane closed the bottom bar always offers to reopen it, and its size toggle is kept', async ($, on) => {
  const clock = mock.clock(on)
  const stored: Record<string, unknown> = {}
  const opened: string[] = []
  let isPlaced = false
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: isPlaced ? [PLACED] : [] }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    isPlaced = true
    return { value: { isPlaced: true } }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: 9, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: 'one\ntwo\nthree\nfour\nfive\n' }))
  on('tool.call', () => ({
    result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b5' },
    text: 'Command running in background with ID: b5. Output is being written to: /tmp/t/tasks/b5.output. Ok.',
  }))

  const idle = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await idle.find({ type: 'Button', key: 'open-pane' })).toBeDefined()
  await idle.press({ key: 'open-pane' })
  expect(opened).toEqual(['activity'])
  await idle.unmount()
  const shown = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await shown.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await shown.unmount()

  isPlaced = false
  await $.tool.call({ tool: 'Bash', command: 'serve', description: 'Serve', run_in_background: true })
  await clock.advance(1_000)
  const busy = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await busy.find({ type: 'Button', key: 'open-pane' })).toBeDefined()
  expect(await busy.find({ type: 'Text', text: /two/ })).toBeUndefined()
  await busy.press({ key: 'band-size' })
  expect(await busy.find({ type: 'Text', text: /two/ })).toBeDefined()
  expect(await busy.find({ type: 'Text', text: /one/ })).toBeUndefined()
  expect(stored.bandDetail).toBe(true)
  await busy.unmount()
})

test('/activity bigger, smaller and size N resize the pane and keep the size', async ($, on) => {
  mock.clock(on)
  const stored: Record<string, unknown> = {}
  const opens: { rows?: number; columns?: number }[] = []
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('ui.open', (_, e) => {
    opens.push({ rows: e.rows, columns: e.columns })
    return { value: { isPlaced: true } }
  })
  const closes: string[] = []
  on('ui.close', (_, e) => {
    closes.push(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [PLACED] }))

  await $.command.run({ command: 'activity', args: 'bigger' } as never)
  expect(closes).toEqual(['activity'])
  expect(opens.at(-1)).toEqual({ rows: 20, columns: 68 })
  await $.command.run({ command: 'activity', args: 'smaller' } as never)
  await $.command.run({ command: 'activity', args: 'smaller' } as never)
  expect(opens.at(-1)).toEqual({ rows: 12, columns: 52 })
  expect(stored.paneSize).toEqual({ rows: 12, columns: 52 })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await $.command.run({ command: 'activity', args: 'size 90' } as never)
  expect(opens.at(-1)).toEqual({ rows: 12, columns: 90 })
  await ui.press({ key: 'size-up' })
  expect(opens.at(-1)).toEqual({ rows: 16, columns: 98 })
  await ui.unmount()
})

test('FILES folds into a tree of touched paths lettered by what happened to them', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => ({ result: {}, text: '' }))
  await $.tool.call({ tool: 'Read', file_path: '/Users/me/app/src/a.ts' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/Users/me/app/src/a.ts', old_string: 'x', new_string: 'y' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/Users/me/app/src/b.ts' } as never)
  await $.tool.call({ tool: 'Write', file_path: '/Users/me/app/README.md', content: '#' } as never)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Button', key: 'sec:files' }))?.text).toContain('▸ FILES  3 files · 2 changed')
    expect(await ui.find({ type: 'Button', key: 'file:/Users/me/app/src/a.ts' })).toBeUndefined()
    await ui.press({ key: 'sec:files' })
    expect((await ui.find({ type: 'Button', key: 'dir:~/app/src/' }))?.text).toContain('▾ ~/app/src/')
    expect((await ui.find({ type: 'Button', key: 'file:/Users/me/app/src/a.ts' }))?.text).toBe('├ M a.ts ×2')
    expect((await ui.find({ type: 'Button', key: 'file:/Users/me/app/src/b.ts' }))?.text).toBe('└ R b.ts')
    expect((await ui.find({ type: 'Button', key: 'file:/Users/me/app/README.md' }))?.text).toBe('└ W README.md')
    await ui.press({ key: 'sec:files' })
    await ui.unmount()
  }
})

test('HISTORY keeps one folder per turn, named by its prompt, newest open', async ($, on) => {
  mock.clock(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => BASH_OK)

  await $.turn.start({ text: 'set up the repo\nwith details', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'git init', description: 'Init repo' })
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'end_turn', text: '' } as never)
  await $.turn.start({ text: 'run the tests', turnId: 't2' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run tests' })
  await $.tool.call({ tool: 'Bash', command: 'npm run lint', description: 'Lint' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', key: 'turn:t2' }))?.text).toMatch(/^ {2}▾ #2 run the tests .*2 calls/)
  expect((await ui.find({ type: 'Button', key: 'turn:t1' }))?.text).toMatch(/^ {2}▸ #1 set up the repo .*1 calls/)
  expect((await ui.find({ type: 'Button', text: /Lint/ }))?.text).toMatch(/^├ ✓ \$ Lint/)
  expect((await ui.find({ type: 'Button', text: /Run tests/ }))?.text).toMatch(/^└ ✓ \$ Run tests/)
  expect(await ui.find({ type: 'Button', text: /Init repo/ })).toBeUndefined()
  await ui.press({ key: 'turn:t1' })
  expect(await ui.find({ type: 'Button', text: /Init repo/ })).toBeDefined()
  await ui.press({ key: 'sec:history' })
  expect(await ui.find({ type: 'Button', text: /Lint/ })).toBeUndefined()
  await ui.unmount()

  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await again.find({ type: 'Button', key: 'sec:history' }))?.text).toContain('▸ HISTORY')
  await again.unmount()
})

test('calls made before the pane saw their turn start land in a stand-in turn that ends with it', async ($, on) => {
  mock.clock(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => BASH_OK)

  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files' })
  await $.tool.call({ tool: 'Bash', command: 'pwd', description: 'Show the folder' })
  await $.turn.complete({ turnId: 'real-1', answer: '', durationMs: 1, isAborted: false, reason: 'end_turn', text: '' } as never)
  await $.turn.start({ text: 'next prompt', turnId: 't2' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const folders = await ui.findAll({ type: 'Button', text: /^ {2}[▾▸] #1 / })
  expect(folders).toHaveLength(1)
  expect(folders[0]?.text).toContain('(started before the pane loaded)')
  expect(folders[0]?.text).toContain('2 calls')
  expect((await ui.find({ type: 'Text', text: /calls$/ }))?.text).toMatch(/^turn .* 0 calls/)
  await ui.unmount()
})

test('call rows pad their labels so times line up in one column', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => BASH_OK)
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List' })
  await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run the whole test suite' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const short = (await ui.find({ type: 'Button', text: /List/ }))?.text ?? ''
  const long = (await ui.find({ type: 'Button', text: /whole test suite/ }))?.text ?? ''
  expect(short.indexOf('0.0s')).toBeGreaterThan(20)
  expect(short.indexOf('0.0s')).toBe(long.indexOf('0.0s'))
  expect(long.length).toBeLessThanOrEqual(PANE.props.bodyColumns)
  await ui.unmount()
})

test('an opened call is a card: command above output, long commands folded to 8 lines', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => BASH_OK)
  const script = Array.from({ length: 20 }, (_, i) => `echo line${i + 1}`).join('\n')
  await $.tool.call({ tool: 'Bash', command: script, description: 'Long script' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const row = await ui.find({ type: 'Button', text: /Long script/ })
    await ui.press({ key: row?.key ?? '' })
    expect(await ui.find({ type: 'Text', text: /^COMMAND$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^OUTPUT$/ })).toBeDefined()
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe(script.split('\n').slice(0, 8).join('\n'))
    expect((await ui.find({ type: 'Text', text: /^Long script/ }))?.props.bold).toBe(true)
    await ui.press({ key: `code:${row?.key}` })
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe(script)
    await ui.press({ key: `code:${row?.key}` })
    await ui.press({ key: row?.key ?? '' })
    await ui.unmount()
  }
})
