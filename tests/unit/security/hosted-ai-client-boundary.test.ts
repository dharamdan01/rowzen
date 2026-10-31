import { build } from "esbuild";
import { expect, it } from "vitest";

it("bundles all hosted AI UIs without server credentials, auth, Prisma or server inference modules", { timeout: 30_000 }, async () => {
  const result = await build({ bundle: true, write: false, platform: "browser", format: "iife", metafile: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_AI_PROVIDER": '"groq"',
      "process.env.GROQ_API_KEY": '"SYNTHETIC_GROQ_SECRET_CANARY"',
      "process.env.AI_RATE_LIMIT_REDIS_REST_TOKEN": '"SYNTHETIC_REDIS_SECRET_CANARY"' },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import Mapping from './src/components/ai/schema-mapping-assistant';
      import Root from './src/components/ai/root-cause-analyzer';
      import Repair from './src/components/ai/smart-repair-planner';
      window.AiBoundary={Mapping,Root,Repair};` } });
  const paths = Object.keys(result.metafile!.inputs).map(path => path.replaceAll("\\", "/"));
  expect(paths).toContain("src/lib/ai/providers/hosted.ts");
  expect(paths.some(path => /src\/lib\/ai\/server|src\/lib\/auth\.ts|src\/lib\/prisma|@prisma/.test(path))).toBe(false);
  expect(result.outputFiles[0].text).not.toMatch(/SYNTHETIC_GROQ_SECRET_CANARY|SYNTHETIC_REDIS_SECRET_CANARY|process\.env\.GROQ_API_KEY|process\.env\.AI_RATE_LIMIT_REDIS_REST_TOKEN/);
});
