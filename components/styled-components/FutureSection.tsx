"use client"
import Tagline from '../shared-component/Tagline'
import MHeading from '../shared-component/MHeading'
import FutureBox from '../shared-component/FutureBox'
import { Link as ScrollLink} from 'react-scroll'
import { ChevronRight } from "lucide-react";
import { futureInfo } from '@/lib/futureInfo'
import SubHeading from '../shared-component/SubHeading'

const FutureSection = () => {
  return (
    <section className='px-[20px] py-[64px] text-center w-full'>
        <div className='w-full md:max-w-[768px] md:mx-auto'>
            <Tagline text='Future'/>
            <MHeading text="Coming Soon"/>
            <SubHeading text="We're building more ways to match your mood. Precise. Intelligent. Adaptive."/>
        </div>
        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-[48px] mt-[48px] md:mt-[80px]">
            {futureInfo.map((f,idx) => 
                <FutureBox 
                    key={idx}
                    heading={f.name}
                    image={f.icon}
                    text={f.text}
                />
            )}
        </div>
    
        <ScrollLink
            to="contact" 
            smooth={true} 
            duration={500} 
            offset={-70} 
            className='flex items-center justify-center gap-[16px] h-[48px] text-dark px-[20px] mx-auto mt-[48px] md:mt-[80px] md:w-fit cursor-pointer border border-black'
        >
            More info  <ChevronRight className="w-4 h-4" />
        </ScrollLink>
    </section>
  )
}

export default FutureSection