// Dashboard-local types — mirrors root types.ts but without any Node/OpenAI imports

export interface Score {
  name: string
  score: number
}

export interface Run {
  input: string
  output: {
    role: string
    content: string | null
    tool_calls?: unknown[]
    refusal: null
  }
  expected: unknown
  scores: Score[]
  createdAt: string
}

export interface Set {
  runs: Run[]
  score: number
  createdAt: string
}

export interface Experiment {
  name: string
  sets: Set[]
}

export interface Results {
  experiments: Experiment[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatToolTrace {
  name: string
  arguments: string
  response: string
}

export interface ChatTurnResult {
  message: ChatMessage
  toolCalls: ChatToolTrace[]
  requiresApproval: boolean
}
