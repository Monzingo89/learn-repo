import { PromptId } from "../enums/prompt.enum.js";

export abstract class BasePrompt<TInput> {
  abstract id: PromptId;
  abstract system: string;

  constructor(protected input: TInput) {}

  abstract user(): string;

  build() {
    return {
      id: this.id,
      system: this.system.trim(),
      user: this.user().trim()
    };
  }
}
