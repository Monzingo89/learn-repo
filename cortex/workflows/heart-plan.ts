import { ArchitecturePatternFindings, SymbolInventory } from "../context/repo-brain.store.js";
import { FeatureChangeType, FEATURE_CHANGE_TYPE_DESCRIPTIONS } from "../enums/feature-change-type.enum.js";
import { BackendProtocol } from "../enums/backend-protocol.enum.js";

type HeartInput = {
  architecturePatterns?: ArchitecturePatternFindings;
  symbolInventory?: SymbolInventory;
  detectedTechnologies: Array<{ name: string }>;
  backendProtocols: BackendProtocol[];
};

function listOr(items: string[], fallback: string): string {
  if (items.length === 0) return `_${fallback}_`;
  return items.map((item) => `\`${item}\``).join(", ");
}

export function buildHeartMarkdown(input: HeartInput): string {
  const lines: string[] = [];

  lines.push("# HEART — Feature Work Plan");
  lines.push("");
  lines.push(
    "HEART captures how new functionality should be added across visual, frontend, backend, database, and infrastructure axes. Use this scaffold for every feature, refactor, or simplification proposed during CLEAN_REPO and SIMPLIFY_REPO phases."
  );
  lines.push("");

  for (const change of [
    FeatureChangeType.VISUAL,
    FeatureChangeType.FRONTEND,
    FeatureChangeType.BACKEND,
    FeatureChangeType.INFRA
  ]) {
    lines.push(`## ${change.toUpperCase()} changes`);
    lines.push(`> ${FEATURE_CHANGE_TYPE_DESCRIPTIONS[change]}`);
    lines.push("");
    lines.push("- Planned items: _to be populated during CLEAN_REPO / SIMPLIFY_REPO_");
    lines.push("- Acceptance criteria: _to be populated_");
    lines.push("");
  }

  lines.push("## DATABASE changes");
  lines.push(
    "> Schema, migrations, indexes, query performance, connection/security posture, and data integrity constraints."
  );
  lines.push("");
  lines.push("- Planned items: _to be populated during CLEAN_REPO / SIMPLIFY_REPO_");
  lines.push("- Acceptance criteria: _to be populated_");
  lines.push("");

  lines.push("## Current observations to seed the plan");
  lines.push("");
  lines.push(
    `- Detected backend protocols: ${listOr(input.backendProtocols, "no backend protocols detected")}`
  );
  lines.push(
    `- Detected technologies: ${listOr(
      input.detectedTechnologies.map((tech) => tech.name).slice(0, 12),
      "no technologies detected"
    )}`
  );

  if (input.symbolInventory) {
    lines.push(
      `- Symbol counts — interfaces: ${input.symbolInventory.interfaces.count}, classes: ${input.symbolInventory.classes.count}, enums: ${input.symbolInventory.enums.count}, type aliases: ${input.symbolInventory.types.count}`
    );
  }

  if (input.architecturePatterns) {
    lines.push(
      `- DDD evidence present: ${input.architecturePatterns.domainDrivenDesign.detected ? "yes" : "no"}`
    );
    lines.push(
      `- Multi-tenant evidence present: ${input.architecturePatterns.multiTenant.detected ? "yes" : "no"}`
    );
    lines.push(
      `- Identity provider: \`${input.architecturePatterns.identity.provider}\` (roles: ${input.architecturePatterns.identity.rolesUsed}, claims: ${input.architecturePatterns.identity.claimsUsed})`
    );
    lines.push(
      `- Database paradigm: \`${input.architecturePatterns.database.paradigm}\`; technologies: ${
        input.architecturePatterns.database.technologies.join(", ") || "_none_"
      }`
    );
  }

  lines.push("");
  lines.push("## Backend protocol enum reference");
  lines.push("");
  lines.push("| Enum value | Meaning |");
  lines.push("|---|---|");
  lines.push(`| \`${BackendProtocol.API}\` | HTTP/REST/GraphQL API |`);
  lines.push(`| \`${BackendProtocol.SOAP}\` | SOAP/XML-RPC style |`);
  lines.push(`| \`${BackendProtocol.OTHER}\` | gRPC, message bus, custom transport, etc. |`);

  return lines.join("\n");
}

export function inferBackendProtocols(content: string): BackendProtocol[] {
  const found = new Set<BackendProtocol>();

  if (/\b(express|fastify|@nestjs\/common|@nestjs\/core|koa|hapi|graphql|apollo-server|router\.(get|post|put|delete))\b/i.test(content)) {
    found.add(BackendProtocol.API);
  }
  if (/\b(soap|wsdl|xmlrpc)\b/i.test(content)) {
    found.add(BackendProtocol.SOAP);
  }
  if (/\b(grpc|@grpc\/|rabbitmq|amqplib|kafka|servicebus|sqs|sns)\b/i.test(content)) {
    found.add(BackendProtocol.OTHER);
  }

  return Array.from(found);
}
