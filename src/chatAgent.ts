import type { AIMessage, ChatMessage, ChatToolTrace, ChatTurnResult } from '../types'
import { runLLM } from './llm'
import { runTool } from './toolRunner'
import { generateImageToolDefinition } from './tools/generateImage'

const toAIMessages = (messages: ChatMessage[]): AIMessage[] => {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

const getLatestUserMessage = (messages: ChatMessage[]) => {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
}

export const runChatTurn = async ({
  messages,
  tools,
}: {
  messages: ChatMessage[]
  tools: any[]
}): Promise<ChatTurnResult> => {
  const history = toAIMessages(messages)
  const toolCalls: ChatToolTrace[] = []
  const latestUserMessage = getLatestUserMessage(messages)

  while (true) {
    const response = await runLLM({
      messages: history,
      tools,
      summary: '',
    })

    history.push(response)

    if (response.content) {
      return {
        message: {
          role: 'assistant',
          content: response.content,
        },
        toolCalls,
        requiresApproval: false,
      }
    }

    const toolCall = response.tool_calls?.[0]

    if (!toolCall) {
      return {
        message: {
          role: 'assistant',
          content: 'The agent did not return a usable response. Try a more specific prompt.',
        },
        toolCalls,
        requiresApproval: false,
      }
    }

    if (toolCall.function.name === generateImageToolDefinition.name) {
      toolCalls.push({
        name: toolCall.function.name,
        arguments: toolCall.function.arguments || '{}',
        response: 'Image generation still requires approval in the CLI flow and is not enabled in the web chat yet.',
      })

      return {
        message: {
          role: 'assistant',
          content:
            'Image generation still requires approval in the CLI flow, so the web chat blocks that tool for now.',
        },
        toolCalls,
        requiresApproval: true,
      }
    }

    const toolResponse = await runTool(toolCall, latestUserMessage)

    toolCalls.push({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments || '{}',
      response: toolResponse,
    })

    history.push({
      role: 'tool',
      content: toolResponse,
      tool_call_id: toolCall.id,
    })
  }
}