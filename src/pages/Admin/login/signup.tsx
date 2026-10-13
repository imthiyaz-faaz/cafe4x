import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Coffee,
  UserRound,
  Mail,
  Phone,
  LockKeyhole,
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import Background from '../../../components/background'

interface SignupData {
  username: string
  name: string
  mobile: string
  email: string
  password: string
  organization: string
  address: string
}

const initialData: SignupData = {
  username: '',
  name: '',
  mobile: '',
  email: '',
  password: '',
  organization: '',
  address: '',
}

const steps = [
  { label: 'Sign up', description: 'Your account' },
  { label: 'Organization', description: 'Your workplace' },
  { label: 'Completed', description: 'All set' },
]

export default function Signup() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<SignupData>(initialData)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function updateField(field: keyof SignupData, value: string) {
    setData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (step === 1) {
      setStep(2)
      return
    }

    if (step === 2) {
      setStep(3)
      return
    }

    // UI only: connect your existing signup API here.
    console.log('Signup data:', data)
  }

  function handleBack() {
    setError('')
    setStep((previous) => Math.max(1, previous - 1))
  }

  const inputClass =
    'w-full rounded-xl border border-[#E8DED4] bg-white py-3.5 pl-11 pr-4 text-sm text-[#302018] outline-none transition placeholder:text-[#B1A69D] focus:border-[#9A6747] focus:ring-4 focus:ring-[#9A6747]/10'

  return (
    <Background>
      <main className="px-4 py-8 sm:px-6 sm:py-10 flex items-center justify-center min-h-screen">
        <section className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl bg-[#FFFDFA] p-4 shadow-xl shadow-[#70452D]/5 sm:p-7 lg:p-10">

          {/* Decorative background */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#EBD8C5]/40 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#F2E5D7]/60 blur-3xl" />

          <div className="relative z-10">

            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2E6D9] text-[#75472D]">
                <Coffee size={29} />
              </div>

              <p className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A66F48]">
                <Sparkles size={14} />
                Welcome to Cafe4X
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-[#342219] sm:text-4xl">
                Create your account
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#897B71] sm:text-base">
                Get started with a simpler, smarter café ordering experience.
              </p>
            </div>

            {/* Step indicator */}
            <div className="mx-auto mb-9 grid max-w-2xl grid-cols-3">
              {steps.map((item, index) => {
                const stepNumber = index + 1
                const active = step === stepNumber
                const completed = step > stepNumber

                return (
                  <div key={item.label} className="relative text-center">

                    {/* Connecting line */}
                    {index < steps.length - 1 && (
                      <div
                        className={`absolute left-1/2 top-5 h-0.5 w-full ${completed ? 'bg-[#9A6747]' : 'bg-[#E8DED4]'
                          }`}
                      />
                    )}

                    {/* Step circle */}
                    <div className="relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${active
                          ? 'border-[#75472D] bg-[#75472D] text-white shadow-lg shadow-[#75472D]/20'
                          : completed
                            ? 'border-[#75472D] bg-[#75472D] text-white'
                            : 'border-[#E8DED4] bg-white text-[#A09287]'
                          }`}
                      >
                        {completed ? (
                          <Check size={18} />
                        ) : (
                          <span className="text-sm font-semibold">
                            {stepNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <p
                      className={`mt-3 text-xs font-semibold sm:text-sm ${active || completed
                        ? 'text-[#593A28]'
                        : 'text-[#A09287]'
                        }`}
                    >
                      {item.label}
                    </p>

                    <p className="mt-1 hidden text-xs text-[#A09287] sm:block">
                      {item.description}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Form card */}
            <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#EEE5DC] bg-white p-5 shadow-sm sm:p-8">

              {/* STEP 1 */}
              {step === 1 && (
                <form onSubmit={handleSubmit} className="space-y-5">

                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-[#342219]">
                      Personal details
                    </h2>

                    <p className="mt-1 text-sm text-[#897B71]">
                      Enter your details to create your Cafe4X account.
                    </p>
                  </div>

                  {/* Username */}
                  <div>
                    <label
                      htmlFor="username"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Username
                    </label>

                    <div className="relative">
                      <UserRound
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="username"
                        required
                        autoComplete="username"
                        placeholder="Choose a username"
                        value={data.username}
                        onChange={(event) =>
                          updateField('username', event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Full name
                    </label>

                    <div className="relative">
                      <UserRound
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="name"
                        required
                        autoComplete="name"
                        placeholder="Enter your full name"
                        value={data.name}
                        onChange={(event) =>
                          updateField('name', event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Mobile */}
                  <div>
                    <label
                      htmlFor="mobile"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Mobile number
                    </label>

                    <div className="relative">
                      <Phone
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="mobile"
                        required
                        type="tel"
                        autoComplete="tel"
                        placeholder="Enter your mobile number"
                        value={data.mobile}
                        onChange={(event) =>
                          updateField('mobile', event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Email address
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="email"
                        required
                        type="email"
                        autoComplete="email"
                        placeholder="Enter your email address"
                        value={data.email}
                        onChange={(event) =>
                          updateField('email', event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <LockKeyhole
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="password"
                        required
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        placeholder="Create a password (8+ characters)"
                        value={data.password}
                        onChange={(event) =>
                          updateField('password', event.target.value)
                        }
                        className={`${inputClass} pr-12`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#9C8B7D] transition hover:bg-[#F7F2EB]"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    Continue to Organization
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </button>
                </form>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <form onSubmit={handleSubmit} className="space-y-5">

                  <div className="mb-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D]">
                      <Building2 size={24} />
                    </div>

                    <h2 className="text-xl font-bold text-[#342219]">
                      Organization details
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-[#897B71]">
                      Tell us about your café or organization.
                    </p>
                  </div>

                  {/* Organization */}
                  <div>
                    <label
                      htmlFor="organization"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Organization / Café name
                    </label>

                    <div className="relative">
                      <Building2
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="organization"
                        required
                        autoComplete="organization"
                        placeholder="Enter organization name"
                        value={data.organization}
                        onChange={(event) =>
                          updateField('organization', event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label
                      htmlFor="address"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Organization address
                    </label>

                    <div className="relative">
                      <MapPin
                        size={18}
                        className="absolute left-4 top-4 text-[#A08C7D]"
                      />

                      <textarea
                        id="address"
                        required
                        autoComplete="street-address"
                        placeholder="Enter your organization address"
                        value={data.address}
                        onChange={(event) =>
                          updateField('address', event.target.value)
                        }
                        className={`${inputClass} min-h-32 resize-y py-4`}
                      />
                    </div>
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E8DED4] bg-white px-5 py-3.5 text-sm font-semibold text-[#6F4228] transition hover:bg-[#F7F2EB]"
                    >
                      <ArrowLeft size={17} />
                      Back
                    </button>

                    <button
                      type="submit"
                      className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      Complete Signup
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="py-5 text-center sm:py-8">

                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600 ring-8 ring-green-50/70">
                    <Check size={38} strokeWidth={2.5} />
                  </div>

                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#A66F48]">
                    Registration details collected
                  </p>

                  <h2 className="text-3xl font-bold text-[#342219]">
                    All Done!
                  </h2>

                  <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-[#897B71]">
                    Your details have been collected successfully. Connect the
                    registration API to create your account and finish the
                    registration process.
                  </p>

                  <div className="mt-7 rounded-xl border border-[#EEE5DC] bg-[#FAF6F1] p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#9A6747]">
                      Registration summary
                    </p>

                    <p className="mt-3 text-sm font-semibold text-[#45352B]">
                      {data.name}
                    </p>

                    <p className="mt-1 text-sm text-[#897B71]">
                      {data.email}
                    </p>

                    <p className="mt-1 text-sm text-[#897B71]">
                      {data.organization}
                    </p>
                  </div>

                  <Link
                    to="/login"
                    className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    Go to Login
                    <ArrowRight size={18} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setData(initialData)
                      setStep(1)
                      setError('')
                      setShowPassword(false)
                    }}
                    className="mt-4 text-sm font-semibold text-[#87512F] transition hover:text-[#4B2A19]"
                  >
                    Start Again
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-[#A09287]">
              <ShieldCheck size={15} />
              Secure registration for your Cafe4X experience
            </div>

            {/* Login link */}
            {step === 1 && (
              <p className="mt-5 text-center text-sm text-[#897B71]">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-[#87512F] transition hover:text-[#4B2A19]"
                >
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </section>
      </main>
    </Background>
  )
}