// app/api/mood-session/end/route.ts
import { getSession } from "@/app/lib/auth/session";
import { supabaseServer } from "@/app/lib/supabase/server";
import { NextResponse } from "next/server";





export async function POST() {
  try {
    // const body = await req.json();
    // const { sessionId } = EndSchema.parse(body);
    // Get NextAuth session from the server (App Router)
    const session = await getSession();
  
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionId = session.user.internalId as string

    const { data, error } = await supabaseServer
      .from("mood_sessions")
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq("user_id", sessionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
