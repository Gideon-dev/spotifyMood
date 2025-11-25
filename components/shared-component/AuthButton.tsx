"use client"
import { signIn, signOut, useSession } from "next-auth/react"
import { SpotifyIcon } from "./SpotifyIcon"

export default function AuthButton() {
  const { data: session } = useSession();
  // console.log(session, "session new data")

  if (session) {
    return (
      <button className="h-[40px] w-fit p-[20px] border text-white flex items-center gap-2 cursor-pointer bg-[#1DB954]"  
        onClick={() => signOut()}
        >
        Logout
      </button>
  )
}
return <button onClick={() => signIn("spotify")} className="h-[40px] w-fit p-[20px] border text-white flex items-center gap-2 cursor-pointer bg-[#1DB954]"> Connect Spotify <SpotifyIcon/></button>
}
