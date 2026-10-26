import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Coffee, Clock, Sparkles } from 'lucide-react'
import Background from '../../../components/background'
import { useAuth } from '../../../components/common/AuthContext'

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // If already authenticated, redirect to their authorized destination
  if (!isLoading && isAuthenticated && user) {
    const userRole = user.userType || 'Admin';
    const short = (user.shortCode || '').toUpperCase();
    if (userRole === 'Provider') {
      return <Navigate to={short ? `/${short}/provider` : '/provider'} replace />;
    }
    if (short) {
      return <Navigate to={`/${short}/landing`} replace />;
    }
    return <Navigate to="/home" replace />;
  }

  return (
    <Background>
      <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <section className="relative grid min-h-[560px] items-center gap-8 overflow-hidden py-8 md:grid-cols-2 md:gap-10 md:py-12">

            {/* Decorative background elements */}
            <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[#EAD5C0]/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-[#D7B18D]/20 blur-3xl" />

            {/* Empty first column on md+ screens to push content to the right */}
            <div className="hidden md:block" aria-hidden="true" />

            {/* RIGHT: Welcome content */}
            <div className="relative z-10 mx-auto w-full max-w-lg px-2 md:px-0">

              {/* Small label */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E9D7C6] bg-white/80 px-4 py-2 text-sm font-medium text-[#80563C] shadow-sm">
                <Sparkles size={16} />
                Your workplace café experience
              </div>

              {/* Heading */}
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#342219] sm:text-5xl lg:text-6xl">
                Welcome to
                <span className="mt-2 block text-[#8B5738]">
                  Cafe4X<span className="text-[#C99A6B]">.</span>
                </span>
              </h1>

              {/* Description */}
              <p className="mt-6 max-w-md text-base leading-8 text-[#8A7667] sm:text-lg">
                Great coffee, delicious refreshments, and effortless ordering.
                Make every workplace break a little more enjoyable with Cafe4X.
              </p>

              {/* Feature highlights */}
              <div className="mt-7 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-[#E9DACE] bg-white/80 px-3 py-2.5 text-sm text-[#70523E]">
                  <Coffee size={17} className="text-[#956341]" />
                  Fresh refreshments
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-[#E9DACE] bg-white/80 px-3 py-2.5 text-sm text-[#70523E]">
                  <Clock size={17} className="text-[#956341]" />
                  Easy ordering
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">

                <Link
                  to="/login"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#6F4228] to-[#A66C43] px-8 py-3.5 text-center font-semibold text-white shadow-lg shadow-[#70452D]/20 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  Login to Cafe4X
                  <ArrowRight
                    size={19}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>

                <Link
                  to="/signup"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#CDB49F] bg-white/80 px-8 py-3.5 text-center font-semibold text-[#6F4228] transition duration-300 hover:-translate-y-1 hover:border-[#6F4228] hover:bg-[#F5EBE1]"
                >
                  Create Account
                </Link>

              </div>

              {/* Footer note */}
              <div className="mt-8 flex items-center gap-3 text-sm text-[#9B8879]">
                <span className="h-px w-10 bg-[#D6BCA5]" />
                A better break starts here.
              </div>
            </div>
          </section>
        </div>
      </main>
    </Background>
  )
}