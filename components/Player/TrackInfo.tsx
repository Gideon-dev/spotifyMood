// import { TrackInfoProps } from "@/lib/Playback/types"

// export function TrackInfo({ track }: TrackInfoProps) {
//   if (!track) return null

//   const image = track.album.images?.[0]?.url ?? "/default-cover.jpg"
//   const artist = track.artists?.[0]?.name ?? "Unknown Artist"

//   return (
//     <div className="flex items-center gap-3">
//       <img src={image} alt={track.name} className="w-12 h-12 rounded" />
//       <div>
//         <p className="font-semibold">{track.name}</p>
//         <p className="text-sm text-gray-500">{artist}</p>
//       </div>
//     </div>
//   )
// }
