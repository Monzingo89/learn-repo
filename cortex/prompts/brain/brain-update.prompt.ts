import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class BrainUpdatePrompt extends BasePrompt<{
  context: string;
}> {
  id = PromptId.BRAIN_UPDATE;

  system = `
You update BRAIN.md from current repo observations.
Be concise.
Preserve durable understanding only.
Do not include raw logs.
`;

  user() {
    return `
Current Global Context:
${this.input.context}

Write a concise Brain update with:
- repo purpose if known
- architecture understanding
- important flows
- risks
- simplification strategy
- next recommended action
`;
  }
}
