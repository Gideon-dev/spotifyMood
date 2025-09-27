type stylingProps = {
    text: string,
    styling:string
}

const MoodBtn = ({text, styling}: stylingProps) => {
  return (
   <button className={`${styling} cursor-pointer`}>
        {text}
   </button>
  )
}

export default MoodBtn