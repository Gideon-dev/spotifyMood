// components/PlaybackInitializer.tsx
"use client"
import { usePlaybackStore } from "@/app/store/usePlaybackStore"
import { useEffect } from "react"

export function PlaybackInitializer() {
  const restoreSession = usePlaybackStore((s) => s.restoreSession)

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  return null // no UI
}
