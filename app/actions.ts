"use server";

import { redirect } from "next/navigation";

import { parseRepoInput } from "@/lib/parse-repo-input";

export type SubmitState = {
  error?: string;
};

/**
 * Server Action for the landing form.
 *
 * Parses whatever the user pasted (URL, owner/repo, SSH form, etc.),
 * redirects to /[owner]/[repo] on success, returns an error message on
 * unparseable input.
 *
 * redirect() throws a special NEXT_REDIRECT — must be called OUTSIDE any
 * try/catch that would swallow it.
 */
export async function submitRepo(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = formData.get("repo");
  if (typeof raw !== "string") {
    return { error: "Paste a repo URL or owner/name." };
  }

  const parsed = parseRepoInput(raw);
  if (!parsed) {
    return {
      error:
        "Couldn't parse that. Try a full GitHub URL or just owner/repo.",
    };
  }

  // redirect() throws — must be outside try/catch
  redirect(`/${parsed.owner}/${parsed.repo}`);
}
