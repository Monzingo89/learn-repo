import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class FileScanPrompt extends BasePrompt<{
  filePath: string;
  fileContent: string;
  currentBrain: string;
}> {
  id = PromptId.FILE_SCAN;

  system = `
You are scanning a repository.
Stay technology-agnostic.
Do not refactor.
Do not invent missing facts.
Return concise JSON only.
Classify findings for EYES, NOSE, EARS, and BRAIN.
`;

  user() {
    return `
Current Brain Context:
${this.input.currentBrain}

File Path:
${this.input.filePath}

File Content:
${this.input.fileContent}

Return JSON:
{
  "eyes": [
    {
      "title": "",
      "summary": "",
      "evidence": []
    }
  ],
  "nose": [
    {
      "title": "",
      "summary": "",
      "severity": "low|medium|high|critical",
      "evidence": [],
      "suggestedAction": ""
    }
  ],
  "ears": [
    {
      "title": "",
      "summary": "",
      "evidence": [],
      "simplerDirection": ""
    }
  ],
  "brain": [
    {
      "title": "",
      "summary": "",
      "evidence": []
    }
  ]
}
`;
  }
}
