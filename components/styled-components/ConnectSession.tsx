"use client"
import { ChevronRight } from "lucide-react";
import { Link as ScrollLink} from 'react-scroll'
import MoodBtn from '../shared-component/MoodBtn'
import Tagline from '../shared-component/Tagline'
import MHeading from '../shared-component/MHeading'
import SubHeading from '../shared-component/SubHeading'
import { useSession } from "next-auth/react";
import AuthButton from "../shared-component/AuthButton";
import { useMemo } from "react";

const ConnectSession = () => {
  const {data: session} = useSession();
  
  const dispayName = useMemo(() => {
    return session?.user?.displayName || "Spotify";
  }, [session?.user?.displayName]);

  return (
    <section id="connect" className="px-[20px] py-[64px] text-center w-full">
      <div className="w-full max-w-[768px] mx-auto">
        <Tagline text='Connect'/>
        <MHeading text='Connect Spotify to unlock your session'/>
        <SubHeading text="We'll play tracks directly from your Spotify account. Premium recommended. No complications."/>
      </div>
      <span className="flex flex-col md:flex-row items-center justify-center mt-[24px]">
        {session ? 
          <MoodBtn
            text={`Connected as ${dispayName}`}
            styling='px-[24px] py-[12px] bg-green-500 text-[16px]/[150%] text-white'
          /> : 
          <AuthButton/>
        }
        <ScrollLink
        to="contact" 
        smooth={true} 
        duration={500} 
        offset={-70} 
        className="flex items-center gap-2 justify-end pl-[24px] py-[12px] h-auto text-[16px]/[150%]"
        >
          Learn more  <ChevronRight className="w-2 h-2" />
        </ScrollLink>
      </span>
      <div
        className="w-full max-w-[335px] h-[188px] md:max-w-[1280px] md:h-[728px] bg-center bg-cover bg-no-repeat mt-[48px] md:mt-[80px]"
        style={{backgroundImage: `url('/spotify-img.webp')`}}
      />
    </section>
  )
}

export default ConnectSession