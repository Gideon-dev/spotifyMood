// lib/db/users.ts

import { supabaseServer } from "../supabase/server";



export async function upsertUser(profile: { id: string; email?: string | null; display_name?: string | null; last_login_at?:string }) {
  const { data, error } = await supabaseServer
    .from("users")
    .upsert(
      {
        spotify_id: profile.id,
        email: profile.email || null,
        display_name: profile.display_name || null,
        last_login_at: profile.last_login_at
      },
      { onConflict: "spotify_id" }
    )
    .select("id")
    .single()

  if (error) throw error
  return data
}
