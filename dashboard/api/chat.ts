type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ChatToolTrace = {
  name: string
  arguments: string
  response: string
}

type ChatTurnResult = {
  message: ChatMessage
  toolCalls: ChatToolTrace[]
  requiresApproval: boolean
}

const json = (res: any, status: number, payload: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const getBody = (req: any) => {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }

  return null
}

const getLatestUserMessage = (messages: ChatMessage[]) => {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
}

const summarizeTitles = async (titles: string[]) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || titles.length === 0) {
    return titles.map(() => '')
  }

  const prompt = [
    'For each Reddit post title below, return one short sentence describing what the discussion is likely about.',
    'Return only a JSON array of strings in the same order.',
    '',
    ...titles.map((title, i) => `${i + 1}. ${title}`),
  ].join('\n')

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You summarize social posts accurately and concisely.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!completion.ok) {
    return titles.map(() => '')
  }

  const data = (await completion.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content?.trim() || '[]'
  const normalized = content.startsWith('```')
    ? content.replace(/```(?:json)?/g, '').trim()
    : content

  try {
    const parsed = JSON.parse(normalized) as string[]
    return titles.map((_, i) => parsed[i] || '')
  } catch {
    return titles.map(() => '')
  }
}

const handleReddit = async (): Promise<ChatTurnResult> => {
  const reddit = await fetch('https://www.reddit.com/r/nba/.json')
  if (!reddit.ok) {
    return {
      message: {
        role: 'assistant',
        content: 'Failed to load Reddit posts right now. Try again shortly.',
      },
      toolCalls: [],
      requiresApproval: false,
    }
  }

  const payload = (await reddit.json()) as any
  const rawPosts = (payload?.data?.children || []).slice(0, 8)
  const posts = rawPosts.map((child: any) => ({
    title: child?.data?.title || 'Untitled post',
    link: child?.data?.url || 'https://reddit.com/r/nba',
    subreddit: child?.data?.subreddit_name_prefixed || 'r/nba',
    author: child?.data?.author || 'unknown',
    upvotes: child?.data?.ups || 0,
  }))

  const summaries = await summarizeTitles(posts.map((post: any) => post.title))
  const withSummary = posts.map((post: any, index: number) => ({
    ...post,
    summary: summaries[index] || '',
  }))

  return {
    message: {
      role: 'assistant',
      content: '',
    },
    toolCalls: [
      {
        name: 'reddit',
        arguments: '{}',
        response: JSON.stringify(withSummary),
      },
    ],
    requiresApproval: false,
  }
}

const handleJoke = async (): Promise<ChatTurnResult> => {
  const jokeRes = await fetch('https://icanhazdadjoke.com/', {
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = (await jokeRes.json()) as { joke?: string }

  return {
    message: {
      role: 'assistant',
      content: '',
    },
    toolCalls: [
      {
        name: 'dad_joke',
        arguments: '{}',
        response: payload.joke || 'No joke available right now.',
      },
    ],
    requiresApproval: false,
  }
}

const handleGenericChat = async (messages: ChatMessage[]): Promise<ChatTurnResult> => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      message: {
        role: 'assistant',
        content:
          'OPENAI_API_KEY is not configured in this deployment, so chat cannot run yet.',
      },
      toolCalls: [],
      requiresApproval: false,
    }
  }

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise assistant. Keep responses clear and useful for a chat dashboard.',
        },
        ...messages,
      ],
    }),
  })

  if (!completion.ok) {
    const text = await completion.text()
    return {
      message: {
        role: 'assistant',
        content: `Model request failed: ${text.slice(0, 200)}`,
      },
      toolCalls: [],
      requiresApproval: false,
    }
  }

  const data = (await completion.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return {
    message: {
      role: 'assistant',
      content: data.choices?.[0]?.message?.content || 'No response generated.',
    },
    toolCalls: [],
    requiresApproval: false,
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  const body = getBody(req)
  const messages = body?.messages as ChatMessage[] | undefined

  if (!Array.isArray(messages) || messages.length === 0) {
    return json(res, 400, { error: 'Invalid request body. Expected { messages: ChatMessage[] }' })
  }

  const latest = getLatestUserMessage(messages)
  const normalized = latest.toLowerCase()

  try {
    if (/(reddit|nba)/i.test(normalized)) {
      const result = await handleReddit()
      return json(res, 200, result)
    }

    if (/(dad joke|joke)/i.test(normalized)) {
      const result = await handleJoke()
      return json(res, 200, result)
    }

    const result = await handleGenericChat(messages)
    return json(res, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return json(res, 500, { error: message })
  }
}
