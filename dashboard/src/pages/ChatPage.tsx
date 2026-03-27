import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatToolTrace, ChatTurnResult } from '../types'
import { readErrorMessage, resolveApiUrl } from '../api'

type ChatBubble = ChatMessage & {
  toolCalls?: ChatToolTrace[]
  variant?: 'default' | 'error'
}

type MovieResult = {
  title: string
  year: string
  genre: string
  director: string
  actors: string
  rating: string
  description: string
}

type RedditPost = {
  title: string
  link: string
  subreddit: string
  author: string
  upvotes: number
  summary?: string
}

type ParsedToolData =
  | { type: 'movies'; data: MovieResult[] }
  | { type: 'reddit'; data: RedditPost[] }
  | { type: 'joke'; data: string }
  | null

const parseToolData = (toolCalls: ChatToolTrace[]): ParsedToolData => {
  if (!toolCalls.length) return null
  const call = toolCalls[0]
  try {
    if (call.name === 'movieSearch') {
      return { type: 'movies', data: JSON.parse(call.response) as MovieResult[] }
    }
    if (call.name === 'reddit') {
      return { type: 'reddit', data: JSON.parse(call.response) as RedditPost[] }
    }
    if (call.name === 'dad_joke') {
      return { type: 'joke', data: call.response }
    }
  } catch {
    return null
  }
  return null
}

const MovieCard = ({ movie }: { movie: MovieResult }) => {
  const seed = encodeURIComponent((movie.title ?? 'movie').replace(/\s+/g, '-'))
  const rating = parseFloat(movie.rating ?? '0')
  const stars = Math.min(5, Math.round(rating / 2))
  return (
    <article className="movie-card">
      <img
        src={`https://picsum.photos/seed/${seed}/280/420`}
        alt={movie.title}
        className="movie-card-img"
        loading="lazy"
      />
      <div className="movie-card-body">
        <div className="movie-card-header">
          <h3>{movie.title}</h3>
          {movie.year && <span className="movie-year">{movie.year}</span>}
        </div>
        {movie.genre && (
          <span className="genre-badge">{movie.genre.split(',')[0].trim()}</span>
        )}
        {rating > 0 && (
          <div className="star-rating">
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
            <span>{movie.rating}/10</span>
          </div>
        )}
        {movie.director && <p className="movie-meta">🎬 {movie.director}</p>}
        {movie.actors && (
          <p className="movie-meta">
            🎭 {movie.actors.split(',').slice(0, 2).join(', ')}
          </p>
        )}
        {movie.description && (
          <p className="movie-description">
            {movie.description.length > 180
              ? `${movie.description.slice(0, 180)}…`
              : movie.description}
          </p>
        )}
      </div>
    </article>
  )
}

const RedditCard = ({ post }: { post: RedditPost }) => (
  <article className="reddit-card">
    <div className="reddit-card-meta">
      <span className="reddit-sub">{post.subreddit}</span>
      <span className="reddit-upvotes">▲ {post.upvotes.toLocaleString()}</span>
    </div>
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className="reddit-title"
    >
      {post.title}
    </a>
    {post.summary && <p className="reddit-summary">{post.summary}</p>}
    <p className="reddit-author">u/{post.author}</p>
  </article>
)

const JokeCard = ({ joke }: { joke: string }) => (
  <div className="joke-card">
    <div className="joke-icon">😂</div>
    <p className="joke-text">{joke}</p>
  </div>
)

const ToolCards = ({ toolCalls }: { toolCalls: ChatToolTrace[] }) => {
  const parsed = parseToolData(toolCalls)
  if (!parsed) return null

  if (parsed.type === 'movies') {
    return (
      <div className="result-cards">
        {parsed.data.map((movie) => (
          <MovieCard key={movie.title} movie={movie} />
        ))}
      </div>
    )
  }

  if (parsed.type === 'reddit') {
    return (
      <div className="result-cards reddit-grid">
        {parsed.data.slice(0, 8).map((post) => (
          <RedditCard key={post.link} post={post} />
        ))}
      </div>
    )
  }

  if (parsed.type === 'joke') {
    return <JokeCard joke={parsed.data} />
  }

  return null
}

const STARTER_PROMPTS = [
  'Tell me a dad joke.',
  'What is something interesting from Reddit right now?',
  'Find Quentin Tarantino movies and summarize them.',
]

const initialMessages: ChatBubble[] = [
  {
    role: 'assistant',
    content:
      'Ask about movies, Reddit, or quick jokes. Movie questions can trigger the RAG-backed Upstash vector search.',
  },
]

const toApiMessages = (messages: ChatBubble[]): ChatMessage[] => {
  return messages.map(({ role, content }) => ({ role, content }))
}

const ChatPage = () => {
  const [messages, setMessages] = useState<ChatBubble[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isSending, messages])

  const sendMessage = async (draft?: string) => {
    const nextInput = (draft ?? input).trim()

    if (!nextInput || isSending) {
      return
    }

    const userMessage: ChatBubble = {
      role: 'user',
      content: nextInput,
    }

    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setError(null)
    setIsSending(true)

    try {
      const response = await fetch(resolveApiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: toApiMessages(nextMessages) }),
      })

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Chat request failed')
        throw new Error(message)
      }

      const payload = (await response.json()) as ChatTurnResult

      setMessages((current) => [
        ...current,
        {
          ...payload.message,
          toolCalls: payload.toolCalls,
        },
      ])
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reach the chat service.'

      setError(message)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `The chat service failed: ${message}`,
          variant: 'error',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="chat-layout">
      <aside className="chat-sidebar panel">
        <div>
          <p className="eyebrow">Live Agent</p>
          <h2>Conversational UI</h2>
          <p className="section-copy">
            This page talks to the real agent backend through a small HTTP
            endpoint. Tool traces are exposed so you can see when RAG or other
            capabilities were actually used.
          </p>
        </div>

        <div className="prompt-list">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => {
                void sendMessage(prompt)
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="info-card">
          <h3>RAG Connection</h3>
          <p>
            Movie prompts can trigger the movie search tool, which queries the
            Upstash vector index through the server-side agent runtime.
          </p>
        </div>
      </aside>

      <section className="chat-panel panel">
        <div className="chat-header">
          <div>
            <p className="eyebrow">Session</p>
            <h2>Chat with Troll</h2>
          </div>
          <span className={`status-pill ${isSending ? 'busy' : 'ready'}`}>
            {isSending ? 'Thinking...' : 'API Ready'}
          </span>
        </div>

        <div className="message-list" aria-live="polite">
          {messages.map((message, index) => {
            const toolData = message.toolCalls ? parseToolData(message.toolCalls) : null
            const hasCards = toolData !== null
            return (
              <article
                key={`${message.role}-${index}`}
                className={`message-bubble ${message.role} ${message.variant || ''} ${hasCards ? 'has-cards' : ''}`}
              >
                <p className="message-role">{message.role}</p>
                {message.content && !hasCards && (
                  <p className="message-content">{message.content}</p>
                )}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  hasCards
                    ? <ToolCards toolCalls={message.toolCalls} />
                    : (
                      <details className="tool-trace">
                        <summary>Tool activity</summary>
                        {message.toolCalls.map((toolCall) => (
                          <div key={`${toolCall.name}-${toolCall.arguments}`}>
                            <strong>{toolCall.name}</strong>
                            <pre>{toolCall.arguments}</pre>
                            <pre>{toolCall.response}</pre>
                          </div>
                        ))}
                      </details>
                    )
                )}
              </article>
            )
          })}

          {isSending ? (
            <article className="message-bubble assistant pending">
              <p className="message-role">assistant</p>
              <p className="message-content">Working through the request...</p>
            </article>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage()
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about movies, Reddit, or anything the configured tools can handle..."
            rows={3}
          />
          <div className="composer-footer">
            <p>{error ? `Last error: ${error}` : 'Tool traces appear under assistant replies.'}</p>
            <button type="submit" disabled={isSending || input.trim().length === 0}>
              Send
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}

export default ChatPage