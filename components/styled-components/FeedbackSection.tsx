"use client"
import MHeading from "../shared-component/MHeading"
import SubHeading from "../shared-component/SubHeading"

const FeedbackSection = () => {
  return (
    <section className="px-[20px] py-[64px] text-center"> 
      <MHeading text="We'd love your feedback"/>
      <SubHeading text="Help shape ShopifyMood. Your voice matters. Direct input drives our evolution"/>
      <form className="flex flex-col gap-[12px]">
        <input className="w-full h-[48px] px-[20px]" placeholder="Your name"/>
        <button type="submit" className="w-full h-[48px] bg-brand-dark text-bleach px-[24px] py-[12px] text-[16px]/[150%]">
            Join waitlist
        </button>
        <span className="">By joining you agree to our terms and service.</span>
      </form>
    </section>
  )
}

export default FeedbackSection;