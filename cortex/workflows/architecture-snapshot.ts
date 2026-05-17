export type ArchitectureSnapshot = {
  frontendCode: Set<string>;
  frontendToBackend: Set<string>;
  backendCode: Set<string>;
  backendToDatabase: Set<string>;
  caching: Set<string>;
  signalR: Set<string>;
  databaseTechnologies: Set<string>;
  databaseConnectionSignals: Set<string>;
};

const FRONTEND_PATH_HINTS = [
  "/frontend/",
  "/client/",
  "/ui/",
  "/components/",
  "/views/",
  "/pages/"
];

const BACKEND_PATH_HINTS = [
  "/backend/",
  "/server/",
  "/api/",
  "/controllers/",
  "/routes/",
  "/services/",
  "/handlers/"
];

const FRONTEND_TO_BACKEND_HINTS = [
  "fetch(",
  "axios",
  "graphql-request",
  "@apollo/client",
  "httpclient",
  "/api/",
  "createclient("
];

const BACKEND_HINTS = [
  "express(",
  "app.get(",
  "app.post(",
  "router.",
  "fastify",
  "koa",
  "nestjs",
  "minimalapi",
  "mapget(",
  "microsoft.aspnetcore"
];

const BACKEND_TO_DB_HINTS = [
  "prisma",
  "typeorm",
  "sequelize",
  "knex",
  "mongoose",
  "db.query",
  "sqlconnection",
  "entityframework",
  "@azure/cosmos",
  "mongodb://",
  "postgres://",
  "postgresql://",
  "mysql://",
  "server=",
  "datasource="
];

const CACHE_HINTS = [
  "redis",
  "cache",
  "memorycache",
  "lru-cache",
  "distributedcache",
  "idistributedcache"
];

const SIGNALR_HINTS = [
  "signalr",
  "hubconnectionbuilder",
  "@microsoft/signalr",
  "socket.io",
  "websocket"
];

const DATABASE_TECHNOLOGY_HINTS: Array<{ name: string; patterns: string[] }> = [
  { name: "PostgreSQL", patterns: ["postgres", "pg", "postgresql://", "postgres://"] },
  { name: "MySQL", patterns: ["mysql", "mysql2", "mysql://"] },
  { name: "MongoDB", patterns: ["mongodb", "mongoose", "mongodb://"] },
  { name: "SQLite", patterns: ["sqlite", "better-sqlite3"] },
  { name: "SQL Server", patterns: ["mssql", "sqlconnection", "sql server", "entityframework"] },
  { name: "Azure Cosmos DB", patterns: ["@azure/cosmos", "cosmos"] },
  { name: "DynamoDB", patterns: ["dynamodb", "@aws-sdk/client-dynamodb"] },
  { name: "Firestore", patterns: ["firestore", "@google-cloud/firestore"] },
  { name: "Prisma (ORM)", patterns: ["prisma"] }
];

const DATABASE_CONNECTION_SIGNAL_HINTS: Array<{ name: string; patterns: string[] }> = [
  { name: "Connection String", patterns: ["connectionstring", "postgresql://", "mongodb://", "mysql://", "server="] },
  { name: "ORM/Client Initialization", patterns: ["new prisma", "typeorm", "sequelize", "mongoose.connect", "sqlconnection"] },
  { name: "Repository/Data Access Layer", patterns: ["repository", "/repositories/", "/data/", "/db/"] },
  { name: "Query Execution", patterns: ["db.query", "executequery", "findmany", "from(", "select "] }
];

function hasAnyHint(text: string, hints: string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").toLowerCase();
}

function normalizeContent(content: string): string {
  return content.toLowerCase();
}

export function createArchitectureSnapshot(): ArchitectureSnapshot {
  return {
    frontendCode: new Set<string>(),
    frontendToBackend: new Set<string>(),
    backendCode: new Set<string>(),
    backendToDatabase: new Set<string>(),
    caching: new Set<string>(),
    signalR: new Set<string>(),
    databaseTechnologies: new Set<string>(),
    databaseConnectionSignals: new Set<string>()
  };
}

export function analyzeFileForArchitecture(
  relativePath: string,
  fileContent: string,
  snapshot: ArchitectureSnapshot
): { newlyDetectedDatabaseTechnologies: string[] } {
  const pathText = normalizePath(relativePath);
  const contentText = normalizeContent(fileContent);
  const joined = `${pathText}\n${contentText}`;

  const isFrontendByPath = hasAnyHint(pathText, FRONTEND_PATH_HINTS);
  const isFrontendByExt = pathText.endsWith(".tsx") || pathText.endsWith(".jsx") || pathText.endsWith(".css") || pathText.endsWith(".html");
  const isBackendByPath = hasAnyHint(pathText, BACKEND_PATH_HINTS);
  const isBackendByHints = hasAnyHint(contentText, BACKEND_HINTS);

  if ((isFrontendByPath || isFrontendByExt) && !isBackendByPath) {
    snapshot.frontendCode.add(relativePath);
  }

  if (hasAnyHint(joined, FRONTEND_TO_BACKEND_HINTS)) {
    snapshot.frontendToBackend.add(relativePath);
  }

  if (isBackendByPath || isBackendByHints) {
    snapshot.backendCode.add(relativePath);
  }

  if (hasAnyHint(joined, BACKEND_TO_DB_HINTS)) {
    snapshot.backendToDatabase.add(relativePath);
  }

  if (hasAnyHint(joined, CACHE_HINTS)) {
    snapshot.caching.add(relativePath);
  }

  if (hasAnyHint(joined, SIGNALR_HINTS)) {
    snapshot.signalR.add(relativePath);
  }

  const newlyDetectedDatabaseTechnologies: string[] = [];

  for (const databaseTech of DATABASE_TECHNOLOGY_HINTS) {
    if (hasAnyHint(joined, databaseTech.patterns) && !snapshot.databaseTechnologies.has(databaseTech.name)) {
      snapshot.databaseTechnologies.add(databaseTech.name);
      newlyDetectedDatabaseTechnologies.push(databaseTech.name);
    }
  }

  for (const connectionSignal of DATABASE_CONNECTION_SIGNAL_HINTS) {
    if (hasAnyHint(joined, connectionSignal.patterns)) {
      snapshot.databaseConnectionSignals.add(connectionSignal.name);
    }
  }

  return { newlyDetectedDatabaseTechnologies };
}

function summarizePathSet(values: Set<string>, limit = 5): string {
  if (values.size === 0) return "Not yet observed.";

  const sorted = Array.from(values).sort((a, b) => a.localeCompare(b));
  const shown = sorted.slice(0, limit).map((item) => `\`${item}\``).join(", ");
  const more = sorted.length > limit ? ` (+${sorted.length - limit} more)` : "";
  return `${shown}${more}`;
}

export function buildArchitectureSnapshotMarkdown(snapshot: ArchitectureSnapshot): string {
  const detectedDatabases = Array.from(snapshot.databaseTechnologies).sort((a, b) => a.localeCompare(b));
  const connectionSignals = Array.from(snapshot.databaseConnectionSignals).sort((a, b) => a.localeCompare(b));

  const databaseTechnologyText =
    detectedDatabases.length > 0
      ? detectedDatabases.join(", ")
      : "Database-agnostic (no concrete database technology detected yet).";

  const databaseConnectionText =
    connectionSignals.length > 0
      ? connectionSignals.join(", ")
      : "No explicit database connection pattern detected yet.";

  return [
    "### High-Level Architecture Composition",
    `- Frontend code makeup: ${summarizePathSet(snapshot.frontendCode)}`,
    `- Frontend code that talks to backend: ${summarizePathSet(snapshot.frontendToBackend)}`,
    `- Backend code: ${summarizePathSet(snapshot.backendCode)}`,
    `- Backend code that talks to database: ${summarizePathSet(snapshot.backendToDatabase)}`,
    `- Caching layer evidence: ${summarizePathSet(snapshot.caching)}`,
    `- SignalR / realtime evidence: ${summarizePathSet(snapshot.signalR)}`,
    "",
    "### Data Layer Posture",
    `- Database technology: ${databaseTechnologyText}`,
    `- Database connection summary: ${databaseConnectionText}`
  ].join("\n");
}

export function architectureSnapshotSummary(snapshot: ArchitectureSnapshot) {
  return {
    frontendCodeCount: snapshot.frontendCode.size,
    frontendToBackendCount: snapshot.frontendToBackend.size,
    backendCodeCount: snapshot.backendCode.size,
    backendToDatabaseCount: snapshot.backendToDatabase.size,
    cachingCount: snapshot.caching.size,
    signalRCount: snapshot.signalR.size,
    databaseTechnologies: Array.from(snapshot.databaseTechnologies).sort((a, b) => a.localeCompare(b)),
    databaseAgnostic: snapshot.databaseTechnologies.size === 0
  };
}
