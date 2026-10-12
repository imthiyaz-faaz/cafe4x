import cafeBackground from "../assets/images/homebg.jpg";
import Navbar from "../components/navbar/navbar";

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-white px-4 text-center font-sans sm:px-6">

      {/* Background Image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${cafeBackground})` }}
      />

      {/* White Overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-white/85"
      />

      {/* Navbar */}
      <div className="mx-auto w-full max-w-[1208px]">
        <Navbar />
      </div>

      {/* Welcome Section */}
      <section className="pt-14 sm:pt-16 md:pt-[58px]">
        <h1 className="text-4xl font-medium italic tracking-tight text-[#553d2e] sm:text-5xl">
          Welcome to Cafe4X
        </h1>

        <p className="mt-4 text-base font-semibold text-[#282b2e] sm:text-xl">
          Where our app is your gateway to happiness
        </p>

        <p className="mx-auto mt-6 max-w-4xl text-base leading-relaxed text-[#a77958] sm:text-lg">
          Lets make your ordering as breeze so your guests will enjoy
          and remember your hospitality
        </p>
      </section>
    </main>
  );
}