import path from "path";

export type DeadCodeAccumulator = {
  filesSeen: Set<string>;
  inboundCounts: Map<string, number>;
};

export function createDeadCodeAccumulator(): DeadCodeAccumulator {
  return {
    filesSeen: new Set(),
    inboundCounts: new Map()
  };
}

const IMPORT_REGEXES = [
  /\bimport\s+(?:[^'"`]+\s+from\s+)?['"`]([^'"`]+)['"`]/g,
  /\brequire\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /\bexport\s+(?:\*|\{[^}]+\})\s+from\s+['"`]([^'"`]+)['"`]/g
];

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const ENTRYPOINT_PATTERNS = [
  /(^|\/)index\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /(^|\/)main\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /(^|\/)server\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /(^|\/)cli\//,
  /(^|\/)bin\//,
  /\.config\.(ts|js)$/
];

function isCodeFile(relativePath: string): boolean {
  const ext = path.extname(relativePath).toLowerCase();
  return CODE_EXTENSIONS.includes(ext);
}

function isEntrypointLike(relativePath: string): boolean {
  return ENTRYPOINT_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function resolveLocalImport(
  fromRelativePath: string,
  rawSpecifier: string,
  knownFiles: Set<string>
): string | null {
  if (!rawSpecifier.startsWith(".") && !rawSpecifier.startsWith("/")) return null;

  const fromDir = path.posix.dirname(fromRelativePath.split(path.sep).join("/"));
  const joined = path.posix.normalize(path.posix.join(fromDir, rawSpecifier.split("\\").join("/")));
  const candidates = [
    joined,
    ...CODE_EXTENSIONS.map((ext) => joined + ext),
    ...CODE_EXTENSIONS.map((ext) => joined + "/index" + ext),
    joined.replace(/\.js$/, ".ts"),
    joined.replace(/\.js$/, ".tsx")
  ];

  for (const candidate of candidates) {
    if (knownFiles.has(candidate)) return candidate;
  }

  return null;
}

export function analyzeFileForDeadCode(
  relativePath: string,
  content: string,
  accumulator: DeadCodeAccumulator
) {
  const normalized = relativePath.split(path.sep).join("/");
  accumulator.filesSeen.add(normalized);

  if (!isCodeFile(normalized)) return;

  for (const regex of IMPORT_REGEXES) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const specifier = match[1];
      if (!specifier) continue;

      // We can't fully resolve here yet because not all files are known.
      // Record raw specifier; resolution happens in finalizeDeadCodeCandidates.
      const key = `__pending__:${normalized}::${specifier}`;
      accumulator.inboundCounts.set(key, (accumulator.inboundCounts.get(key) || 0) + 1);
    }
  }
}

export function finalizeDeadCodeCandidates(accumulator: DeadCodeAccumulator): string[] {
  const inboundResolved = new Map<string, number>();

  for (const key of accumulator.inboundCounts.keys()) {
    if (!key.startsWith("__pending__:")) continue;

    const [, payload] = key.split("__pending__:");
    const [fromPath, specifier] = payload.split("::");
    const resolved = resolveLocalImport(fromPath, specifier, accumulator.filesSeen);

    if (resolved) {
      inboundResolved.set(resolved, (inboundResolved.get(resolved) || 0) + 1);
    }
  }

  const candidates: string[] = [];

  for (const filePath of accumulator.filesSeen) {
    if (!isCodeFile(filePath)) continue;
    if (isEntrypointLike(filePath)) continue;
    if (inboundResolved.has(filePath)) continue;

    candidates.push(filePath);
  }

  return candidates.sort((a, b) => a.localeCompare(b));
}
