import { Sparkles, ShieldCheck, Shield, Users, MapPin, AlertCircle, RotateCw } from "lucide-react";
import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { useAuth } from "../../components/common/AuthContext";
import { userApi } from "../../services/userApi";
import { locationApi } from "../../services/locations";

export default function LandingPage() {
  const params = useParams();
  const shortCode = params.shortCode;
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(user);

  // Statistics State
  const [adminCount, setAdminCount] = useState<number>(0);
  const [providerCount, setProviderCount] = useState<number>(0);
  const [locationCount, setLocationCount] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);

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

  // Fetch Dashboard Statistics for currently selected organization
  const fetchDashboardStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);

    const effectiveCode = shortCode || currentUser?.shortCode || undefined;

    try {
      const [usersRes, locsRes] = await Promise.all([
        userApi.getUsers(undefined, effectiveCode),
        locationApi.getLocations(undefined, effectiveCode),
      ]);

      // Calculate Admin and Provider counts
      if (Array.isArray(usersRes)) {
        const admins = usersRes.filter((u: any) => (u.userType || "").toLowerCase() === "admin");
        const providers = usersRes.filter((u: any) => (u.userType || "").toLowerCase() === "provider");
        setAdminCount(admins.length);
        setProviderCount(providers.length);
      } else {
        setAdminCount(0);
        setProviderCount(0);
      }

      // Calculate Location count
      if (Array.isArray(locsRes)) {
        setLocationCount(locsRes.length);
      } else {
        setLocationCount(0);
      }
    } catch (err: any) {
      console.warn("Failed to load dashboard statistics:", err);
      setStatsError(err.message || "Failed to load organization statistics.");
    } finally {
      setIsLoadingStats(false);
    }
  }, [shortCode, currentUser?.shortCode]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

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

                {/* Dashboard Statistics Section */}
                <div className="mt-12">
                  {isLoadingStats ? (
                    /* Loading Skeleton State */
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className="flex flex-col rounded-2xl border border-[#EEE5DC] bg-white/70 p-5 text-left shadow-sm backdrop-blur-xs animate-pulse"
                        >
                          <div className="flex items-center justify-between">
                            <div className="h-4 w-28 rounded-lg bg-[#EADBCE]/80" />
                            <div className="h-11 w-11 rounded-xl bg-[#EADBCE]/60" />
                          </div>
                          <div className="mt-4 h-9 w-16 rounded-lg bg-[#EADBCE]/90" />
                          <div className="mt-2 h-3 w-36 rounded-md bg-[#EADBCE]/50" />
                        </div>
                      ))}
                    </div>
                  ) : statsError ? (
                    /* Error State with Retry */
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center text-xs text-amber-900 shadow-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span>{statsError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={fetchDashboardStats}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#75472D] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#5C3620] cursor-pointer"
                      >
                        <RotateCw size={13} />
                        <span>Retry</span>
                      </button>
                    </div>
                  ) : (
                    /* Statistics Cards Grid */
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Card 1: Total Admins */}
                      <div className="group relative flex flex-col justify-between rounded-2xl border border-[#EEE5DC] bg-gradient-to-b from-white to-[#FAF6F1] p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#D9C4B3] hover:shadow-md">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#8A7667]">
                              Total Admins
                            </p>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D] shadow-2xs group-hover:bg-[#EAD5C0] transition-colors">
                              <Shield size={20} />
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className="text-3xl font-extrabold tracking-tight text-[#342219] sm:text-4xl">
                              {adminCount}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-[#8A7667]">
                          Active administrator accounts
                        </p>
                      </div>

                      {/* Card 2: Total Providers */}
                      <div className="group relative flex flex-col justify-between rounded-2xl border border-[#EEE5DC] bg-gradient-to-b from-white to-[#FAF6F1] p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#D9C4B3] hover:shadow-md">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#8A7667]">
                              Total Providers
                            </p>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D] shadow-2xs group-hover:bg-[#EAD5C0] transition-colors">
                              <Users size={20} />
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className="text-3xl font-extrabold tracking-tight text-[#342219] sm:text-4xl">
                              {providerCount}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-[#8A7667]">
                          Assigned service providers
                        </p>
                      </div>

                      {/* Card 3: Total Locations */}
                      <div className="group relative flex flex-col justify-between rounded-2xl border border-[#EEE5DC] bg-gradient-to-b from-white to-[#FAF6F1] p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#D9C4B3] hover:shadow-md sm:col-span-2 lg:col-span-1">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#8A7667]">
                              Total Locations
                            </p>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D] shadow-2xs group-hover:bg-[#EAD5C0] transition-colors">
                              <MapPin size={20} />
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className="text-3xl font-extrabold tracking-tight text-[#342219] sm:text-4xl">
                              {locationCount}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-[#8A7667]">
                          Configured workplace locations
                        </p>
                      </div>
                    </div>
                  )}
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