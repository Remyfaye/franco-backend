// types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      roles: string[];
    } & DefaultSession["user"];
  }

  interface User {
    roles: string[];
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles: string[];
    id: string;
  }
}
