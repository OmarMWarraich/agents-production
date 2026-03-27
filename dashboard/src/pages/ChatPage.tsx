import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatToolTrace, ChatTurnResult } from '../../../types'

type ChatBubble = ChatMessage & {
  toolCalls?: ChatToolTrace[]
  variant?: 'default' | 'error'
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: toApiMessages(nextMessages) }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || 'Chat request failed')
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
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`message-bubble ${message.role} ${message.variant || ''}`}
            >
              <p className="message-role">{message.role}</p>
              <p className="message-content">{message.content}</p>

              {message.toolCalls && message.toolCalls.length > 0 ? (
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
              ) : null}
            </article>
          ))}

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