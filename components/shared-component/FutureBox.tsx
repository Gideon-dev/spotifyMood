"use client"
import { futureProps } from "@/lib/interface"

const FutureBox = ({heading, text, image}:futureProps) => {
  return (
    <div className="flex flex-col items-center">
        <div
         style={{backgroundImage: `url(${image})`}}
         className="bg-cover bg-center bg-no-repeat w-[48px] h-[48px] mb-[20px]"
        />
        <h2 className="font-[600] text-[24px]/[130%] text-brand-dark mb-[20px]">
            {heading}
        </h2>
        <p className="text-[16px]/[150%] font-[400]">
            {text}
        </p>
    </div>
  )
}

export default FutureBox