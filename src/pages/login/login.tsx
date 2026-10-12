import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/authlayout'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    console.log({ username, password })
  }

  return (
    <AuthLayout>
      <section className="grid items-center gap-10 md:grid-cols-2">
        {/* Coffee image */}
        <div className="hidden items-center justify-center md:flex">
          <img
            src="/cafe-coffee.png"
            alt="Coffee and cinnamon"
            className="w-full max-w-md object-contain drop-shadow-xl"
          />
        </div>

        {/* Login form */}
        <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-7 shadow-sm sm:p-9">
          <h2 className="mb-10 text-2xl font-semibold text-gray-900">
            Login
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Enter UserName"
              aria-label="Username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2.5 text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#805334] focus:ring-2 focus:ring-[#805334]/20"
            />

            <input
              type="password"
              placeholder="Enter Password"
              aria-label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2.5 text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#805334] focus:ring-2 focus:ring-[#805334]/20"
            />

            <button
              type="submit"
              className="mt-2 w-full rounded-full border border-[#805334] py-2 text-[#593a28] transition hover:bg-[#593a28] hover:text-white"
            >
              Login
            </button>
          </form>

          <p className="mt-5 text-center text-gray-800">
            Don't Have An Account?{' '}
            <Link
              to="/signup"
              className="ml-1 text-blue-600 hover:underline"
            >
              SignUp
            </Link>
          </p>
        </div>
      </section>
    </AuthLayout>
  )
}