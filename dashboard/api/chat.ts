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

type MovieCardData = {
  title: string
  year: string
  genre: string
  director: string
  actors: string
  rating: string
  description: string
}

type CharacterCardData = {
  name: string
  movie: string
  portrayedBy: string
  traits: string
  description: string
}

const setCorsHeaders = (res: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const json = (res: any, status: number, payload: unknown) => {
  setCorsHeaders(res)
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

const parseJsonFromModel = <T>(raw: string): T | null => {
  const trimmed = (raw || '').trim()
  const normalized = trimmed.startsWith('```')
    ? trimmed.replace(/```(?:json)?/g, '').trim()
    : trimmed

  try {
    return JSON.parse(normalized) as T
  } catch {
    return null
  }
}

const askModelForJson = async <T>(
  apiKey: string,
  systemContent: string,
  userContent: string,
  fallback: T
): Promise<T> => {
  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: systemContent,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  })

  if (!completion.ok) {
    return fallback
  }

  const data = (await completion.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content || ''
  return parseJsonFromModel<T>(content) ?? fallback
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

  const parsed = await askModelForJson<string[]>(
    apiKey,
    'You summarize social posts accurately and concisely.',
    prompt,
    []
  )

  return titles.map((_, i) => parsed[i] || '')
}

const handleMovieCards = async (query: string): Promise<ChatTurnResult> => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      message: {
        role: 'assistant',
        content: 'OPENAI_API_KEY is required for movie cards in this deployment.',
      },
      toolCalls: [],
      requiresApproval: false,
    }
  }

  const movies = await askModelForJson<MovieCardData[]>(
    apiKey,
    'You return structured movie recommendations only.',
    [
      `User request: ${query}`,
      'Return ONLY a JSON array with 4 to 8 objects.',
      'Each object must include: title, year, genre, director, actors, rating, description.',
      'Use concise, factual descriptions. No markdown.',
    ].join('\n'),
    []
  )

  return {
    message: {
      role: 'assistant',
      content: '',
    },
    toolCalls: [
      {
        name: 'movieSearch',
        arguments: JSON.stringify({ query }),
        response: JSON.stringify(movies),
      },
    ],
    requiresApproval: false,
  }
}

const handleCharacterCards = async (query: string): Promise<ChatTurnResult> => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      message: {
        role: 'assistant',
        content: 'OPENAI_API_KEY is required for character cards in this deployment.',
      },
      toolCalls: [],
      requiresApproval: false,
    }
  }

  const characters = await askModelForJson<CharacterCardData[]>(
    apiKey,
    'You return structured information about fictional movie characters.',
    [
      `User request: ${query}`,
      'Return ONLY a JSON array with 4 to 8 objects.',
      'Each object must include: name, movie, portrayedBy, traits, description.',
      'traits should be a short comma-separated list.',
      'No markdown.',
    ].join('\n'),
    []
  )

  return {
    message: {
      role: 'assistant',
      content: '',
    },
    toolCalls: [
      {
        name: 'characters',
        arguments: JSON.stringify({ query }),
        response: JSON.stringify(characters),
      },
    ],
    requiresApproval: false,
  }
}

const fallbackRedditCards = async () => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return [] as Array<{
      title: string
      link: string
      subreddit: string
      author: string
      upvotes: number
      summary: string
    }>
  }

  return askModelForJson(
    apiKey,
    'You return plausible, clearly marked synthetic social feed samples.',
    [
      'Reddit API is unavailable. Return synthetic NBA discussion cards to keep UI functional.',
      'Return ONLY a JSON array with 5 objects.',
      'Each object must include: title, link, subreddit, author, upvotes, summary.',
      'summary must be one concise sentence.',
      'Use link value https://reddit.com/r/nba for all objects.',
    ].join('\n'),
    []
  )
}

const handleReddit = async (): Promise<ChatTurnResult> => {
  let withSummary: Array<{
    title: string
    link: string
    subreddit: string
    author: string
    upvotes: number
    summary: string
  }> = []

  try {
    const reddit = await fetch('https://www.reddit.com/r/nba/hot.json?limit=8', {
      headers: {
        'User-Agent': 'agents-production-dashboard/1.0',
        Accept: 'application/json',
      },
    })

    if (!reddit.ok) {
      throw new Error(`Reddit API returned ${reddit.status}`)
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
    withSummary = posts.map((post: any, index: number) => ({
      ...post,
      summary: summaries[index] || '',
    }))
  } catch {
    withSummary = await fallbackRedditCards()
  }

  if (withSummary.length === 0) {
    return {
      message: {
        role: 'assistant',
        content: 'Failed to load Reddit posts right now. Try again shortly.',
      },
      toolCalls: [],
      requiresApproval: false,
    }
  }

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
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.statusCode = 204
    res.end()
    return
  }

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
    if (/(character|villain|hero|protagonist|antagonist)/i.test(normalized)) {
      const result = await handleCharacterCards(latest)
      return json(res, 200, result)
    }

    if (/(movie|movies|film|films|director|actor|actress|cinema|imdb|tarantino)/i.test(normalized)) {
      const result = await handleMovieCards(latest)
      return json(res, 200, result)
    }

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
