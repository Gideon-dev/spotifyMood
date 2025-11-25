import ConnectSession from "@/components/styled-components/ConnectSession";
import HeadNav from "@/components/shared-component/HeadNav";
import HeroSection from "@/components/styled-components/HeroSection";
import MoodSection from "@/components/styled-components/MoodSection";
import SessionSection from "@/components/styled-components/SessionSection";
import FutureSection from "@/components/styled-components/FutureSection";
import FeedbackSection from "@/components/styled-components/FeedbackSection";

export default function Home() {
  return (
    <section className="max-w-[1440px] mx-auto w-full md:px-[64px]">
      <HeadNav />
      <HeroSection/>
      <MoodSection/>
      <ConnectSession/>
      <SessionSection/>
      <FutureSection/>
      <FeedbackSection/>
    </section>
  );
}