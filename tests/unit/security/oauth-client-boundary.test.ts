import { build } from "esbuild";
import { describe, expect, it } from "vitest";

describe("login client/server credential boundary", () => {
  it("bundles both providers without server auth configuration, Prisma or credential variables", async () => {
    const result = await build({ bundle: true, write: false, platform: "browser", format: "iife", metafile: true,
      external: ["next/link", "next/navigation"], define: { "process.env.NODE_ENV": '"production"',
        "process.env.GOOGLE_CLIENT_SECRET": '"SYNTHETIC_GOOGLE_SECRET_CANARY"', "process.env.GITHUB_CLIENT_SECRET": '"SYNTHETIC_GITHUB_SECRET_CANARY"' },
      stdin: { resolveDir: process.cwd(), loader: "tsx", contents: "import Login from './src/app/login/page'; window.LoginFixture=Login;" } });
    const inputs = Object.keys(result.metafile!.inputs).map(input => input.replaceAll("\\", "/"));
    expect(inputs).toContain("src/lib/auth-client.ts"); expect(inputs).not.toContain("src/lib/auth.ts");
    expect(inputs.some(input => /oauth-options|src\/lib\/prisma|@prisma/.test(input))).toBe(false);
    expect(/SYNTHETIC_GOOGLE_SECRET_CANARY|SYNTHETIC_GITHUB_SECRET_CANARY/.test(result.outputFiles[0].text)).toBe(false);
  });
});
