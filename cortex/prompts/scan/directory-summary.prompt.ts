import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class DirectorySummaryPrompt extends BasePrompt<{
  directory: string;
  fileSummaries: string;
  currentContext: string;
}> {
  id = PromptId.DIRECTORY_SUMMARY;

  system = `
You summarize one directory after scanning its files.
Explain what this directory appears responsible for.
Return concise JSON only.
`;

  user() {
    return `
Directory:
${this.input.directory}

Current Context:
${this.input.currentContext}

File Summaries:
${this.input.fileSummaries}

Return JSON:
{
  "directoryPurpose": "",
  "importantFiles": [],
  "risks": [],
  "noise": [],
  "brainUpdate": "",
  "nextQuestions": []
}
`;
  }
}
