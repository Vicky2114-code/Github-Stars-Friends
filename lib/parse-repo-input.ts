/**
 * Parse user-pasted GitHub repo references into { owner, repo }.
 *
 * Accepts every common form a developer might paste:
 *   - "vercel/next.js"
 *   - "https://github.com/vercel/next.js"
 *   - "https://github.com/vercel/next.js.git"
 *   - "http://github.com/vercel/next.js"
 *   - "github.com/vercel/next.js"
 *   - "git@github.com:vercel/next.js.git"
 *   - "https://github.com/vercel/next.js/tree/canary/packages/next"
 *
 * Returns null on garbage input. Pure function so we can unit test it
 * without setting up a server action.
 */

export type ParsedRepo = { owner: string; repo: string };

const VALID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function parseRepoInput(rawInput: string): ParsedRepo | null {
  if (!rawInput) return null;
  const input = rawInput.trim();
  if (!input) return null;

  // git@github.com:owner/repo.git
  const sshMatch = input.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return validate(sshMatch[1], sshMatch[2]);
  }

  // If the input is a full URL, the host MUST be github.com.
  // Reject pastes from gitlab/bitbucket/example.com etc. — silently routing
  // them to a github 404 would be worse than telling the user it's wrong.
  const urlMatch = input.match(/^https?:\/\/([^/]+)(\/.*)?$/);
  let pathPart: string;
  if (urlMatch) {
    const host = urlMatch[1].toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return null;
    pathPart = urlMatch[2] ?? "";
  } else {
    // Bare or github.com-prefixed form
    pathPart = input
      .replace(/^github\.com\//, "")
      .replace(/^www\.github\.com\//, "");
  }

  // Strip trailing ".git"
  pathPart = pathPart.replace(/\.git$/, "");

  // Take only the first 2 path segments (drop /tree/branch/path, /pull/N, etc.)
  const segs = pathPart.split("/").filter(Boolean);
  if (segs.length < 2) return null;
  return validate(segs[0], segs[1]);
}

function validate(owner: string, repo: string): ParsedRepo | null {
  if (!owner || !repo) return null;
  if (!VALID.test(owner)) return null;
  if (!VALID.test(repo)) return null;
  if (owner.length > 39 || repo.length > 100) return null; // GitHub limits
  return { owner, repo };
}
