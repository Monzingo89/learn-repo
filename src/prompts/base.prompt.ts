import { PromptId } from "../enums/prompt.enum.js";

export abstract class BasePrompt<TInput> {
  abstract id: PromptId;
  abstract system: string;

  protected input: TInput;

  constructor(input: TInput) {
    this.input = input;
  }

  abstract user(): string;

  build() {
    return {
      id: this.id,
      system: this.system.trim(),
      user: this.user().trim()
    };
  }
}
