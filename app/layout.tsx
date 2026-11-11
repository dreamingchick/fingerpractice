import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "찰나의 해적", description: "10초의 기다림. 승부는 그다음 찰나. 0초 직후 터치하는 모바일 타이밍 게임", icons: { icon: "/favicon.svg" } };
export default function Layout({children}: Readonly<{children:React.ReactNode}>) {return <html lang="ko"><body>{children}<script defer src="https://garu-arcade-hub.snugbrink3.chatgpt.site/visit.js" data-garu-game="pirate" /></body></html>}
