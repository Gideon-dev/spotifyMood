import {  usePlaybackStore } from "@/app/store/usePlaybackStore"

export const playbackActions = {
  get state() {
    return usePlaybackStore.getState()
  },
  set(partial: Partial<ReturnType<typeof usePlaybackStore.getState>>) {
    usePlaybackStore.setState(partial)
  }
}
