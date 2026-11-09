export type CallState =
  | 'running'
  | 'waiting'
  | 'ok'
  | 'failed'
  | 'denied'
  | 'interrupted'
  | 'background'
  | 'done'
  | 'killed'

export type Call = {
  id: string
  tool: string
  label: string
  detail: string
  startedAt: number
  endedAt?: number
  state: CallState
  isSub: boolean
  agentId?: string
  turnId?: string
  path?: string
  taskId?: string
  outputPath?: string
  output?: string
  outputLines?: number
  note?: string
}

export type AgentState = 'pending' | 'running' | 'waiting' | 'idle' | 'done' | 'failed' | 'killed'

export type AgentRow = {
  id: string
  toolUseId?: string
  description: string
  type: string
  model?: string
  isBackground: boolean
  parentId?: string
  startedAt: number
  endedAt?: number
  status: AgentState
  calls: number
  answer?: string
}

export type Turn = { turnId: string; seq: number; prompt: string; startedAt: number; endedAt?: number; calls: number }

export type Todos = { done: number; total: number; active?: string }

declare module 'claude-code' {
  interface PluginState {
    activity: {
      calls: Shaped<Call[]>
      expanded: string | null
      agents: Shaped<AgentRow[]>
      folds: Shaped<Record<string, boolean>>
      bandDetail: boolean
      turns: Shaped<Turn[]>
      todos: Shaped<Todos | null>
      tasks: Shaped<Record<string, string>>
    }
  }
}
