import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class ContextHandoffPrompt extends BasePrompt<{
  fromModel: string;
  toModel: string;
  context: string;
}> {
  id = PromptId.CONTEXT_HANDOFF;

  system = `
You create a handoff summary for another model.
Compress aggressively.
Preserve only facts, decisions, risks, and next steps.
`;

  user() {
    return `
From Model:
${this.input.fromModel}

To Model:
${this.input.toModel}

Current Context:
${this.input.context}

Return JSON:
{
  "activeTask": "",
  "taskProgress": [
    {
      "task": "",
      "status": "",
      "completedItems": 0,
      "remainingItems": 0
    }
  ],
  "completedWork": [],
  "remainingWork": [],
  "durableFacts": [],
  "risks": [],
  "openQuestions": [],
  "nextStep": ""
}
`;
  }
}
