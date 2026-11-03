import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Coffee,
  UserRound,
  Mail,
  Phone,
  LockKeyhole,
  Building2,
  Hash,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Search,
} from 'lucide-react'
import Background from '../../../components/background'
import { authApi } from '../../../services/auth'
import { organizationApi } from '../../../services/organizations'
import { getAllCountries, type CountryInfo } from '../../../utils/countries'
import { validateEmailFormat, validateMobileNumber } from '../../../utils/validation'

interface SignupData {
  username: string
  name: string
  mobile: string
  email: string
  password: string
  organization: string
  shortCode: string
}

const initialData: SignupData = {
  username: '',
  name: '',
  mobile: '',
  email: '',
  password: '',
  organization: '',
  shortCode: '',
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
  const [isLoading, setIsLoading] = useState(false)

  // Countries and selection
  const countries = useMemo(() => getAllCountries(), [])
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    return countries.find((c) => c.code === 'IN') || countries[0]
  })
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryDropdownRef = useRef<HTMLDivElement | null>(null)

  // Mobile validation state
  const [mobileStatus, setMobileStatus] = useState<
    'idle' | 'incomplete' | 'invalid' | 'valid'
  >('idle')
  const [mobileMessage, setMobileMessage] = useState('')
  const [normalizedMobileE164, setNormalizedMobileE164] = useState('')

  // Filtered countries based on search query
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    )
  }, [countries, countrySearch])

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCountryDropdownOpen(false)
      }
    }
    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCountryDropdownOpen])

  // Real-time mobile number validation when input or selected country changes
  useEffect(() => {
    if (!data.mobile) {
      setMobileStatus('idle')
      setMobileMessage('')
      setNormalizedMobileE164('')
      return
    }

    const res = validateMobileNumber(data.mobile, selectedCountry.code)
    setMobileStatus(res.status)
    setMobileMessage(res.message)
    if (res.status === 'valid' && res.e164Number) {
      setNormalizedMobileE164(res.e164Number)
    } else {
      setNormalizedMobileE164('')
    }
  }, [data.mobile, selectedCountry])



  // Real-time email validation state (emails must be unique)
  const [emailStatus, setEmailStatus] = useState<
    'idle' | 'checking' | 'valid' | 'invalid'
  >('idle')
  const [emailMessage, setEmailMessage] = useState('')

  // AbortController to cancel outdated in-flight email validation requests
  const emailAbortRef = useRef<AbortController | null>(null)

  // Debounced Email Validation
  useEffect(() => {
    const trimmed = data.email.trim()

    // Cancel any previous in-flight request
    if (emailAbortRef.current) {
      emailAbortRef.current.abort()
      emailAbortRef.current = null
    }

    if (!trimmed) {
      setEmailStatus('idle')
      setEmailMessage('')
      return
    }

    // Professional email format validation before network call
    if (!validateEmailFormat(trimmed)) {
      setEmailStatus('invalid')
      setEmailMessage('Please enter a valid email address.')
      return
    }

    setEmailStatus('checking')
    setEmailMessage('Checking availability...')

    const controller = new AbortController()
    emailAbortRef.current = controller

    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkEmail(trimmed, controller.signal)
        if (controller.signal.aborted) return

        if (res.available) {
          setEmailStatus('valid')
          setEmailMessage(res.message || 'Email address is available.')
        } else {
          setEmailStatus('invalid')
          setEmailMessage(
            res.message || 'This email address is already registered.'
          )
        }
      } catch (err: any) {
        if (controller.signal.aborted) return
        setEmailStatus('invalid')
        setEmailMessage(
          err.message || 'Error checking email availability.'
        )
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [data.email])

  // Real-time Organization Short Code validation state (short codes must be globally unique)
  const [orgCodeStatus, setOrgCodeStatus] = useState<
    'idle' | 'checking' | 'valid' | 'invalid'
  >('idle')
  const [orgCodeMessage, setOrgCodeMessage] = useState('')
  const orgCodeAbortRef = useRef<AbortController | null>(null)

  // Debounced Organization Short Code Validation
  useEffect(() => {
    const trimmed = data.shortCode.trim().toUpperCase()

    if (orgCodeAbortRef.current) {
      orgCodeAbortRef.current.abort()
      orgCodeAbortRef.current = null
    }

    if (!trimmed) {
      setOrgCodeStatus('idle')
      setOrgCodeMessage('')
      return
    }

    if (trimmed.length < 2) {
      setOrgCodeStatus('invalid')
      setOrgCodeMessage('Short code must be at least 2 characters.')
      return
    }

    setOrgCodeStatus('checking')
    setOrgCodeMessage('Checking availability...')

    const controller = new AbortController()
    orgCodeAbortRef.current = controller

    const timer = setTimeout(async () => {
      try {
        const res = await organizationApi.checkCode(trimmed, controller.signal)
        if (controller.signal.aborted) return

        if (res.available) {
          setOrgCodeStatus('valid')
          setOrgCodeMessage(res.message || 'Organization code is available.')
        } else {
          setOrgCodeStatus('invalid')
          setOrgCodeMessage(
            res.message ||
              'This organization code is already taken. Please choose another code.'
          )
        }
      } catch (err: any) {
        if (controller.signal.aborted) return
        setOrgCodeStatus('invalid')
        setOrgCodeMessage(err.message || 'Error checking code availability.')
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [data.shortCode])

  function updateField(field: keyof SignupData, value: string) {
    setData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  // Handle mobile number input: keep digits only, strip duplicate country codes if pasted
  function handleMobileChange(val: string) {
    // Strip non-digits
    let cleaned = val.replace(/\D/g, '')

    // If user pasted/entered the selected country dialing code at start, remove it
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '')
    if (cleaned.startsWith(dialDigits) && cleaned.length > dialDigits.length) {
      cleaned = cleaned.substring(dialDigits.length)
    }

    updateField('mobile', cleaned)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (step === 1) {
      if (!data.username.trim() || !data.name.trim() || !data.email.trim() || !data.password.trim() || !data.mobile.trim()) {
        setError('Please fill in all required fields.')
        return
      }

      if (data.username.trim().length < 3) {
        setError('Username must be at least 3 characters long.')
        return
      }

      if (!validateEmailFormat(data.email.trim())) {
        setError('Please enter a valid email address.')
        return
      }

      if (emailStatus === 'checking') {
        setError('Please wait while we verify your email address availability.')
        return
      }

      if (emailStatus === 'invalid') {
        setError(emailMessage || 'Please provide a valid, unregistered email address.')
        return
      }

      if (mobileStatus !== 'valid') {
        setError(mobileMessage || 'Please enter a valid mobile number.')
        return
      }

      setStep(2)
      return
    }

    if (step === 2) {
      const cleanOrg = data.organization.trim().replace(/\s+/g, ' ')
      const cleanShortCode = data.shortCode.trim().toUpperCase()

      if (!cleanOrg || !cleanShortCode) {
        setError('Please provide both Organization Name and Short Code.')
        return
      }

      if (orgCodeStatus === 'checking') {
        setError('Please wait while we verify organization short code availability.')
        return
      }

      if (orgCodeStatus === 'invalid' || orgCodeStatus === 'idle') {
        setError(orgCodeMessage || 'This organization code is already taken. Please choose another code.')
        return
      }

      setIsLoading(true)
      const cleanNational = data.mobile.trim().replace(/\D/g, '')
      const finalMobile = normalizedMobileE164 || `+${selectedCountry.dialCode.replace(/\D/g, '')}${cleanNational}`

      const payload = {
        name: data.name || data.username,
        userName: data.username.trim().toLowerCase(),
        email: data.email.trim().toLowerCase(),
        password: data.password.trim(),
        mobileNumber: finalMobile,
        nationalNumber: cleanNational,
        dialingCode: selectedCountry.dialCode,
        countryCode: selectedCountry.code,
        organization: cleanOrg,
        shortCode: cleanShortCode,
        userType: 'Admin',
      }

      try {
        const res = await authApi.signup(payload)

        // Store user in local storage users list as well for fallback & offline persistence
        let userList: any[] = []
        try {
          const stored = localStorage.getItem('cafe4x_users')
          if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) userList = parsed
          }
        } catch {}

        const localUser = {
          id: res.user?.id || Date.now().toString(),
          name: payload.name,
          userName: payload.userName,
          email: payload.email,
          password: payload.password,
          mobileNumber: payload.mobileNumber,
          organization: payload.organization,
          shortCode: cleanShortCode,
          userType: 'Admin',
          createdAt: new Date().toISOString(),
        }

        userList.push(localUser)
        localStorage.setItem('cafe4x_users', JSON.stringify(userList))

        // Store organization in organizations directory if needed
        let orgs: any[] = []
        try {
          const storedOrgs = localStorage.getItem('cafe4x_organizations')
          if (storedOrgs) {
            const parsed = JSON.parse(storedOrgs)
            if (Array.isArray(parsed)) orgs = parsed
          }
        } catch {}
        orgs.push({
          name: payload.organization,
          shortCode: cleanShortCode,
          createdAt: new Date().toISOString(),
        })
        localStorage.setItem('cafe4x_organizations', JSON.stringify(orgs))

        setStep(3)
      } catch (err: any) {
        // Fallback: save to local storage if offline/error
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
          let userList: any[] = []
          try {
            const stored = localStorage.getItem('cafe4x_users')
            if (stored) {
              const parsed = JSON.parse(stored)
              if (Array.isArray(parsed)) userList = parsed
            }
          } catch {}

          const localUser = {
            id: Date.now().toString(),
            name: payload.name,
            userName: payload.userName,
            email: payload.email,
            password: payload.password,
            mobileNumber: payload.mobileNumber,
            organization: payload.organization,
            shortCode: cleanShortCode,
            userType: 'Admin',
            createdAt: new Date().toISOString(),
          }

          userList.push(localUser)
          localStorage.setItem('cafe4x_users', JSON.stringify(userList))
          setStep(3)
        } else {
          setError(err.message || 'Failed to create organization account.')
        }
      } finally {
        setIsLoading(false)
      }
    }
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

                  {/* Mobile number with international country selector on the right */}
                  <div>
                    <label
                      htmlFor="mobile"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Mobile number
                    </label>

                    <div className="relative flex items-center">
                      <Phone
                        size={18}
                        className="pointer-events-none absolute left-4 text-[#A08C7D] z-10"
                      />

                      <input
                        id="mobile"
                        required
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="Enter your mobile number"
                        value={data.mobile}
                        onChange={(event) => handleMobileChange(event.target.value)}
                        className={`${inputClass} pr-32`}
                      />

                      {/* Right-aligned Country Code Selector */}
                      <div
                        ref={countryDropdownRef}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsCountryDropdownOpen((prev) => !prev)
                            setCountrySearch('')
                          }}
                          className="flex h-10 items-center gap-1.5 rounded-lg border border-[#E8DED4] bg-[#FBF7F2] px-2.5 text-xs font-semibold text-[#45352B] transition hover:border-[#8B5738] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5738]/20"
                          title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
                        >
                          <span className="text-base leading-none select-none">
                            {selectedCountry.flag}
                          </span>
                          <span className="text-xs font-bold text-[#6F4228]">
                            {selectedCountry.dialCode}
                          </span>
                          <ChevronDown size={14} className="text-[#8D7A6C]" />
                        </button>

                        {/* Searchable Country Dropdown */}
                        {isCountryDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-72 max-h-72 overflow-hidden rounded-xl border border-[#E8DED4] bg-white shadow-xl z-50 flex flex-col">
                            {/* Search box inside dropdown */}
                            <div className="p-2 border-b border-[#F0E6DC] bg-[#FAF6F2]">
                              <div className="relative flex items-center">
                                <Search size={14} className="absolute left-2.5 text-[#A08C7D]" />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Search country or code..."
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  className="w-full rounded-lg border border-[#E8DED4] bg-white py-1.5 pl-8 pr-2 text-xs text-[#342219] outline-none focus:border-[#8B5738]"
                                />
                              </div>
                            </div>

                            {/* Countries List */}
                            <div className="overflow-y-auto max-h-56 divide-y divide-[#F5EBE1]">
                              {filteredCountries.length === 0 ? (
                                <div className="p-3 text-center text-xs text-[#897B71]">
                                  No countries found
                                </div>
                              ) : (
                                filteredCountries.map((c) => {
                                  const isSelected = c.code === selectedCountry.code
                                  return (
                                    <button
                                      key={`${c.code}-${c.dialCode}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCountry(c)
                                        setIsCountryDropdownOpen(false)
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-[#F7F2EB] ${
                                        isSelected
                                          ? 'bg-[#F4ECE3] font-bold text-[#6F4228]'
                                          : 'text-[#45352B]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span className="text-base leading-none select-none">
                                          {c.flag}
                                        </span>
                                        <span className="truncate">{c.name}</span>
                                      </div>
                                      <span className="shrink-0 text-xs font-semibold text-[#8B5738]">
                                        {c.dialCode}
                                      </span>
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile feedback message */}
                    {mobileStatus === 'incomplete' && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8B5738]">
                        <AlertCircle size={14} className="shrink-0 text-[#8B5738]" />
                        {mobileMessage}
                      </p>
                    )}
                    {mobileStatus === 'valid' && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Check size={14} className="stroke-[2.5]" />
                        {mobileMessage}
                      </p>
                    )}
                    {mobileStatus === 'invalid' && (
                      <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <AlertCircle size={14} className="shrink-0" />
                        {mobileMessage}
                      </p>
                    )}
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
                        className={`${inputClass} pr-10`}
                      />

                      {/* Email Status Indicator inside Input */}
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                        {emailStatus === 'checking' && (
                          <Loader2 size={18} className="animate-spin text-[#8B5738]" />
                        )}
                        {emailStatus === 'valid' && (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        )}
                        {emailStatus === 'invalid' && (
                          <AlertCircle size={18} className="text-rose-600" />
                        )}
                      </div>
                    </div>

                    {/* Email feedback message */}
                    {emailStatus === 'checking' && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8B5738]">
                        Checking availability...
                      </p>
                    )}
                    {emailStatus === 'valid' && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Check size={14} className="stroke-[2.5]" />
                        {emailMessage}
                      </p>
                    )}
                    {emailStatus === 'invalid' && (
                      <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <AlertCircle size={14} className="shrink-0" />
                        {emailMessage}
                      </p>
                    )}
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
                    <p role="alert" className="text-sm font-medium text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !data.username.trim() ||
                      data.username.trim().length < 3 ||
                      !data.name.trim() ||
                      !data.email.trim() ||
                      !data.password.trim() ||
                      !data.mobile.trim() ||
                      emailStatus === 'checking' ||
                      emailStatus === 'invalid' ||
                      emailStatus === 'idle' ||
                      mobileStatus !== 'valid'
                    }
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {emailStatus === 'checking' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Validating email...
                      </>
                    ) : (
                      <>
                        Continue to Organization
                        <ArrowRight
                          size={18}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </>
                    )}
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
                      Enter your organization name and short code to create your workspace.
                    </p>
                  </div>

                  {/* Organization name */}
                  <div>
                    <label
                      htmlFor="organization"
                      className="mb-2 block text-sm font-semibold text-[#45352B]"
                    >
                      Organization name
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
                        placeholder="e.g. Acme Corporation"
                        value={data.organization}
                        onChange={(event) =>
                          updateField('organization', event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Short code */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="shortCode"
                        className="block text-sm font-semibold text-[#45352B]"
                      >
                        Short code
                      </label>
                      <span className="text-xs text-[#9A8778]">
                        Used in page URLs (e.g. /{data.shortCode.trim().toUpperCase() || 'CODE'}/landing)
                      </span>
                    </div>

                    <div className="relative">
                      <Hash
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />

                      <input
                        id="shortCode"
                        required
                        placeholder="e.g. ACME or TCS"
                        maxLength={10}
                        value={data.shortCode}
                        onChange={(event) =>
                          updateField('shortCode', event.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase())
                        }
                        className={`${inputClass} pr-10 uppercase tracking-wider font-semibold`}
                      />

                      {/* Org Code Status Indicator inside Input */}
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                        {orgCodeStatus === 'checking' && (
                          <Loader2 size={18} className="animate-spin text-[#8B5738]" />
                        )}
                        {orgCodeStatus === 'valid' && (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        )}
                        {orgCodeStatus === 'invalid' && (
                          <AlertCircle size={18} className="text-rose-600" />
                        )}
                      </div>
                    </div>

                    {/* Org Code feedback message */}
                    {orgCodeStatus === 'checking' && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8B5738]">
                        Checking availability...
                      </p>
                    )}
                    {orgCodeStatus === 'valid' && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Check size={14} className="stroke-[2.5]" />
                        {orgCodeMessage}
                      </p>
                    )}
                    {orgCodeStatus === 'invalid' && (
                      <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <AlertCircle size={14} className="shrink-0" />
                        {orgCodeMessage}
                      </p>
                    )}
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
                      disabled={isLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E8DED4] bg-white px-5 py-3.5 text-sm font-semibold text-[#6F4228] transition hover:bg-[#F7F2EB] disabled:opacity-60"
                    >
                      <ArrowLeft size={17} />
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={
                        isLoading ||
                        !data.organization.trim() ||
                        !data.shortCode.trim() ||
                        orgCodeStatus === 'checking' ||
                        orgCodeStatus === 'invalid' ||
                        orgCodeStatus === 'idle'
                      }
                      className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#754329] to-[#A66C43] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#754329]/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating Organization...
                        </>
                      ) : orgCodeStatus === 'checking' ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Verifying details...
                        </>
                      ) : (
                        <>
                          Complete Signup
                          <ArrowRight
                            size={18}
                            className="transition-transform group-hover:translate-x-1"
                          />
                        </>
                      )}
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
                    Organization Created
                  </p>

                  <h2 className="text-3xl font-bold text-[#342219]">
                    All Done!
                  </h2>

                  <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-[#897B71]">
                    Your account and organization workspace have been created successfully. Sign in with your new credentials to access your organization portal.
                  </p>

                  <div className="mt-7 rounded-xl border border-[#EEE5DC] bg-[#FAF6F1] p-4 text-left space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#9A6747]">
                      Registration summary
                    </p>

                    <div className="flex justify-between items-center text-sm border-b border-[#EFE7DE] pb-2">
                      <span className="text-[#897B71]">User:</span>
                      <span className="font-semibold text-[#45352B]">{data.name || data.username} ({data.email})</span>
                    </div>

                    <div className="flex justify-between items-center text-sm border-b border-[#EFE7DE] pb-2">
                      <span className="text-[#897B71]">Organization:</span>
                      <span className="font-semibold text-[#45352B]">{data.organization}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-[#897B71]">Short Code / Portal URL:</span>
                      <span className="font-bold text-[#754329] bg-[#EAD5C0]/60 px-2 py-0.5 rounded">
                        /{data.shortCode.trim().toUpperCase()}/landing
                      </span>
                    </div>
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