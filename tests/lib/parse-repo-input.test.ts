/**
 * parseRepoInput is a pure function — exhaustive table-driven tests.
 */

import { describe, expect, test } from "bun:test";

import { parseRepoInput } from "../../lib/parse-repo-input";

const cases: Array<[string, { owner: string; repo: string } | null]> = [
  // Happy paths — each common form
  ["vercel/next.js", { owner: "vercel", repo: "next.js" }],
  ["https://github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
  ["http://github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
  ["github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
  ["www.github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
  ["https://github.com/vercel/next.js.git", { owner: "vercel", repo: "next.js" }],
  ["git@github.com:vercel/next.js.git", { owner: "vercel", repo: "next.js" }],
  [
    "https://github.com/vercel/next.js/tree/canary/packages/next",
    { owner: "vercel", repo: "next.js" },
  ],
  ["  vercel/next.js  ", { owner: "vercel", repo: "next.js" }], // whitespace

  // Alphanumeric, underscore, hyphen, dot in repo name
  ["facebook/react", { owner: "facebook", repo: "react" }],
  ["anthropics/claude-code", { owner: "anthropics", repo: "claude-code" }],
  ["The_Algorithm_001/Foo.Bar", { owner: "The_Algorithm_001", repo: "Foo.Bar" }],

  // Garbage
  ["", null],
  ["   ", null],
  ["vercel", null], // single segment
  // Leading slash: tolerated, treated as bare owner/repo
  ["/vercel/next.js", { owner: "vercel", repo: "next.js" }],
  ["https://example.com/vercel/next.js", null], // wrong host
  ["@invalid", null], // starts with non-alnum
  ["foo/", null], // empty repo after slash
  ["/foo", null], // empty owner
  ["foo bar/baz", null], // space in owner

  // GitHub username limits — 40+ chars is illegal
  ["a".repeat(40) + "/repo", null],
  ["valid-owner/" + "x".repeat(101), null], // repo too long
];

describe("parseRepoInput", () => {
  for (const [input, expected] of cases) {
    test(`parses ${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(parseRepoInput(input)).toEqual(expected);
    });
  }
});
