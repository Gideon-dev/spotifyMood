"use client"
import { useSession } from "next-auth/react"
import MHeading from "../shared-component/MHeading"
import MoodBtn from "../shared-component/MoodBtn"
import SubHeading from "../shared-component/SubHeading"
import Tagline from "../shared-component/Tagline"
import dynamic from "next/dynamic"

const PlayerContainer = dynamic(()=> import("../Player/PlayerContainer"), {
  ssr:false,
  loading: () => <div className="text-black "> loading...</div>
})

const SessionSection = () => {
  const{data: session} = useSession();
  
  return (
    <section id="session" className="px-[20px] py-[64px] text-center ">
      <div className="w-full md:max-w-[768px] mx-auto">
        <Tagline text='Session'/>
        <MHeading text='Your mood = Your music'/>
        <SubHeading text='A personalized playlist that moves with you. Raw. Real. Responsive'/>
      </div>
      {!session && (
        <div className="w-full md:flex md:items-center  md:h-[640px] mt-[48px] md:mt-[80px] md:border md:border-black">
          <div className="p-[24px] text-left md:p-[48px]">
            <Tagline text='Track'/>
            <MHeading text='Personalized Listening Experience'/>
            <SubHeading text='Tracks update based on your reactions. Clean. Simple. Intuitive'/>
            <MoodBtn text="Play" styling="px-[24px] border border-black bg-white text-black mt-[24px]" />
          </div>
          <div className="h-[326px] w-full max-w-[335px] md:h-full md:max-w-[640px] border"/>
        </div>
      )}
      <PlayerContainer />
    </section>
  )
}

export default SessionSection