import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { oauthOptions } from "./security/oauth-options";

export const auth = betterAuth({
  ...oauthOptions(process.env),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
});
