import type { Metadata } from "next";
import {  Roboto } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "./providers/ReactQueryProvider";
import Providers from "./providers/SessionProvider";
import { Toaster } from "@/components/ui/sonner";
import AuthContainer from "@/components/shared-component/AuthContainer";


const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
})


export const metadata: Metadata = {
  title: "SpotifyMood",
  description:
    "A Spotify-powered, mood-aware music experience that adapts to how you feel (or want to feel), enhancing listening, wellness, and discovery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.className} antialiased`}
      >
        <Providers> 
          <ReactQueryProvider>
            <AuthContainer> 
              {children}
            </AuthContainer>
          </ReactQueryProvider>
        </Providers>
        <Toaster/>
      </body>
    </html>
  );
}
