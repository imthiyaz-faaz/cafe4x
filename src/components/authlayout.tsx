import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f5f1] px-4 py-8">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('assets/images/homebg.jpg')" }}
      />    

      {/* Background overlay */}
      <div className="absolute inset-0 bg-white/75" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {/* Logo and heading */}
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-20 w-16 items-center justify-center border-[3px] border-[#593a28]">
            <span className="text-4xl text-[#805334]">♨</span>
          </div>

          <h1 className="text-3xl font-medium italic tracking-wide text-[#593a28] sm:text-4xl">
            Welcome to Cafe4X
          </h1>

          <div className="mx-auto mt-2 h-px w-64 bg-[#9a765e]/40" />
        </header>

        {children}
      </div>
    </main>
  )
}