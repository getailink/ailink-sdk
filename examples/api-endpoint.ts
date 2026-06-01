/**
 * AILink — Example Backend Endpoint
 * ─────────────────────────────────────────────────────────────
 * This is the backend route the AILink widget calls.
 * The widget POSTs to `/api/ailink` with { message, sessionId }.
 * Your server runs ai.run() and returns { response: string }.
 *
 * This example uses Express, but the same pattern works in
 * Next.js (App Router), Fastify, Hono, or any Node HTTP framework.
 *
 * Run:
 *   npx ts-node example/api-endpoint.ts
 *
 * Then open http://localhost:3000 and load the widget.
 * ─────────────────────────────────────────────────────────────
 */

import express from 'express'
import { AILink, Message } from '../src'

// ── 1. Initialise AILink ────────────────────────────────────────────────────

const ai = new AILink({
  apiKey:      'ailink-dev-key',          // Your AILink platform key
  provider:    'openai',                  // Change to 'claude', 'groq', or 'gemini'
  providerKey: process.env.OPENAI_KEY!,   // Set in your environment / .env file
  debug:       true,
})

// ── 2. Register your tools ──────────────────────────────────────────────────
//
// These are the functions the AI is allowed to call on behalf of the user.
// Use the preferred signature: register(name, execute, options)

ai.register(
  'getWeather',
  async ({ city }: { city: string }) => {
    // Replace with a real weather API call in production
    return `It's sunny and 22°C in ${city}.`
  },
  {
    description: 'Get the current weather for a city.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
      },
      required: ['city'],
    },
  }
)

ai.register(
  'getTime',
  async ({ timezone }: { timezone?: string }) => {
    const now = new Date()
    return timezone
      ? `Current time in ${timezone}: ${now.toLocaleTimeString('en-US', { timeZone: timezone })}`
      : `Current UTC time: ${now.toUTCString()}`
  },
  {
    description: 'Get the current time, optionally for a specific timezone.',
    parameters: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'IANA timezone name, e.g. "America/New_York"' },
      },
    },
  }
)

// ── 3. Session storage (in-memory for this example) ─────────────────────────
//
// For production, store session history in Redis or a database keyed by sessionId.
// Here we use a simple Map that resets when the server restarts.

const sessionStore = new Map<string, Message[]>()

// ── 4. Express server ────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

// Serve a minimal HTML page with the AILink widget for quick testing
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AILink Widget Demo</title>
</head>
<body>
  <h1 style="font-family:sans-serif;padding:40px">AILink Widget Demo</h1>
  <p style="font-family:sans-serif;padding:0 40px">
    Ask the assistant about the weather or current time.
  </p>

  <!-- AILink widget container -->
  <div
    id="ailink-widget"
    data-endpoint="/api/ailink"
    data-title="AI Assistant"
    data-position="bottom-right"
    data-theme="light"
  ></div>

  <!-- Load the compiled widget script -->
  <script src="/dist/widget/AILinkScript.js"></script>
</body>
</html>`)
})

// Serve the compiled dist folder so the widget script is accessible
app.use('/dist', express.static('dist'))

/**
 * POST /api/ailink
 *
 * Request body: { message: string, sessionId: string }
 * Response:     { response: string }
 *
 * The widget always sends both fields. sessionId is generated once
 * per page load inside the widget and kept stable across messages.
 */
app.post('/api/ailink', async (req, res) => {
  const { message, sessionId } = req.body

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  try {
    // Restore prior conversation history for this session (if any)
    const savedHistory = sessionStore.get(sessionId) ?? []
    const session = ai.createSession(sessionId, 50, savedHistory)

    // Run the user's message through the AI
    const result = await session.run(message)

    // Persist updated history for the next turn
    sessionStore.set(sessionId, session.getHistory())

    res.json({ response: result.response })
  } catch (err: any) {
    console.error('[AILink endpoint error]', err)
    res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// ── 5. Start ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`\nAILink example server running at http://localhost:${PORT}`)
  console.log('Open that URL and use the chat widget in the bottom-right corner.\n')
})
