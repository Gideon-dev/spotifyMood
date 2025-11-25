"use client"
import { headingProps } from '@/lib/interface'

const MHeading = ({text, styling}: headingProps) => {
  return (
    <h2 className={`${styling} text-[36px]/[120%] text-dark font-bold md:text-[48px]/[120%] mb-[20px]`}>
        {text}
    </h2>
  )
}

export default MHeading