// types/next-auth.d.ts
import NextAuth, { DefaultSession, Account as DefaultAccount, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    // accessToken?: string;
    refreshToken?: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      spotifyId?: string | null;
      displayName?: string | null;
      internalId?:string| null
      error?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    internalId?: string
    spotifyId?: string
    displayName?: string
  }

  interface Account extends DefaultAccount {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    spotifyId?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    spotifyId?: string;
    internalId?: string;
    email?: string;
    displayName?: string;
    error?: string;
  }
}
