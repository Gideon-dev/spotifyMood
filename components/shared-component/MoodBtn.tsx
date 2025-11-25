"use client"

import { Button } from "../ui/button"

type stylingProps = {
    text: string,
    styling?:string,
    onclick?: () => void
}

const MoodBtn = ({text, styling, onclick}: stylingProps) => {
  return (
   <Button className={`${styling} h-[48px] rounded-none text-center`} onClick={onclick}>
    {text}
   </Button>
  )
}

export default MoodBtn