import { Link } from 'react-router-dom'
import AuthLayout from '../components/authlayout'

export default function Home() {
  return (
    <AuthLayout>
      <section className="grid min-h-[380px] items-center gap-10 md:grid-cols-2">
        {/* Coffee image */}
        <div className="flex items-center justify-center">
          <img
            src="/cafe-coffee.png"
            alt="Coffee and cinnamon"
            className="w-full max-w-md object-contain drop-shadow-xl"
          />
        </div>

        {/* Welcome content */}
        <div className="mx-auto w-full max-w-md">
          <p className="mb-6 text-lg leading-relaxed text-[#9b765e]">
            Let's make your ordering as breeze so your guests will enjoy and
            remember your hospitality.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/login"
              className="min-w-28 rounded-full border border-[#704b35] px-8 py-2 text-center text-[#593a28] transition hover:bg-[#593a28] hover:text-white"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="min-w-28 rounded-full border border-[#704b35] px-8 py-2 text-center text-[#593a28] transition hover:bg-[#593a28] hover:text-white"
            >
              Sign up
            </Link>
          </div>
        </div>
      </section>
    </AuthLayout>
  )
}