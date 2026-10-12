import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/authlayout'

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

export default function Signup() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<SignupData>(initialData)

  function updateField(field: keyof SignupData, value: string) {
    setData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (step < 3) {
      setStep((previous) => previous + 1)
      return
    }

    // UI only: send the signup data to the backend here later.
    console.log('Signup data:', data)
  }

  const steps = ['Sign up', 'Organization', 'Completed']

  return (
    <AuthLayout>
      <section className="mx-auto w-full max-w-5xl">
        {/* Step indicator */}
        <div className="mb-5 grid grid-cols-3">
          {steps.map((label, index) => {
            const stepNumber = index + 1
            const active = step === stepNumber
            const completed = step > stepNumber

            return (
              <div key={label} className="text-center">
                <div className="flex h-12 items-center justify-center">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      active || completed
                        ? 'bg-cyan-500 text-white'
                        : 'text-gray-400'
                    }`}
                  >
                    {completed ? '✓' : stepNumber}
                  </span>
                </div>

                <p
                  className={`text-sm sm:text-base ${
                    active
                      ? 'font-semibold text-[#593a28]'
                      : 'text-[#704b35]'
                  }`}
                >
                  {label}
                </p>

                <div
                  className={`mt-4 h-0.5 ${
                    active || completed ? 'bg-cyan-500' : 'bg-transparent'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* Form card */}
        <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                autoComplete="username"
                placeholder="Enter UserName"
                aria-label="Username"
                value={data.username}
                onChange={(e) => updateField('username', e.target.value)}
                className="auth-input"
              />

              <input
                required
                autoComplete="name"
                placeholder="Enter Name"
                aria-label="Name"
                value={data.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="auth-input"
              />

              <input
                required
                type="tel"
                autoComplete="tel"
                placeholder="Enter Mobile Number"
                aria-label="Mobile Number"
                value={data.mobile}
                onChange={(e) => updateField('mobile', e.target.value)}
                className="auth-input"
              />

              <input
                required
                type="email"
                autoComplete="email"
                placeholder="Enter Email"
                aria-label="Email"
                value={data.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="auth-input"
              />

              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Enter Password"
                aria-label="Password"
                value={data.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="auth-input"
              />

              <button type="submit" className="auth-button">
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <h2 className="mb-5 text-xl font-semibold text-gray-900">
                Organization Details
              </h2>

              <input
                required
                placeholder="Organization / Cafe Name"
                aria-label="Organization Name"
                value={data.organization}
                onChange={(e) =>
                  updateField('organization', e.target.value)
                }
                className="auth-input"
              />

              <textarea
                required
                placeholder="Organization Address"
                aria-label="Organization Address"
                value={data.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="auth-input min-h-24 resize-y"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="auth-button bg-gray-100 text-gray-800 hover:bg-gray-200"
                >
                  Back
                </button>

                <button type="submit" className="auth-button">
                  Complete Signup
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">
                ✓
              </div>

              <h2 className="text-2xl font-semibold text-[#593a28]">
                All Done!
              </h2>

              <p className="mt-3 text-gray-600">
                Your details have been collected. Connect the backend to
                finish registration.
              </p>

              <button
                type="button"
                onClick={() => {
                  setData(initialData)
                  setStep(1)
                }}
                className="auth-button mt-6"
              >
                Start Again
              </button>
            </div>
          )}

          {step === 1 && (
            <p className="mt-5 text-center text-gray-700">
              Already Have An Account?{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                Login
              </Link>
            </p>
          )}
        </div>
      </section>
    </AuthLayout>
  )
}