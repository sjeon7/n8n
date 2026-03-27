const { ChatOpenAI } = require('@langchain/openai');
const { randomUUID } = require('node:crypto');

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
});

model.invoke('hello')
  .then(r => console.log('OK:', r.content.substring(0, 200)))
  .catch(e => {
    console.error('FAIL:', e.message);
    console.error('CAUSE:', e.cause ?? 'none');
    console.error('STACK:', e.stack?.substring(0, 500));
  });
