/** Cloudflare checks out a commit detached from its selected Git branch. */
export function assertPreviewCheckout(head, env) {
  const selectedBranch = "security-hardening";
  if (head === `ref: refs/heads/${selectedBranch}`) {
    if (env.WORKERS_CI === "1" && env.WORKERS_CI_BRANCH !== selectedBranch)
      throw new Error("Preview CI branch metadata does not match security-hardening.");
    return;
  }
  if (
    env.WORKERS_CI !== "1" ||
    env.WORKERS_CI_BRANCH !== selectedBranch ||
    !/^[a-f0-9]{40}$/i.test(head) ||
    !/^[a-f0-9]{40}$/i.test(env.WORKERS_CI_COMMIT_SHA ?? "") ||
    head.toLowerCase() !== env.WORKERS_CI_COMMIT_SHA.toLowerCase()
  ) throw new Error("Preview requires security-hardening or matching Cloudflare branch/commit metadata.");
}
