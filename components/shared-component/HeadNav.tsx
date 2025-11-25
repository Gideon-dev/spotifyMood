"use client";
import { Link } from "react-scroll";
import AuthButton from "./AuthButton";



const HeadNav = () => {
    
  return (
   <nav className='w-full p-[20px] flex items-center justify-between'>
        <span className=''>SpotifyMood</span>
        <div 
        style={{
            backgroundImage: `url('/side-ham.svg')`,
        }}
        className="bg-cover bg-no-repeat w-[13.5px] h-[13.5px] md:hidden"
        />
        <nav className="hidden md:flex md:items-center md:h-[40px]">
            <div className="flex items-center justify-center gap-[32px] md:mr-[32px] text-[16px]/[150%]">
                <Link to="explore" smooth={true} duration={500} offset={-70} className="cursor-pointer hover:text-moodHappy">
                    Explore
                </Link>
                <Link to="features" smooth={true} duration={500} offset={-70} className="cursor-pointer hover:text-moodSad">
                    Features
                </Link>
                <Link to="Moods" smooth={true} duration={500} offset={-70} className="cursor-pointer hover:text-moodChill">
                    Moods
                </Link>
                <Link to="about" smooth={true} duration={500} offset={-70} className="cursor-pointer hover:text-moodChill">
                    About
                </Link>
            </div>
            <div>
                <AuthButton/>
            </div>
        </nav>
   </nav>
  )
}

export default HeadNav