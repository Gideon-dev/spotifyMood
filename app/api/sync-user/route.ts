// /app/api/sync-user/route.ts

import { supabase } from "@/app/lib/supabaseClient"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const { spotifyId, email, display_name } = body

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

  return NextResponse.json({ internalId: data?.id })
}
