// app/api/mood-session/active/route.ts
import { getSession } from "@/app/lib/auth/session";
import { supabaseServer } from "@/app/lib/supabase/server";
import {  NextResponse } from "next/server";

export async function GET() {
    try {
      // 1. Get NextAuth session from the server (App Router)
      const session = await getSession();
  
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
  
      // 2. Get spotifyId from the NextAuth session (populated this in the jwt/session callbacks)
      const spotifyId = session.user.spotifyId as string | undefined;
      if (!spotifyId) {
        return NextResponse.json(
          { error: "Spotify ID not present in session" },
          { status: 400 }
        );
      }
  
      // 3. Use server-only Supabase client to resolve internal user UUID
      const { data: user, error: userErr } = await supabaseServer
        .from("users")
        .select("id")
        .eq("spotify_id", spotifyId)
        .single();
  
      if (userErr || !user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
  
      // 4. Fetch active mood session for internal UUID
      const { data: sessionData, error: sessionErr } = await supabaseServer
        .from("mood_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("started_at", { ascending: false })
        .maybeSingle();
  
      if (sessionErr) {
        return NextResponse.json({ error: sessionErr.message }, { status: 500 });
      }
  
      return NextResponse.json({ session: sessionData ?? null }, { status: 200 });
    } catch (err) {
      console.error("Error in /api/mood-session/active", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }