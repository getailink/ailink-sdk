// ─────────────────────────────────────────────
// AILink + LangChain — ai.wrap() Live Example
// Proves: your LangChain chain runs untouched.
// AILink tracks it in one line. Zero rewrites.
// Run: npx ts-node examples/wrap-langchain-example.ts
// ─────────────────────────────────────────────

import { AILink } from '../src'
import { ChatGroq } from '@langchain/groq'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

// ── Your existing LangChain chain ─────────────────────────
// This is production LangChain code. Not changing a single line.
// This is exactly what a developer already has before adding AILink.

const model = new ChatGroq({
  apiKey: process.env.GROQ_KEY,
  model: 'llama-3.3-70b-versatile'
})
const prompt = ChatPromptTemplate.fromTemplate(
  'Answer this question in one sentence: {question}'
)
const chain = prompt.pipe(model).pipe(new StringOutputParser())

// ── AILink sits on top — chain above is never touched ─────

const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY || '',
  debug: true
})

// ── Main ──────────────────────────────────────────────────

async function main() {
  if (!process.env.GROQ_KEY) {
    console.error('❌ GROQ_KEY not found in .env')
    process.exit(1)
  }

  console.log('═'.repeat(60))
  console.log('AILink + LangChain — ai.wrap() Live Proof')
  console.log('Chain runs untouched. AILink tracks it. One line.')
  console.log('═'.repeat(60))

  // STEP 1: Your LangChain chain running exactly as it always has.
  // No AILink. No changes. This is your existing production code.

  const rawResult = await chain.invoke({
    question: 'What is the capital of Japan?'
  })
  console.log('\n── Step 1: LangChain alone ──────────────────────────')
  console.log('Question: What is the capital of Japan?')
  console.log('Answer  :', rawResult)
  console.log('AILink  : not involved — chain ran as normal')

  // STEP 2: Same chain. One line added. Nothing changed in the chain.
  // ai.wrap() sits on top — chain runs identically.
  // The only difference: AILink now tracks every call.

  const simpleWrapped = ai.wrap(chain.invoke.bind(chain))
  const result2 = await simpleWrapped({
    question: 'What is the tallest mountain on Earth?'
  })
  console.log('\n── Step 2: Wrapped — simple mode ───────────────────')
  console.log('Question: What is the tallest mountain on Earth?')
  console.log('Answer  :', result2)
  console.log('AILink  : tracked as "bound invoke" — works but not ideal for dashboard')

  // STEP 3: Same chain. Same one line. Now with toolName and role.
  // Dashboard receives a real name and real role context.
  // This is how production teams use ai.wrap().

  const namedWrapped = ai.wrap(chain.invoke.bind(chain), {
    toolName: 'FactGeneratorChain',
    role: 'admin'
  })
  const result3 = await namedWrapped({
    question: 'What is the speed of light?'
  })
  console.log('\n── Step 3: Wrapped — full dashboard visibility ──────')
  console.log('Question: What is the speed of light?')
  console.log('Answer  :', result3)
  console.log('AILink  : tracked as "FactGeneratorChain" | role: admin')

  console.log('\n' + '═'.repeat(60))
  console.log('PROOF COMPLETE — What just happened:')
  console.log('')
  console.log('✅ Step 1: LangChain chain ran with zero AILink involvement')
  console.log('✅ Step 2: Same chain — ai.wrap() added tracking in one line')
  console.log('✅ Step 3: Same chain — dashboard now gets real name and role')
  console.log('')
  console.log('The chain was never touched. Not in Step 1. Not in Step 2.')
  console.log('Not in Step 3. AILink sat on top the entire time.')
  console.log('═'.repeat(60))
}

main().catch(console.error)
