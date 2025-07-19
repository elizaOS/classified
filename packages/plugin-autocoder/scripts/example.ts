import { query, type SDKMessage } from "@anthropic-ai/claude-code";





const messages: SDKMessage[] = [];

for await (const message of query({
  prompt: "Write a haiku about README.md",
  abortController: new AbortController(),
  options: {
    maxTurns: 3,
  },
})) {
  messages.push(message);
}

console.log(messages);
