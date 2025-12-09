// app/api/track-logs/flush/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/app/lib/supabase/server";
import { MoodSessionsType, QueueStoredTrackLog } from "@/lib/Playback/types";
import { getSession } from "@/app/lib/auth/session";

type ValidSession = Partial<MoodSessionsType>

const TrackItem = z.object({
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
  album: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  energy: z.number().nullable().optional(),
  valence: z.number().nullable().optional(),
  danceability: z.number().nullable().optional(),
  liked: z.boolean().nullable().optional(),
});

const BodySchema = z.object({
  tracks: z.array(TrackItem).min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BodySchema.parse(body);

    // 1) identify user via NextAuth server session
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const spotifyId = (session.user?.spotifyId as string);
    if (!spotifyId) return NextResponse.json({ error: "Missing spotifyId in session" }, { status: 400 });

    // 2) resolve internal user ID
    const { data: user, error: userErr } = await supabaseServer
    .from("users")
    .select("id")
    .eq("spotify_id", spotifyId)
    .single();

    if (userErr || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 3) validate that each provided session_id belongs to this user and is active
    // collect unique session_ids from payload
    const sessionIds = Array.from(new Set(parsed.tracks.map(t => t.session_id)));

    // fetch sessions for these ids and ensure they belong to user
    const { data: sessions, error: sessErr } = await supabaseServer
    .from("mood_sessions")
    .select("id, user_id, is_active")
    .in("id", sessionIds);

    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

    const validSessionIds = new Set(
      (sessions ?? [])
      .filter((s: ValidSession) => s.user_id === user.id && s.is_active === true)
      .map((s) => s.id)
    );

    // filter out any items whose session_id is invalid (security)
    const filtered: QueueStoredTrackLog[] = parsed.tracks
      .filter(t => validSessionIds.has(t.session_id))
      .map(t => {
        // coerce undefined -> null for DB-friendly insert
        return {
          ...t,
          track_name: t.track_name ?? null,
          artist: t.artist ?? null,
          duration: t.duration ?? null,
          playback_position: t.playback_position ?? null,
          album: t.album ?? null,
          image_url: t.image_url ?? null,
          preview_url: t.preview_url ?? null,
          energy: t.energy ?? null,
          valence: t.valence ?? null,
          danceability: t.danceability ?? null,
          liked: t.liked ?? null,
        } as QueueStoredTrackLog;
      });

    if (filtered.length === 0) {
      return NextResponse.json({ inserted: 0, message: "No valid session items" });
    }

    // 4) upsert on idempotency_key to avoid duplicates
    // Make sure mood_tracks table has a unique constraint on idempotency_key
    const { data: inserted, error: insertErr } = await supabaseServer
      .from("mood_tracks")
      .upsert(filtered, { onConflict: "idempotency_key" })
      .select("id, idempotency_key");

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Build per-item result map (idempotency_key => status)
    const insertedKeys = new Set((inserted ?? []).map((r) => r.idempotency_key));
    const results = filtered.map(f => ({
      idempotency_key: f.idempotency_key,
      status: insertedKeys.has(f.idempotency_key) ? "inserted" : "duplicate",
    }));

    return NextResponse.json({ inserted: inserted?.length ?? results.filter(r => r.status === "inserted").length, results });
  } catch (err) {
    console.error("Error in /api/track-logs/flush", err);
    return NextResponse.json({ error: "Bad flush payload" }, { status: 400 });
  }
}
