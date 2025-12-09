// app/api/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt";
 

type SeedParams = {
  seed_genres: string[];
  target_valence: number;
  target_energy: number;
  [key: string]: string[] | number; 
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mood = searchParams.get("mood") || "chill"
  const token = await getToken({ req });
  const accessToken = token?.accessToken;  


  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 })
  }

  // Map moods to energy/valence values
  const moodMap:Record<string,SeedParams> = {
    happy: { seed_genres: ["pop", "dance"], target_valence: 0.8, target_energy: 0.7 },
    sad: { seed_genres: ["acoustic", "piano"], target_valence: 0.3, target_energy: 0.4 },
    chill: { seed_genres: ["chill", "ambient"], target_valence: 0.5, target_energy: 0.3 },
    energetic: { seed_genres: ["workout", "rock"], target_valence: 0.7, target_energy: 0.9 },
    focus: { seed_genres: ["focus"],target_valence: 0.4, target_energy: 0.6 },
  } 
  
  const seeds = moodMap[mood] || moodMap["chill"];
  
  const query = new URLSearchParams({
    seed_genres: seeds.seed_genres.join(","),
    limit: "10",
    ...Object.fromEntries(
      Object.entries(seeds)
      .filter(([key]) => key !== "seed_genres")
      .map(([key, value]) => [key, value.toString()])
    ),
  });

  const res = await fetch(`https://api.spotify.com/v1/recommendations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: {revalidate: 300}
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  console.log(data,"queue tracks")
  return NextResponse.json(data)
}