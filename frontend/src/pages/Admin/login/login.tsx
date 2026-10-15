import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Coffee,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Background from "../../../components/background";
import { authApi } from "../../../services/auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    if (!inputUser || !inputPass) {
      setError("Please enter your username/email and password.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Send request to backend API
      const res = await authApi.login({
        usernameOrEmail: inputUser,
        password: inputPass,
      });

      if (res.success && res.user) {
        if (res.token) {
          localStorage.setItem("cafe4x_token", res.token);
        }
        localStorage.setItem("cafe4x_currentUser", JSON.stringify(res.user));

        if (res.organizations && res.organizations.length > 0) {
          localStorage.setItem("cafe4x_organizations", JSON.stringify(res.organizations));
        }

        if (res.user.userType === "Provider") {
          const userShortCode = res.user.shortCode ? res.user.shortCode.toUpperCase() : "";
          navigate(userShortCode ? `/${userShortCode}/provider` : "/provider");
          return;
        }

        // Navigate to Choose Organization page
        navigate("/home");
        return;
      }
    } catch (apiErr: any) {
      // If the backend returned an explicit error (401, 400, etc.), do not bypass password check
      if (apiErr.message && !apiErr.message.includes("Failed to fetch") && !apiErr.message.includes("NetworkError")) {
        setError(apiErr.message || "Invalid username/email or password.");
        return;
      }

      // Offline / fallback only: check local storage users with password verification
      let userList: any[] = [];
      try {
        const stored = localStorage.getItem("cafe4x_users");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            userList = parsed;
          }
        }
      } catch { }

      const matchedUser = userList.find(
        (u: any) =>
          ((u.email && u.email.toLowerCase() === inputUser) ||
            (u.userName && u.userName.toLowerCase() === inputUser)) &&
          u.password === inputPass
      );

      if (matchedUser) {
        const { password: _, ...userSafe } = matchedUser;
        localStorage.setItem("cafe4x_currentUser", JSON.stringify(userSafe));
        if (userSafe.userType === "Provider") {
          const userShortCode = userSafe.shortCode ? userSafe.shortCode.toUpperCase() : "";
          navigate(userShortCode ? `/${userShortCode}/provider` : "/provider");
          return;
        }
        navigate("/home");
        return;
      }

      setError(apiErr.message || "Invalid credentials. Please verify your login details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Background>
      <main className="p-3 sm:p-5 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-64px)]">

          {/* LEFT: CAFE IMAGE */}
          <section className="relative hidden w-1/2 overflow-hidden lg:block">
            <img
              src="/src/assets/images/hero.png"
              alt="Cafe4X coffee experience"
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-b from-[#29170D]/70 via-[#29170D]/20 to-[#29170D]/85" />

            <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">

              {/* Brand */}
              <Link to="/" className="flex w-fit items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-[#E8B77C] backdrop-blur-md">
                  <Coffee size={28} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Cafe<span className="text-[#E8B77C]">4X</span>
                  </h1>
                  <p className="text-[10px] tracking-[0.25em] text-white/70">
                    OFFICE CAFE MANAGEMENT
                  </p>
                </div>
              </Link>

              {/* Welcome content */}
              <div className="max-w-lg pb-8">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Your workplace café, simplified
                </div>

                <h2 className="text-5xl font-semibold leading-tight text-white xl:text-6xl">
                  Good Food.
                  <br />
                  <span className="text-[#E8B77C]">
                    Better Days.
                  </span>
                </h2>

                <p className="mt-6 max-w-md text-base leading-7 text-white/80">
                  Your favourite coffee and refreshments, just a few clicks
                  away. Sign in and make your next coffee break effortless.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white">
                    ☕ Freshly Brewed
                  </span>

                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white">
                    ✓ Employee Access
                  </span>
                </div>
              </div>

              <p className="text-xs text-white/60">
                Good Food. Better Days. © {new Date().getFullYear()} Cafe4X
              </p>
            </div>
          </section>

          {/* RIGHT: LOGIN FORM */}
          <section className="relative flex w-full items-center justify-center overflow-hidden bg-[#FFFDFA] px-5 py-10 sm:px-10 lg:w-1/2 lg:px-12 xl:px-20">

            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#EBD8C5]/40 blur-3xl" />

            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#F2E5D7]/60 blur-3xl" />

            <div className="relative z-10 w-full max-w-md">

              {/* Mobile brand */}
              <Link to="/" className="mb-10 flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6F4228] text-[#F3D1A8]">
                  <Coffee size={25} />
                </div>

                <div>
                  <h1 className="text-xl font-bold text-[#392317]">
                    Cafe<span className="text-[#A9683E]">4X</span>
                  </h1>
                  <p className="text-[9px] tracking-[0.2em] text-[#8D7A6C]">
                    OFFICE CAFE MANAGEMENT
                  </p>
                </div>
              </Link>

              {/* Heading */}
              <div className="mb-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2E6D9] text-[#75472D]">
                  <Coffee size={29} />
                </div>

                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#A66F48]">
                  Welcome Back
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-[#302018] sm:text-4xl">
                  Sign in to Cafe4X
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#897B71] sm:text-base">
                  Your next coffee break is just a moment away.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">

                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-semibold text-[#45352B]"
                  >
                    Username or Email
                  </label>

                  <div className="flex items-center rounded-xl border border-[#E8DED4] bg-white transition focus-within:border-[#9A6747] focus-within:ring-4 focus-within:ring-[#9A6747]/10">
                    <Mail className="ml-4 shrink-0 text-[#A08C7D]" size={19} />

                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="w-full bg-transparent px-3 py-4 text-sm text-[#302018] outline-none placeholder:text-[#B1A69D]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="text-sm font-semibold text-[#45352B]"
                    >
                      Password
                    </label>

                    <Link
                      to="/forgot-password"
                      className="text-xs font-semibold text-[#996341] transition hover:text-[#5D3521]"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="flex items-center rounded-xl border border-[#E8DED4] bg-white transition focus-within:border-[#9A6747] focus-within:ring-4 focus-within:ring-[#9A6747]/10">
                    <LockKeyhole
                      className="ml-4 shrink-0 text-[#A08C7D]"
                      size={19}
                    />

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent px-3 py-4 text-sm text-[#302018] outline-none placeholder:text-[#B1A69D]"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="mr-3 rounded-lg p-2 text-[#9C8B7D] transition hover:bg-[#F7F2EB] hover:text-[#6F4228]"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex w-fit cursor-pointer items-center gap-3 py-1 text-sm text-[#75675D]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-[#75472D]"
                  />
                  Remember me
                </label>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
              </form>

              {/* Signup */}
              <div className="mt-8 text-center text-sm text-[#897B71]">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-[#87512F] transition hover:text-[#4B2A19]"
                >
                  Sign up
                </Link>
              </div>

              {/* Footer */}
              <div className="mt-10 flex items-center justify-center gap-2 border-t border-[#EEE5DC] pt-6 text-xs text-[#A09287]">
                <ShieldCheck size={15} />
                Secure access to your workplace café
              </div>
            </div>
          </section>
        </div>
      </main>
    </Background>
  );
}