// types/Track.ts
import { Database } from "@/app/lib/db/types/supabase"

export type SpotifyTrack = SpotifyApi.TrackObjectFull
export type MinimalPlayback = Pick<
  SpotifyApi.CurrentPlaybackResponse,
  "is_playing" | "progress_ms" | "item" | "device" | "repeat_state" | "shuffle_state"
>;
export type PlaybackTrack = Extract<
  SpotifyApi.CurrentPlaybackResponse["item"],
  SpotifyApi.TrackObjectFull
>;
export type MoodSessionTrackType = Database["public"]["Tables"]["mood_tracks"]["Row"]

export type NormalizedTrack = MoodSessionTrackType & {
  uri?: string
  popularity?: number | null
  artistNames?: string[]
  playable?: boolean
  moodTag?: string
}
/**
 * Normalizes Spotify track data with existing DB mood track data.
 * Ensures that all fields align with the Supabase `mood_tracks` table + computed fields
 */
export function mapToNormalizedTrack(
  spotifyTrack: SpotifyTrack,
  dbData?: Partial<MoodSessionTrackType>
): NormalizedTrack {
  const albumImage = spotifyTrack.album?.images?.[0]?.url ?? dbData?.image_url ?? ""
  const artistNames =
    spotifyTrack.artists?.map((a) => a.name) ??
    (dbData?.artist ? dbData.artist.split(",") : [])

  return {
    // === mood_tracks table fields ===
    id: dbData?.id ?? crypto.randomUUID(),
    session_id: dbData?.session_id ?? null,
    spotify_track_id: spotifyTrack.id,
    track_name: spotifyTrack.name,
    artist: artistNames.join(", "),
    album: spotifyTrack.album?.name ?? dbData?.album ?? "",
    image_url: albumImage,
    preview_url: spotifyTrack.preview_url ?? dbData?.preview_url ?? null,
    duration: spotifyTrack.duration_ms ?? dbData?.duration ?? null,
    energy: dbData?.energy ?? null,
    valence: dbData?.valence ?? null,
    danceability: dbData?.danceability ?? null,
    liked: dbData?.liked ?? null,
    skipped: dbData?.skipped ?? null,
    listened_at: dbData?.listened_at ?? null,
    listened_duration: dbData?.listened_duration ?? null,
    playback_position: dbData?.playback_position ?? null,

    // === computed / extended fields ===
    uri: spotifyTrack.uri,
    popularity: spotifyTrack.popularity ?? null,
    artistNames,
    playable: !!(spotifyTrack.preview_url || dbData?.preview_url),
    moodTag: inferMood(dbData?.valence, dbData?.energy),
  }
}





/**
 * returns Spotify Normalized track data with existing DB mood track data.
 * Ensures that all fields align with the Supabase `mood_tracks` table
 */
export function mapToSupabaseInsert(track: NormalizedTrack): MoodSessionTrackType {
  return {
    id: track.id,
    session_id: track.session_id,
    spotify_track_id: track.spotify_track_id,
    track_name: track.track_name,
    artist: track.artist,
    album: track.album,
    image_url: track.image_url,
    preview_url: track.preview_url,
    duration: track.duration ?? null,
    energy: track.energy ?? null,
    valence: track.valence ?? null,
    danceability: track.danceability ?? null,
    liked: track.liked ?? false,
    skipped: track.skipped ?? false,
    listened_at: track.listened_at ?? new Date().toISOString(),
    listened_duration: track.listened_duration ?? null,
    playback_position: track.playback_position ?? null,
  }
}

/**
 * Derive a human-readable "mood" from valence + energy metrics.
 */
function inferMood(valence?: number | null, energy?: number | null): string {
  if (valence == null || energy == null) return "unknown"
  if (valence > 0.7 && energy > 0.6) return "happy"
  if (valence < 0.4 && energy < 0.5) return "sad"
  if (energy > 0.8) return "energetic"
  return "calm"
}



export interface PlayerControlsProps {
    isPlaying: boolean
    liked: boolean
    onPlay: () => void
    onPause: () => void
    onNext: () => void
    onLike: () => void
}
