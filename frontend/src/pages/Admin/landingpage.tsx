import { Sparkles, Utensils, Clock, ShieldCheck, HeartHandshake } from "lucide-react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { useAuth } from "../../components/common/AuthContext";

export default function LandingPage() {
  const params = useParams();
  const shortCode = params.shortCode;
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(user);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
        return;
      }
    } catch {}
    if (user) {
      setCurrentUser(user);
    }
  }, [shortCode, user]);

  const matchedOrgName = (() => {
    if (shortCode) {
      const codeUpper = shortCode.toUpperCase();
      try {
        const storedOrgs = localStorage.getItem("cafe4x_organizations");
        if (storedOrgs) {
          const list = JSON.parse(storedOrgs);
          const found = list.find((o: any) => (o.shortCode || "").toUpperCase() === codeUpper);
          if (found && found.name) return found.name;
        }
      } catch {}
      if (currentUser?.shortCode?.toUpperCase() === codeUpper && currentUser.organization) {
        return currentUser.organization;
      }
      return `${codeUpper} Workplace`;
    }
    return currentUser?.organization || "Cafe4X";
  })();

  const orgName = matchedOrgName;
  const codeTag = shortCode ? shortCode.toUpperCase() : (currentUser?.shortCode || "");

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

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
                  {codeTag ? `${codeTag} • Your workplace café, simplified` : "Your workplace café, simplified"}
                </div>

                {/* Main Heading */}
                <h1 className="text-3xl font-bold tracking-tight text-[#342219] sm:text-5xl lg:text-6xl">
                  Welcome to{" "}
                  <span className="text-[#8B5738]">
                    {orgName}
                    <span className="text-[#C99A6B]">.</span>
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
      </div>
    </Background>
  );
}