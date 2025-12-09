// app/api/track-logs/beacon/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/app/lib/supabase/server";
import { getSession } from "@/app/lib/auth/session";
import { MoodSessionsType } from "@/lib/Playback/types";

type BeaconSession = Pick<MoodSessionsType, "id" | "user_id" | "is_active">  
const BeaconSchema = z.object({
  tracks: z.array(z.object({
    idempotency_key: z.string(),
    session_id: z.string(),
    spotify_track_id: z.string(),
    track_name: z.string().nullable().optional(),
    artist: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    listened_at: z.string(),
    listened_duration: z.number(),
    skipped: z.boolean(),
    playback_position: z.number().nullable().optional(),
  })).min(1),
});

export async function POST(req: Request) {
  try {
    // Accept small payloads from sendBeacon
    const bodyText = await req.text();
    const parsed = BeaconSchema.parse(JSON.parse(bodyText));
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const spotifyId = (session.user.spotifyId as string);
    if (!spotifyId) return NextResponse.json({ error: "Spotify ID missing" }, { status: 400 });

    // Resolve user -> ensure ownership of session ids like in flush route
    const { data: user, error: userErr } = await supabaseServer.from("users").select("id").eq("spotify_id", spotifyId).single();
    if (userErr || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Validate session ids belong to user and are active
    const sessionIds = Array.from(new Set(parsed.tracks.map(t => t.session_id)));
    const { data: sessions, error: sessErr } = await supabaseServer.from("mood_sessions").select("id, user_id, is_active").in("id", sessionIds);
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });
    const validSessionIds = new Set((sessions ?? []).filter((s: BeaconSession) => s.user_id === user.id && s.is_active).map((s: BeaconSession) => s.id));

    // Filter and coerce to nulls where appropriate
    const filtered = parsed.tracks.filter(t => validSessionIds.has(t.session_id)).map(t => ({
      ...t,
      track_name: t.track_name ?? null,
      artist: t.artist ?? null,
      duration: t.duration ?? null,
      playback_position: t.playback_position ?? null,
    }));

    if (!filtered.length) return NextResponse.json({ inserted: 0, message: "No valid session items" });

    const { data: inserted, error: insertErr } = await supabaseServer.from("mood_tracks").upsert(filtered, { onConflict: "idempotency_key" }).select("id, idempotency_key");

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ inserted: inserted?.length ?? 0 });
  } catch (err) {
    console.error("Error in beacon route", err);
    return NextResponse.json({ error: "Bad beacon payload" }, { status: 400 });
  }
}
