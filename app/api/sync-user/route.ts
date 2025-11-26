// /app/api/sync-user/route.ts

import { upsertUser } from "@/app/lib/db/users"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const { spotifyId, email, display_name } = body

  const { id } = await upsertUser({id: spotifyId, email, display_name,last_login_at: new Date().toISOString()})

  return NextResponse.json({ internalId: id })
}
