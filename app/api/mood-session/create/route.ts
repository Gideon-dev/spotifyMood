// app/api/mood-session/start/route.ts
import { getSession } from "@/app/lib/auth/session";
import { supabaseServer } from "@/app/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const StartSchema = z.object({
  mood: z.string(),
  context: z.record(z.string(), z.any()).optional()
});


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mood, context } = StartSchema.parse(body);
    // Get NextAuth session from the server (App Router)
    const session = await getSession();
  
    if (!session?.user || !session?.user.spotifyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
   
    const spotifyId = session.user.spotifyId as string | undefined;
    if (!spotifyId) {
      return NextResponse.json(
        { error: "Spotify ID not present in session" },
        { status: 400 }
      );
    }

    // 1️⃣ Look up the internal UUID
    const { data: user, error: userErr } = await supabaseServer
    .from("users")
    .select("id")
    .eq("spotify_id", spotifyId)
    .single();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 2️⃣ End any existing active sessions (idempotent)
    await supabaseServer
    .from("mood_sessions")
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("is_active", true);

    // 3️⃣ Create new session
    const { data, error } = await supabaseServer
      .from("mood_sessions")
      .insert([
        {
          user_id: user.id,
          mood: mood,
          context: context ?? {},
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Invalid payload or server error" },
      { status: 400 }
    );
  }
}
