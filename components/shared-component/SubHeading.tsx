import { headingProps } from '@/lib/interface'

const SubHeading = ({text,styling}:headingProps) => {
  return (
    <p className={`${styling} text-[16px]/[150%] font-normal md:text-[18px]/[150%] text-dark`}>
        {text}
    </p>
  )
}

export default SubHeading