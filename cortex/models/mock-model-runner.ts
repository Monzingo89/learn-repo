import { ModelId } from "../enums/model.enum.js";

export async function runModel(modelId: ModelId, prompt: { system: string; user: string }) {
  return JSON.stringify({
    modelId,
    note: "Mock model response. Replace this with real provider call.",
    eyes: [],
    nose: [],
    ears: [],
    brain: [
      {
        title: "File scanned",
        summary: "The file was scanned by the prompt pipeline.",
        evidence: ["Mock runner executed"]
      }
    ]
  });
}
