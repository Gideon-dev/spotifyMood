import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "./providers/ReactQueryProvider";


const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'], // pick the weights you need
   variable: '--font-roboto'
})


export const metadata: Metadata = {
  title: "SpotifyMood",
  description: "A Spotify-powered, mood-aware music experience that adapts to how you feel (or want to feel), enhancing listening, wellness, and discovery"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} antialiased`}
      >
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
      </body>
    </html>
  );
}
