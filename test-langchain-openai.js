const { ChatOpenAI } = require('@langchain/openai');
const { randomUUID } = require('node:crypto');
const { BaseCallbackHandler } = require('@langchain/core/callbacks/base');

// Simulate N8nLlmTracing-like callback
class DebugTracing extends BaseCallbackHandler {
  name = 'DebugTracing';
  async handleLLMStart(llm, prompts) {
    console.log('[TRACE] LLM Start, prompts:', JSON.stringify(prompts).substring(0, 200));
  }
  async handleLLMEnd(output) {
    console.log('[TRACE] LLM End, output:', JSON.stringify(output).substring(0, 300));
  }
  async handleLLMError(err) {
    console.error('[TRACE] LLM Error:', err.message);
  }
}

// --- Test 1: Minimal (already working) ---
// --- Test 2: With callbacks + onFailedAttempt (matches n8n node) ---
const model = new ChatOpenAI({
  apiKey: 'your-api-key-here',
  model: 'your-model-name',
  temperature: 0.7,
  configuration: {
    baseURL: 'https://your-api-endpoint.example.com/v1',
    defaultHeaders: {
      'X-Custom-Header-1': 'fixed-value-1',
      'X-Custom-Header-2': 'fixed-value-2',
      'X-Custom-Header-3': 'fixed-value-3',
      'X-Custom-Header-4': 'fixed-value-4',
      'X-Request-UUID-1': randomUUID(),
      'X-Request-UUID-2': randomUUID(),
    },
  },
  maxRetries: 2,
  timeout: 30000,
  streaming: false,
  callbacks: [new DebugTracing()],
  onFailedAttempt: (error) => {
    console.error('[RETRY] Attempt', error.attemptNumber, 'failed:', error.message);
  },
  supportsStrictToolCalling: false,
  modelKwargs: undefined,
});

console.log('=== Test: ChatOpenAI with callbacks (n8n-like) ===');
model.invoke('hello')
  .then(r => console.log('OK:', r.content.substring(0, 200)))
  .catch(e => {
    console.error('FAIL:', e.message);
    console.error('CAUSE:', e.cause ?? 'none');
  });
