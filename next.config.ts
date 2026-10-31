import type { NextConfig } from "next";
import { aiEnvironmentErrors } from "./scripts/check-ai-env.mjs";

const aiConfigurationErrors = aiEnvironmentErrors(process.env, { production: process.env.NODE_ENV === "production" });
if (aiConfigurationErrors.length) throw new Error(aiConfigurationErrors.join("\n"));

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Defense-in-depth headers. Intentionally no blanket CSP: Next.js client scripts
  // and OAuth redirects need an app-specific CSP tested in production first.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
