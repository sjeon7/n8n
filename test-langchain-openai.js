const { ChatOpenAI } = require('@langchain/openai');
const { randomUUID } = require('node:crypto');
const { HumanMessage } = require('@langchain/core/messages');
const { DynamicStructuredTool } = require('@langchain/classic/tools');
const { z } = require('zod');

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
  maxRetries: 0,
  timeout: 30000,
  streaming: false,
  supportsStrictToolCalling: false,
});

// ── Test 1: Simple invoke (already works) ──
async function test1() {
  console.log('=== Test 1: Simple invoke ===');
  try {
    const r = await model.invoke('hello');
    console.log('OK:', r.content.substring(0, 200));
  } catch (e) {
    console.error('FAIL:', e.message);
  }
}

// ── Test 2: bindTools (what AI Agent does) ──
async function test2() {
  console.log('\n=== Test 2: bindTools (AI Agent style) ===');
  const dummyTool = new DynamicStructuredTool({
    name: 'get_weather',
    description: 'Get weather for a city',
    schema: z.object({ city: z.string() }),
    func: async ({ city }) => `Weather in ${city}: sunny`,
  });

  try {
    const modelWithTools = model.bindTools([dummyTool]);
    const r = await modelWithTools.invoke([new HumanMessage('What is the weather in Seoul?')]);
    console.log('OK:', JSON.stringify(r.content).substring(0, 200));
    console.log('Tool calls:', JSON.stringify(r.tool_calls).substring(0, 300));
  } catch (e) {
    console.error('FAIL:', e.message);
    if (e.cause) console.error('CAUSE:', e.cause);
  }
}

// ── Test 3: bindTools with empty tools array ──
async function test3() {
  console.log('\n=== Test 3: bindTools with empty array ===');
  try {
    const modelWithTools = model.bindTools([]);
    const r = await modelWithTools.invoke([new HumanMessage('hello')]);
    console.log('OK:', r.content.substring(0, 200));
  } catch (e) {
    console.error('FAIL:', e.message);
    if (e.cause) console.error('CAUSE:', e.cause);
  }
}

test1().then(() => test2()).then(() => test3());
