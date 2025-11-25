import { headingProps } from '@/lib/interface'
import React from 'react'



const Tagline = ({text,styling}: headingProps) => {
  return (
    <h3 className={`text-[16px]/[150%] font-semibold  text-dark mb-[12px] ${styling}`}>
        {text}
    </h3>
  )
}

export default Tagline