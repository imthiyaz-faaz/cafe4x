import { Sparkles, ArrowRight, Utensils, Clock, ShieldCheck, HeartHandshake } from "lucide-react";
import Background from "../components/background";
import Sidebar from "../components/sidebar/sidebar";

export default function LandingPage() {
  return (
    <Background>
      <Sidebar>
        {/* Main Content Area */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Hero / Welcome Banner */}
            <section className="relative my-4 overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white/85 p-6 shadow-xl shadow-[#70452D]/5 backdrop-blur-md sm:p-10 md:p-14">
              {/* Warm decorative gradients */}
              <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#EAD5C0]/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[#D7B18D]/25 blur-3xl" />

              <div className="relative z-10 text-center">
                {/* Badge */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E9D7C6] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#80563C] shadow-sm sm:text-sm">
                  <Sparkles size={16} />
                  Your workplace café, simplified
                </div>

                {/* Main Heading */}
                <h1 className="text-3xl font-bold tracking-tight text-[#342219] sm:text-5xl lg:text-6xl">
                  Welcome to{" "}
                  <span className="text-[#8B5738]">
                    Cafe4X<span className="text-[#C99A6B]">.</span>
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-[#70523E] sm:text-xl">
                  Where our app is your gateway to happiness
                </p>

                {/* Paragraph */}
                <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-[#8A7667] sm:text-base md:text-lg">
                  Let's make your ordering a breeze so your guests will enjoy
                  and remember your hospitality. Freshly brewed coffee, warm snacks,
                  and quick service whenever you need a break.
                </p>

                {/* Action CTA Buttons */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <a
                    href="#orders"
                    className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    View Active Orders
                    <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                  </a>

                  <a
                    href="#items"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#D5C2B1] bg-white/90 px-7 py-3 text-sm font-semibold text-[#6F4228] transition duration-300 hover:-translate-y-0.5 hover:border-[#6F4228] hover:bg-[#F7F2EB]"
                  >
                    Explore Menu
                  </a>
                </div>

                {/* Feature highlight cards */}
                <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3.5 rounded-2xl border border-[#EEE5DC] bg-[#FAF6F1] p-4 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D]">
                      <Utensils size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#342219]">Cafeteria Menu</p>
                      <p className="text-xs text-[#8A7667]">Fresh food & premium drinks</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-2xl border border-[#EEE5DC] bg-[#FAF6F1] p-4 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D]">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#342219]">Quick Dispatch</p>
                      <p className="text-xs text-[#8A7667]">Zero queue workplace breaks</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-2xl border border-[#EEE5DC] bg-[#FAF6F1] p-4 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D]">
                      <HeartHandshake size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#342219]">Hospitality First</p>
                      <p className="text-xs text-[#8A7667]">Designed for team delight</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto px-4 py-6 text-center text-xs text-[#9A8778]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2">
            <ShieldCheck size={15} />
            <span>Good Food. Better Days. © {new Date().getFullYear()} Cafe4X. All rights reserved.</span>
          </div>
        </footer>
      </Sidebar>
    </Background>
  );
}