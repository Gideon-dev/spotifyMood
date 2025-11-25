import { supabase } from "../supabaseClient"

export async function endMoodSession(sessionId: string) {
  const { data, error } = await supabase
    .from("mood_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createMoodSession(spotifyId: string, mood: string, context = {}) {

  // first Look up the internal user UUID to get the user

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("spotify_id", spotifyId)
    .single();

  if (userError || !user) {
    console.error("Could not find UUID for user", userError);
    throw new Error("User record not found");
  }

  const userUUID = user.id;  // This is the correct UUID for mood_sessions.user_id


  // 1️⃣ End any existing active sessions for this user
  await supabase
  .from("mood_sessions")
  .update({ is_active: false, ended_at: new Date().toISOString() })
  .eq("user_id", userUUID)
  .eq("is_active", true);

  // 2️⃣ Then Start a new session
  const { data, error } = await supabase
  .from("mood_sessions")
  .insert([
    {
      user_id: userUUID,
      mood,
      context,
      is_active: true,
    }
  ])
  .select()
  .single()

  if (error) {
    console.error(error);
    throw new Error("Could not create mood session");
  }
  return data
}


export async function getActiveSession(spotifyId: string) {
  const { data, error } = await supabase
    .from("mood_sessions")
    .select("*")
    .eq("user_id", spotifyId)
    .eq("is_active", true)
    .order("started_at", { ascending: false })
    .limit(1)
    .single()

  if (error) throw error
  return data
}


