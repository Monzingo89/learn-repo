export type SecretFinding = {
  filePath: string;
  kind: string;
  evidence: string;
};

export type SecretHygieneAccumulator = {
  findings: SecretFinding[];
};

const SENSITIVE_FILE_PATTERNS = [
  { kind: "SENSITIVE_ENV_FILE", regex: /(^|\/)\.env(\.|$)/i },
  { kind: "PRIVATE_KEY_FILE", regex: /(^|\/)(id_rsa|id_dsa|.*\.(pem|key|p12|pfx))$/i }
];

const CONTENT_PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  { kind: "PRIVATE_KEY_BLOCK", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { kind: "AWS_ACCESS_KEY", regex: /AKIA[0-9A-Z]{16}/ },
  { kind: "GITHUB_TOKEN", regex: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { kind: "SLACK_TOKEN", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  {
    kind: "POSSIBLE_HARDCODED_SECRET",
    regex: /\b(api[_-]?key|access[_-]?token|secret|password|connection[_-]?string)\b\s*[:=]\s*["'][^"'\n]{12,}["']/i
  }
];

const ALLOWED_PLACEHOLDER_HINTS = ["example", "placeholder", "changeme", "your_", "dummy", "sample", "test"];

function normalize(text: string): string {
  return text.toLowerCase();
}

export function createSecretHygieneAccumulator(): SecretHygieneAccumulator {
  return {
    findings: []
  };
}

function pushFinding(acc: SecretHygieneAccumulator, finding: SecretFinding) {
  const existing = acc.findings.find(
    (item) => item.filePath === finding.filePath && item.kind === finding.kind && item.evidence === finding.evidence
  );
  if (!existing) acc.findings.push(finding);
}

export function analyzeFileForSecretHygiene(
  relativePath: string,
  content: string,
  acc: SecretHygieneAccumulator
) {
  const normalizedPath = relativePath.replace(/\\/g, "/");

  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.regex.test(normalizedPath) && !/\.env\.example$/i.test(normalizedPath)) {
      pushFinding(acc, {
        filePath: relativePath,
        kind: pattern.kind,
        evidence: normalizedPath
      });
    }
  }

  for (const pattern of CONTENT_PATTERNS) {
    pattern.regex.lastIndex = 0;
    const match = pattern.regex.exec(content);
    if (!match?.[0]) continue;

    const evidence = match[0].slice(0, 120);
    const normEvidence = normalize(evidence);

    if (ALLOWED_PLACEHOLDER_HINTS.some((hint) => normEvidence.includes(hint))) {
      continue;
    }

    pushFinding(acc, {
      filePath: relativePath,
      kind: pattern.kind,
      evidence
    });
  }
}

export function finalizeSecretHygiene(acc: SecretHygieneAccumulator): SecretFinding[] {
  return acc.findings.sort((a, b) => {
    if (a.filePath === b.filePath) return a.kind.localeCompare(b.kind);
    return a.filePath.localeCompare(b.filePath);
  });
}
