# Project Guidelines

## Code Style
- Use TypeScript ESM style already used in the repo (`import`/`export`, top-level `await` where applicable).
- Keep changes minimal and local. Prefer matching existing patterns in nearby files over introducing new abstractions.
- For tools under `src/tools/`, follow the existing pair pattern:
  - export `<name>ToolDefinition` with a Zod schema and description
  - export async `<name>` implementation

## Architecture
- Root CLI agent app:
  - `index.ts`: CLI entry point (`process.argv[2]` user message)
  - `src/agent.ts`: core agent loop, tool-call handling, image approval flow
  - `src/llm.ts`: OpenAI chat calls, tool wiring (`zodFunction`), approval classifier
  - `src/memory.ts`: `lowdb` persistence in `db.json`, short history + summary
  - `src/toolRunner.ts` and `src/tools/*`: tool dispatch and implementations
- Evals:
  - `evals/run.ts`: dynamic loader for `evals/experiments/*.eval.ts`
  - `evals/evalTools.ts`, `evals/scorers.ts`: eval execution and scoring
- Dashboard (`dashboard/`): separate React + Vite app for visualizing eval results.

## Build and Test
- Install dependencies (root): `npm install` (or `bun install`)
- Run agent (root): `npm start -- "<message>"`
- Run evals (root):
  - all: `bun run eval`
  - single: `bun run eval <name>`
- Build vector index for movie search (root): `bun run ingest`
- Dashboard commands (`dashboard/`):
  - install: `bun install`
  - dev: `bun run dev`
  - build: `bun run build`
  - lint: `bun run lint`

## Conventions
- The agent is intentionally single-tool-per-turn (`parallel_tool_calls: false` in `src/llm.ts`). Preserve this unless explicitly changing behavior.
- Tool names in definitions are snake_case (for model tool calling), while TypeScript symbols are camelCase.
- Reuse shared types from `types.ts` (`AIMessage`, `ToolFn`, eval result types) instead of re-declaring local variants.
- Preserve approval gating for image generation in `src/agent.ts`.

## Environment and Pitfalls
- Required env vars for normal operation:
  - `OPENAI_API_KEY`
  - `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` (for RAG/movie search)
- Stateful files:
  - `db.json` stores conversation memory
  - `results.json` stores eval outputs
- Windows note: dynamic eval imports may be environment-sensitive; see the root README workaround.

## Docs
- Project setup, env, and platform notes: `README.md`
- Dashboard details: `dashboard/README.md`
- Link to these docs instead of duplicating setup details in code comments or instructions.
