import "server-only"
import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { authOptions } from "../auth"

// You may extend the Session type if needed
export async function getSession(): Promise<Session | null> {
  return await getServerSession(authOptions)
}
