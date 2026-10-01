// Set NEXT_PUBLIC_GITHUB_REPO to the repo that hosts the plugin, e.g. "someone/dontfckmothernature".
export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "vedant-contentstack/dontfckmothernature";

export const INSTALL = {
  claude: [`/plugin marketplace add ${GITHUB_REPO}`, "/plugin install dontfckmothernature@dontfckmothernature", "/footprint"],
  codex: "npx dontfckmothernature codex",
};
