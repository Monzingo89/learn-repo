import fs from "fs";
import path from "path";
import { ModelId } from "../enums/model.enum.js";

export type TokenRecord = {
  modelId: ModelId;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  workUnits: number;
};

export type TokenLedger = Partial<Record<ModelId, TokenRecord>>;

const tokenPath = path.join(process.cwd(), ".cortex", "token-usage.json");

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function readTokenLedger(): TokenLedger {
  if (!fs.existsSync(tokenPath)) return {};
  return JSON.parse(fs.readFileSync(tokenPath, "utf8") || "{}");
}

export function recordTokenUsage(
  modelId: ModelId,
  inputText: string,
  outputText: string
): TokenRecord {
  const ledger = readTokenLedger();

  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const totalTokens = inputTokens + outputTokens;

  const existing = ledger[modelId] || {
    modelId,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    workUnits: 0
  };

  const updated: TokenRecord = {
    modelId,
    inputTokens: existing.inputTokens + inputTokens,
    outputTokens: existing.outputTokens + outputTokens,
    totalTokens: existing.totalTokens + totalTokens,
    workUnits: existing.workUnits + 1
  };

  ledger[modelId] = updated;
  fs.writeFileSync(tokenPath, JSON.stringify(ledger, null, 2), "utf8");

  return updated;
}

export function shouldHandoff(modelId: ModelId, maxTokens: number, percent = 80): boolean {
  const ledger = readTokenLedger();
  const used = ledger[modelId]?.totalTokens || 0;
  return used >= maxTokens * (percent / 100);
}
