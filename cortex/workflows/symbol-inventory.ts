import { SymbolInventory } from "../context/repo-brain.store.js";

export type SymbolInventoryAccumulator = SymbolInventory;

export function createSymbolInventory(): SymbolInventoryAccumulator {
  return {
    models: { count: 0, samplePaths: [] },
    interfaces: { count: 0, samplePaths: [] },
    classes: { count: 0, samplePaths: [] },
    enums: { count: 0, samplePaths: [] },
    types: { count: 0, samplePaths: [] }
  };
}

const PATTERNS = {
  interface: /\binterface\s+([A-Z][A-Za-z0-9_]*)\b/g,
  class: /\bclass\s+([A-Z][A-Za-z0-9_]*)\b/g,
  enum: /\benum\s+([A-Z][A-Za-z0-9_]*)\b/g,
  type: /\btype\s+([A-Z][A-Za-z0-9_]*)\s*=/g
};

const MODEL_PATH_HINT = /(^|\/)(models|domain|entities|aggregates|dto[s]?|view-?models)(\/|$)/i;

export function analyzeFileForSymbolInventory(
  relativePath: string,
  content: string,
  inventory: SymbolInventoryAccumulator
) {
  const buckets: Array<{ regex: RegExp; bucket: keyof SymbolInventoryAccumulator }> = [
    { regex: PATTERNS.interface, bucket: "interfaces" },
    { regex: PATTERNS.class, bucket: "classes" },
    { regex: PATTERNS.enum, bucket: "enums" },
    { regex: PATTERNS.type, bucket: "types" }
  ];

  let touchedThisFile = false;

  for (const { regex, bucket } of buckets) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    let matchedInFile = 0;

    while ((match = regex.exec(content)) !== null) {
      matchedInFile += 1;
    }

    if (matchedInFile > 0) {
      inventory[bucket].count += matchedInFile;

      if (inventory[bucket].samplePaths.length < 10) {
        inventory[bucket].samplePaths.push(relativePath);
      }

      touchedThisFile = true;
    }
  }

  if (touchedThisFile && MODEL_PATH_HINT.test(relativePath)) {
    inventory.models.count += 1;
    if (inventory.models.samplePaths.length < 10) {
      inventory.models.samplePaths.push(relativePath);
    }
  }
}

export function buildSymbolInventoryMarkdown(inventory: SymbolInventory): string {
  const rows = [
    ["Models (in domain/model dirs)", inventory.models],
    ["Interfaces", inventory.interfaces],
    ["Classes", inventory.classes],
    ["Enums", inventory.enums],
    ["Type aliases", inventory.types]
  ] as const;

  const lines: string[] = ["| Symbol | Count | Sample paths |", "|---|---|---|"];

  for (const [label, group] of rows) {
    const sample = group.samplePaths.slice(0, 3).join(", ") || "—";
    lines.push(`| ${label} | ${group.count} | ${sample} |`);
  }

  return lines.join("\n");
}
