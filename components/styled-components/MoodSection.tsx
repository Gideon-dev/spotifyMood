"use client"
import { AnimatedPage } from "../shared-component/AnimatedPage"
import MHeading from "../shared-component/MHeading"
import SubHeading from "../shared-component/SubHeading"
import Tagline from "../shared-component/Tagline"
import { MoodTab } from "./MoodTab"

export const  MoodHeader = ()=>{
    return(   
        <div className="text-center w-full max-w-[768px] mx-auto">
            <Tagline text="Mood"/>
            <MHeading text="What's your current Mood like?"/>
            <SubHeading text="From happy to chill, focus to sad, or energetic — your music starts here. Simple. Direct. Personal."/>
        </div>
    )
}

const MoodSection = () => {
   
  return (
    <AnimatedPage>
        <div id="mood" className="px-[24px] py-[64px]">
            <MoodHeader/>
            <MoodTab/>
        </div>
    </AnimatedPage>
  )
}

export default MoodSection