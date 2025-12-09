// components/AuthContainer.tsx
"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { toast } from "sonner"

export default function AuthContainer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status !== "authenticated") return
    if (session.user?.spotifyId) return

    const spotifyId = session.user?.spotifyId
    const email = session.user?.email
    const display_name = session.user?.displayName

    toast("user syncing in progress…")

    fetch("/api/sync-user", {
      method: "POST",
      body: JSON.stringify({ spotifyId, email, display_name }),
      headers: { "Content-Type": "application/json" },
    })
    .then(() => toast("User sync fixed"))
    .catch(() => toast("Failed to sync user"))
  }, [session, status])

  return <>{children}</>
}