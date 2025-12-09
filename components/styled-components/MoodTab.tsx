"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from "react"
import { moodsData } from "@/lib/moodsData"
import { Link as ScrollLink}  from "react-scroll"
import { motion,AnimatePresence } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { usePlaybackStore } from "@/app/store/usePlaybackStore"



export function MoodTab() {
  const {data: session} = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mood, setMood] = useState(searchParams.get("mood") || "happy");
  const startSession = usePlaybackStore((p)=> p.startSession)
  const playMoodTrack = usePlaybackStore((s) => s.playMoodTrack)
 
 
  // whenever query changes, update URL
  useEffect(() => {
    const current = searchParams.get("mood");
    if (mood !== current) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mood", mood);
      router.replace(`?${params.toString()}`,{scroll: false});
    }
  }, [mood, searchParams, router]);


  //function to handle mood-selection
  const handleMoodSelect = async(mood: string) => {
    try{
      setMood(mood)
      if(session?.user?.spotifyId){
        // 1️⃣ Start a new mood session in DB (mood_sessions)
        await startSession(mood,{time: Date.now()})
        
        
        // 2️⃣ Fetch recommendations & play first track
        await playMoodTrack(mood)
      }
      return
    }catch(err){
      toast('Unable to start Session')
      console.error(err)
    }
  }
 

  return (
    <div className="flex w-full flex-col gap-6 mt-[48px] border border-black md:h-[724px]">
      <Tabs defaultValue={mood} onValueChange={setMood} className="w-full">
        <TabsList className="flex flex-col w-full text-dark h-auto md:flex-row p-0">
          {moodsData.moods.map((md,idx) => 
            <TabsTrigger 
              key={idx}
              value={md.name} 
              className={`bg-[#fff] border-b border-black cursor-pointer w-full flex items-center justify-start px-[32px] py-[24px] capitalize rounded-none text-[18px] leading-[140%] font-[700] 
              data-[state=active]:bg-[#191414] data-[state=active]:text-[#1DB954] 
              md:data-[state=active]:bg-white md:data-[state=active]:text-black 
              md:border-r md:border-b md:border-black md:data-[state=active]:border-r md:data-[state=active]:border-b-0
              `}
            >
              {md.name}
            </TabsTrigger>
          )}
        </TabsList>
        <AnimatePresence mode="wait">
          {moodsData.moods
          .filter((m) => m.name === mood)
          .map((m) => 
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <TabsContent value={m.name} className="">

                <Card className="rounded-none shadow-none p-[24px] flex flex-col items-start border-none md:flex-row md:items-center  md:gap-[80px]">
                  <CardHeader>
                    <CardTitle className="capitalize mb-[12px] md:mb-[16px]">{m.name}</CardTitle>
                    <CardDescription className="text-dark font-[700] text-[40px]/[120%] mb-[20px] md:max-w-[552px]">
                      <p className="text-left md:mb-[24px]">
                        {m.headline}
                      </p>
                      <p className="text-[16px]/[150%] text-black mb-[24px] font-normal">{m.text}</p>
                      <ScrollLink 
                      to="session" 
                      smooth={true} 
                      duration={500} 
                      offset={-70} 
                      onClick={()=>{ 
                        handleMoodSelect(m.name)
                      }}
                      className=" px-[24px] py-[12px] h-[48px] w-[96px] rounded-none border border-brand-dark text-dark text-[16px] bg-bleach">
                        {m.cta}
                      </ScrollLink>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="w-full md:w-[50%]">
                    <div 
                      style={{backgroundImage: `url(${m.img})`}}
                      className="h-[287px] lg:h-[552px] w-full max-w-[552px] relative bg-cover bg-center bg-no-repeat mt-[48px] md:mt-0"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  )
}
