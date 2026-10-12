import type { ReactNode } from 'react'
import homeBackground from '../assets/images/homebg.jpg'

interface BackgroundProps {
  children: ReactNode
}

export default function Background({ children }: BackgroundProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F6F0E8]">

      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${homeBackground})`,
        }}
        aria-hidden="true"
      />

      {/* Soft Cream Overlay */}
      <div
        className="fixed inset-0 bg-[#FFFDF9]/75"
        aria-hidden="true"
      />

      {/* Warm Coffee Glow - Top Left */}
      <div
        className="pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full bg-[#D8B18D]/20 blur-3xl"
        aria-hidden="true"
      />

      {/* Warm Coffee Glow - Bottom Right */}
      <div
        className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#A66C43]/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Page Content */}
      <div className="relative z-10">
        {children}
      </div>

    </div>
  )
}