import { ExtendedToken } from "@/lib/interface";
import NextAuth, { NextAuthOptions } from "next-auth"
import type { SpotifyProfile } from "next-auth/providers/spotify";
import type { JWT } from "next-auth/jwt";
import SpotifyProvider from "next-auth/providers/spotify"
import { spotify } from "@/app/lib/spotifyClient";
import { supabase } from "@/app/lib/supabaseClient";


const scopes = [
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
  "playlist-read-private",
].join(" ")



async function refreshAccessToken(token : ExtendedToken): Promise<JWT> {
  try {
    spotify.setAccessToken(token.accessToken as string)
    spotify.setRefreshToken(token.refreshToken as string)

    const { body } = await spotify.refreshAccessToken()

    return {
      ...token,
      accessToken: body.access_token,
      accessTokenExpires: Date.now() + body.expires_in * 1000,
      refreshToken: body.refresh_token ?? token.refreshToken,
      spotifyId: token.spotifyId,
      displayName: token.displayName,
    } as JWT
  } catch (error) {
    console.error("Error refreshing Spotify token", error)
    return { ...token, error: "RefreshAccessTokenError" } as JWT
  }
}

export const authOptions:NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: { scope: scopes },
      },
      profile(profile: SpotifyProfile) {
        return {
          id: profile.id,
          name: profile.display_name,
          email: profile.email,
          image: profile.images?.[0]?.url || null,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id) return false

      const spotifyId = user.id
      const email = user.email
      const display_name = user.name

      const { data } = await supabase
        .from("users")
        .upsert(
          {
            spotify_id: spotifyId,
            email,
            display_name,
            last_login_at: new Date().toISOString(),
          },
          { onConflict: "spotify_id" }
        )
        .select("id")
        .single()

      if (!data?.id) return false

      user.internalId = data.id
      return true
    },
    async jwt({ token, account, user }): Promise<JWT> {
      // On first login
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + (account.expires_in ?? 3600) * 1000,
          spotifyId: user.id,
          displayName: user.name,
          email: user.email
        } as JWT
      }

      // Token still valid
      if (Date.now() < (token.accessTokenExpires as number)) return token

      // Refresh expired token
      return await refreshAccessToken(token)
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      if (session.user) {
        session.user.spotifyId = token.spotifyId
        session.user.displayName = token.displayName
        session.user.email = token.email
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions as NextAuthOptions)
export { handler as GET, handler as POST }