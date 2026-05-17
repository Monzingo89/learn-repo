export type TechnologyDoc = {
  id: string;
  name: string;
  docsUrl: string;
};

type TechnologyMatcher = {
  tech: TechnologyDoc;
  matches: (normalizedPath: string) => boolean;
};

const TECHNOLOGY_MATCHERS: TechnologyMatcher[] = [
  {
    tech: {
      id: "typescript",
      name: "TypeScript",
      docsUrl: "https://www.typescriptlang.org/docs/"
    },
    matches: (p) => p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith("tsconfig.json")
  },
  {
    tech: {
      id: "javascript",
      name: "JavaScript",
      docsUrl: "https://developer.mozilla.org/docs/Web/JavaScript"
    },
    matches: (p) => p.endsWith(".js") || p.endsWith(".jsx")
  },
  {
    tech: {
      id: "nodejs",
      name: "Node.js",
      docsUrl: "https://nodejs.org/docs/latest-v22.x/api/"
    },
    matches: (p) => p.endsWith("package.json") || p.endsWith("package-lock.json")
  },
  {
    tech: {
      id: "github-actions",
      name: "GitHub Actions",
      docsUrl: "https://docs.github.com/actions"
    },
    matches: (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
  },
  {
    tech: {
      id: "markdown",
      name: "Markdown",
      docsUrl: "https://www.markdownguide.org/basic-syntax/"
    },
    matches: (p) => p.endsWith(".md")
  },
  {
    tech: {
      id: "json",
      name: "JSON",
      docsUrl: "https://www.json.org/json-en.html"
    },
    matches: (p) => p.endsWith(".json")
  },
  {
    tech: {
      id: "shell",
      name: "Shell Scripting",
      docsUrl: "https://www.gnu.org/software/bash/manual/bash.html"
    },
    matches: (p) => p.endsWith(".sh")
  },
  {
    tech: {
      id: "python",
      name: "Python",
      docsUrl: "https://docs.python.org/3/"
    },
    matches: (p) => p.endsWith(".py")
  },
  {
    tech: {
      id: "go",
      name: "Go",
      docsUrl: "https://go.dev/doc/"
    },
    matches: (p) => p.endsWith(".go")
  },
  {
    tech: {
      id: "rust",
      name: "Rust",
      docsUrl: "https://doc.rust-lang.org/book/"
    },
    matches: (p) => p.endsWith(".rs")
  },
  {
    tech: {
      id: "java",
      name: "Java",
      docsUrl: "https://docs.oracle.com/en/java/"
    },
    matches: (p) => p.endsWith(".java")
  },
  {
    tech: {
      id: "csharp",
      name: "C#",
      docsUrl: "https://learn.microsoft.com/dotnet/csharp/"
    },
    matches: (p) => p.endsWith(".cs")
  },
  {
    tech: {
      id: "php",
      name: "PHP",
      docsUrl: "https://www.php.net/docs.php"
    },
    matches: (p) => p.endsWith(".php")
  },
  {
    tech: {
      id: "ruby",
      name: "Ruby",
      docsUrl: "https://www.ruby-lang.org/en/documentation/"
    },
    matches: (p) => p.endsWith(".rb")
  }
];

export function detectTechnologiesForPath(relativePath: string): TechnologyDoc[] {
  const normalizedPath = relativePath.replace(/\\/g, "/").toLowerCase();
  const found = new Map<string, TechnologyDoc>();

  for (const matcher of TECHNOLOGY_MATCHERS) {
    if (matcher.matches(normalizedPath)) {
      found.set(matcher.tech.id, matcher.tech);
    }
  }

  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}
