import { ModelId } from "../enums/model.enum.js";
import { ModelRole } from "../enums/model-role.enum.js";
import { WorkUnit } from "../enums/work-unit.enum.js";

export type ModelConfig = {
  id: ModelId;
  role: ModelRole;
  provider: string;
  maxTokens: number;
  handoffAtPercent: number;
};

export const MODEL_REGISTRY: Record<ModelId, ModelConfig> = {
  [ModelId.DEFAULT_FAST]: {
    id: ModelId.DEFAULT_FAST,
    role: ModelRole.FAST_SCAN,
    provider: "openai",
    maxTokens: 120000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_REASONING]: {
    id: ModelId.DEFAULT_REASONING,
    role: ModelRole.DEEP_REASONING,
    provider: "openai",
    maxTokens: 120000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_LONG_CONTEXT]: {
    id: ModelId.DEFAULT_LONG_CONTEXT,
    role: ModelRole.LONG_CONTEXT,
    provider: "openai",
    maxTokens: 500000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_LOCAL]: {
    id: ModelId.DEFAULT_LOCAL,
    role: ModelRole.LOCAL_SAFE,
    provider: "local",
    maxTokens: 32000,
    handoffAtPercent: 80
  }
};

export function selectModelForWorkUnit(workUnit: WorkUnit): ModelId {
  switch (workUnit) {
    case WorkUnit.SCAN_FILE:
    case WorkUnit.CLASSIFY_FILE:
    case WorkUnit.DETECT_STRUCTURE:
      return ModelId.DEFAULT_FAST;

    case WorkUnit.DETECT_SMELLS:
    case WorkUnit.DETECT_NOISE:
    case WorkUnit.UPDATE_BRAIN:
      return ModelId.DEFAULT_REASONING;

    case WorkUnit.UNDERSTAND_REPO:
      return ModelId.DEFAULT_LONG_CONTEXT;

    default:
      return ModelId.DEFAULT_FAST;
  }
}
