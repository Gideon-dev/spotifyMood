"use client"
import { Link as ScrollLink } from "react-scroll";
import { AnimatedPage } from "../shared-component/AnimatedPage";

const HeroSection = () => {
  return (
   <main className='min-h-[492px] p-[20px] md:min-h-[800px] w-full  md:py-[80px] flex items-center justify-center'>
        <AnimatedPage styling="w-full">
            <div className='h-full bg-[#121212]/[50%] w-full text-center p-[32px] md:min-h-[640px] md:flex md:flex-col md:items-center md:justify-center'>
                <h1 className='font-bold text-[40px] text-[#fff] leading-[120%] mb-[20px] md:mb-[24px] md:text-[56px]/[120%] md:font-bold md:max-w-[768px]'>Music that matches your mood</h1>
                <p className='text-[16px] text-[#fff] pb-[24px] md:text-[18px]/[150%] md:font-normal md:max-w-[768px]'>Pick a mood, connect Spotify, and dive into a playlist that adapts as you listen. No noise. Just pure emotion.</p>
                  <div className="flex w-full justify-between items-center md:max-w-[260px]">
                    <ScrollLink 
                    to="mood" 
                    smooth={true} 
                    duration={500} 
                    offset={-70} 
                    className={`w-[49%] cursor-pointer h-[48px] bg-[#fff] text-black p-[24px] text-[16px] flex items-center justify-center
                    md:w-fit
                    `} >
                        Try demo
                    </ScrollLink>
                    <ScrollLink 
                    to="features" 
                    smooth={true} 
                    duration={500} 
                    offset={-70} 
                    className={`w-[49%] cursor-pointer h-[48px] bg-[#121212]/[50%] text-[#fff] p-[24px] text-[16px] flex items-center border border-[#fff]
                    md:w-fit 
                    `} >
                    Learn more
                    </ScrollLink>
                    {/* <Checkbox className="w-4 h-4" /> */}
                </div>
            </div>
        </AnimatedPage>
   </main>
  )
}

export default HeroSection