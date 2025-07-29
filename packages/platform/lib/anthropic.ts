import Anthropic from '@anthropic-ai/sdk';

const availableModels = {
  sonnet: 'claude-3-5-sonnet-20241022',
  haiku: 'claude-3-5-haiku-20241022',
  opus: 'claude-3-5-opus-20240229',
};

type ModelType = 'sonnet' | 'haiku' | 'opus';
type MessageRole = 'user' | 'assistant';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function estimateTokens(text: string): number {
  // rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

export async function createAnthropicMessage({
  model = 'sonnet',
  role = 'user',
  message = '',
  maxTokens = 1024,
  temperature = 0,
}: {
  model?: ModelType;
  role?: MessageRole;
  message?: string;
  maxTokens?: number;
  temperature?: number;
}) {
  if (message.trim().length === 0) {
    throw new Error('Empty message provided.');
  }

  try {
    const msg = await anthropic.messages.create({
      model: availableModels[model],
      max_tokens: maxTokens,
      messages: [{ role, content: message.trim() }],
      temperature,
    });

    console.log(msg);

    return msg;
  } catch (e) {
    console.error('Error creating anthropic message: ', e);
    throw new Error('Error creating anthropic message');
  }
}
