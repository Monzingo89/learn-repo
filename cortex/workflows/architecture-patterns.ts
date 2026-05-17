import { ArchitecturePatternFindings } from "../context/repo-brain.store.js";
import { DbParadigm } from "../enums/db-paradigm.enum.js";
import { IdentityProvider } from "../enums/identity-provider.enum.js";

export type ArchitecturePatternAccumulator = {
  dddEvidence: Set<string>;
  multiTenantEvidence: Set<string>;
  identityEvidence: Map<IdentityProvider, Set<string>>;
  rolesEvidence: Set<string>;
  claimsEvidence: Set<string>;
  databaseTechnologies: Set<string>;
  databaseEvidence: Set<string>;
};

export function createArchitecturePatternAccumulator(): ArchitecturePatternAccumulator {
  return {
    dddEvidence: new Set(),
    multiTenantEvidence: new Set(),
    identityEvidence: new Map(),
    rolesEvidence: new Set(),
    claimsEvidence: new Set(),
    databaseTechnologies: new Set(),
    databaseEvidence: new Set()
  };
}

const DDD_PATH_HINTS = [
  /(^|\/)domain\//i,
  /(^|\/)aggregates?\//i,
  /(^|\/)entities\//i,
  /(^|\/)value-?objects?\//i,
  /(^|\/)bounded-?contexts?\//i,
  /(^|\/)application\//i,
  /(^|\/)infrastructure\//i
];

const DDD_CONTENT_HINTS = [
  /\b(Aggregate(Root)?|ValueObject|DomainEvent|BoundedContext|Repository<|UnitOfWork)\b/
];

const MULTI_TENANT_HINTS = [
  /\btenant[_-]?id\b/i,
  /\bx-tenant\b/i,
  /\bTenantContext\b/,
  /\bITenant\b/,
  /\bmulti[\s-]?tenant\b/i
];

const IDENTITY_HINTS: Array<{ provider: IdentityProvider; regex: RegExp }> = [
  { provider: IdentityProvider.ENTRA_ID, regex: /(@azure\/msal|microsoft-?graph|entra|azuread|aad-msal)/i },
  { provider: IdentityProvider.AUTH0, regex: /(auth0|@auth0\/)/i },
  { provider: IdentityProvider.IDENTITY_SERVER, regex: /(IdentityServer4|Duende\.IdentityServer)/i },
  { provider: IdentityProvider.KEYCLOAK, regex: /(keycloak)/i },
  { provider: IdentityProvider.OKTA, regex: /(@okta\/|okta-)/i },
  { provider: IdentityProvider.COGNITO, regex: /(cognito|amazon-cognito)/i },
  { provider: IdentityProvider.FIREBASE_AUTH, regex: /(firebase\/auth|firebase-admin\/auth)/i }
];

const ROLES_HINTS = [/\[Authorize\(Roles\s*=/i, /\bhasRole\(/i, /\brolesAllowed\b/i, /\brequiredRoles?\b/i];
const CLAIMS_HINTS = [/\bClaimsPrincipal\b/i, /\bClaimTypes\./i, /\bhasClaim\(/i, /\baccess_token\b/i];

const DB_PATTERNS: Array<{ tech: string; paradigm: DbParadigm; regex: RegExp }> = [
  { tech: "PostgreSQL", paradigm: DbParadigm.RELATIONAL, regex: /\b(postgres(ql)?|pg\b|node-postgres)/i },
  { tech: "MySQL", paradigm: DbParadigm.RELATIONAL, regex: /\b(mysql|mariadb)\b/i },
  { tech: "SQL Server", paradigm: DbParadigm.RELATIONAL, regex: /\b(mssql|sql\s?server|tedious)\b/i },
  { tech: "SQLite", paradigm: DbParadigm.RELATIONAL, regex: /\bsqlite\b/i },
  { tech: "MongoDB", paradigm: DbParadigm.DOCUMENT, regex: /\b(mongodb|mongoose)\b/i },
  { tech: "CosmosDB", paradigm: DbParadigm.DOCUMENT, regex: /\b(cosmos\s?db|@azure\/cosmos)\b/i },
  { tech: "DynamoDB", paradigm: DbParadigm.KEY_VALUE, regex: /\bdynamodb\b/i },
  { tech: "Redis", paradigm: DbParadigm.KEY_VALUE, regex: /\b(redis|ioredis)\b/i },
  { tech: "Cassandra", paradigm: DbParadigm.WIDE_COLUMN, regex: /\bcassandra\b/i },
  { tech: "Neo4j", paradigm: DbParadigm.GRAPH, regex: /\bneo4j\b/i },
  { tech: "Elasticsearch", paradigm: DbParadigm.SEARCH, regex: /\b(elasticsearch|@elastic\/)/i },
  { tech: "InfluxDB", paradigm: DbParadigm.TIME_SERIES, regex: /\binflux(db)?\b/i }
];

export function analyzeFileForArchitecturePatterns(
  relativePath: string,
  content: string,
  accumulator: ArchitecturePatternAccumulator
) {
  for (const pattern of DDD_PATH_HINTS) {
    if (pattern.test(relativePath)) accumulator.dddEvidence.add(relativePath);
  }
  for (const pattern of DDD_CONTENT_HINTS) {
    if (pattern.test(content)) accumulator.dddEvidence.add(relativePath);
  }

  for (const pattern of MULTI_TENANT_HINTS) {
    if (pattern.test(content)) accumulator.multiTenantEvidence.add(relativePath);
  }

  for (const { provider, regex } of IDENTITY_HINTS) {
    if (regex.test(content)) {
      const set = accumulator.identityEvidence.get(provider) || new Set<string>();
      set.add(relativePath);
      accumulator.identityEvidence.set(provider, set);
    }
  }

  for (const pattern of ROLES_HINTS) {
    if (pattern.test(content)) accumulator.rolesEvidence.add(relativePath);
  }
  for (const pattern of CLAIMS_HINTS) {
    if (pattern.test(content)) accumulator.claimsEvidence.add(relativePath);
  }

  for (const { tech, paradigm, regex } of DB_PATTERNS) {
    if (regex.test(content)) {
      accumulator.databaseTechnologies.add(`${tech}::${paradigm}`);
      accumulator.databaseEvidence.add(relativePath);
    }
  }
}

function confidenceFromCount(count: number): "low" | "medium" | "high" {
  if (count >= 6) return "high";
  if (count >= 2) return "medium";
  if (count >= 1) return "low";
  return "low";
}

export function finalizeArchitecturePatterns(
  accumulator: ArchitecturePatternAccumulator
): ArchitecturePatternFindings {
  const dddSamples = Array.from(accumulator.dddEvidence).slice(0, 8);
  const tenantSamples = Array.from(accumulator.multiTenantEvidence).slice(0, 8);

  let provider: IdentityProvider = IdentityProvider.NONE;
  let bestCount = 0;
  const identityEvidenceLines: string[] = [];

  for (const [candidate, set] of accumulator.identityEvidence.entries()) {
    if (set.size > bestCount) {
      bestCount = set.size;
      provider = candidate;
    }
    identityEvidenceLines.push(`${candidate}: ${set.size} file(s)`);
  }

  if (provider === IdentityProvider.NONE && (accumulator.rolesEvidence.size > 0 || accumulator.claimsEvidence.size > 0)) {
    provider = IdentityProvider.CUSTOM;
  }

  const technologies = Array.from(accumulator.databaseTechnologies).map((entry) => entry.split("::")[0]);
  let paradigm: DbParadigm = DbParadigm.UNKNOWN;
  const paradigmCounts = new Map<DbParadigm, number>();
  for (const entry of accumulator.databaseTechnologies) {
    const parsed = entry.split("::")[1] as DbParadigm;
    paradigmCounts.set(parsed, (paradigmCounts.get(parsed) || 0) + 1);
  }
  for (const [candidate, count] of paradigmCounts.entries()) {
    if (count > 0 && (paradigm === DbParadigm.UNKNOWN || (paradigmCounts.get(paradigm) || 0) < count)) {
      paradigm = candidate;
    }
  }

  return {
    domainDrivenDesign: {
      detected: accumulator.dddEvidence.size > 0,
      confidence: confidenceFromCount(accumulator.dddEvidence.size),
      evidence: dddSamples
    },
    multiTenant: {
      detected: accumulator.multiTenantEvidence.size > 0,
      confidence: confidenceFromCount(accumulator.multiTenantEvidence.size),
      evidence: tenantSamples
    },
    identity: {
      provider,
      rolesUsed: accumulator.rolesEvidence.size > 0,
      claimsUsed: accumulator.claimsEvidence.size > 0,
      evidence: identityEvidenceLines
    },
    database: {
      paradigm,
      technologies: Array.from(new Set(technologies)).sort(),
      evidence: Array.from(accumulator.databaseEvidence).slice(0, 8)
    }
  };
}

export function buildArchitecturePatternsMarkdown(findings: ArchitecturePatternFindings): string {
  const lines: string[] = [];

  lines.push("### Domain-Driven Design");
  lines.push(
    `- Detected: ${findings.domainDrivenDesign.detected ? "✓" : "✗"} (confidence: ${findings.domainDrivenDesign.confidence})`
  );
  if (findings.domainDrivenDesign.evidence.length > 0) {
    lines.push("- Evidence:");
    for (const item of findings.domainDrivenDesign.evidence) lines.push(`  - ${item}`);
  }
  lines.push("");

  lines.push("### Multi-tenancy");
  lines.push(
    `- Detected: ${findings.multiTenant.detected ? "✓" : "✗"} (confidence: ${findings.multiTenant.confidence})`
  );
  if (findings.multiTenant.evidence.length > 0) {
    lines.push("- Evidence:");
    for (const item of findings.multiTenant.evidence) lines.push(`  - ${item}`);
  }
  lines.push("");

  lines.push("### Identity, roles & claims");
  lines.push(`- Provider: \`${findings.identity.provider}\``);
  lines.push(`- Roles used: ${findings.identity.rolesUsed ? "✓" : "✗"}`);
  lines.push(`- Claims used: ${findings.identity.claimsUsed ? "✓" : "✗"}`);
  if (findings.identity.evidence.length > 0) {
    lines.push("- Evidence:");
    for (const item of findings.identity.evidence) lines.push(`  - ${item}`);
  }
  lines.push("");

  lines.push("### Database paradigm & technology");
  lines.push(`- Paradigm: \`${findings.database.paradigm}\``);
  lines.push(
    `- Technologies: ${findings.database.technologies.length > 0 ? findings.database.technologies.join(", ") : "_none detected_"}`
  );
  if (findings.database.evidence.length > 0) {
    lines.push("- Evidence files:");
    for (const item of findings.database.evidence) lines.push(`  - ${item}`);
  }

  return lines.join("\n");
}
