// app/api/auth/spotify/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { spotify } from "@/app/lib/spotifyClient";

export type RefreshResponse = {
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  if (!token?.refreshToken)
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });

  spotify.setRefreshToken(token.refreshToken);

  try {
    const { body } = await spotify.refreshAccessToken();
    return NextResponse.json({
      accessToken: body.access_token,
      accessTokenExpires: Date.now() + body.expires_in * 1000,
      refreshToken: body.refresh_token ?? token.refreshToken,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}
