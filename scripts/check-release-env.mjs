import { pathToFileURL } from "node:url";
import { aiEnvironmentErrors } from "./check-ai-env.mjs";

const required = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET",
  "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEON_BRANCH_ID"];

/** Policy checks only; remote branch isolation and provider consoles still require verification. */
export function releaseEnvironmentErrors(environment, { migration = false } = {}) {
  const names = migration ? ["DIRECT_URL", "NEON_BRANCH_ID"] : required;
  const errors = names.filter(name => !environment[name]?.trim()).map(name => `${name} is required.`);
  if (!migration) errors.push(...aiEnvironmentErrors(environment, { production: true }));
  if (!["preview", "production"].includes(environment.DEPLOYMENT_ENVIRONMENT)) errors.push("DEPLOYMENT_ENVIRONMENT must be preview or production.");
  if (["preview", "production"].includes(environment.VERCEL_ENV) && environment.VERCEL_ENV !== environment.DEPLOYMENT_ENVIRONMENT) errors.push("Vercel and application environment scopes must agree.");
  if (environment.VERCEL === "1" && environment.DIRECT_URL) errors.push("Keep DIRECT_URL in the separate migration job, not Vercel runtime variables.");
  if (!migration) {
  if ((environment.BETTER_AUTH_SECRET?.length ?? 0) < 32 || /replace|placeholder/i.test(environment.BETTER_AUTH_SECRET ?? "")) errors.push("BETTER_AUTH_SECRET must be a non-placeholder secret with at least 32 characters.");
  try {
    const origin = new URL(environment.BETTER_AUTH_URL);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || origin.hostname.endsWith(".invalid")) throw new Error();
  } catch { errors.push("BETTER_AUTH_URL must be the exact deployed HTTPS origin."); }
  }
  const connections = [];
  for (const name of migration ? ["DIRECT_URL"] : environment.DIRECT_URL ? ["DATABASE_URL", "DIRECT_URL"] : ["DATABASE_URL"]) {
    try {
      const url = new URL(environment[name]);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname.endsWith(".neon.tech") ||
          !url.username || !url.password || url.pathname === "/" || url.searchParams.get("sslmode") !== "verify-full" ||
          /REPLACE|PLACEHOLDER|PREVIEW_ENDPOINT|PRODUCTION_ENDPOINT|TARGET_ENDPOINT/i.test(environment[name])) throw new Error();
      if ((name === "DATABASE_URL") !== url.hostname.includes("-pooler.")) throw new Error();
      connections.push(url);
    } catch { errors.push(`${name} must be a Neon ${name === "DATABASE_URL" ? "pooled" : "direct"} connection with sslmode=verify-full.`); }
  }
  if (connections.length === 2 && (connections[0].hostname.replace("-pooler.", ".") !== connections[1].hostname || connections[0].pathname !== connections[1].pathname)) {
    errors.push("DATABASE_URL and DIRECT_URL must address the same environment database.");
  }
  if (environment.NEON_BRANCH_ID?.includes("REPLACE")) errors.push("NEON_BRANCH_ID must identify the provisioned environment branch.");
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = releaseEnvironmentErrors(process.env, { migration: process.argv.includes("--migration") });
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) errors.unshift("Release jobs require Node.js >=24.22.1 <25.");
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else console.log(`Release environment policy checks passed with Node ${process.version}. Remote isolation and deployment are not implied.`);
}
