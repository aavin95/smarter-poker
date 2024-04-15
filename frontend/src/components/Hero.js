export default function Hero() {
    return (
      <div className="relative text-center text-white py-24 bg-gradient-to-r from-dark to-gray-900">
        <div className="absolute inset-0 bg-cover bg-[url('/poker-table.jpg')] opacity-30"></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold">Experience Elite Poker Gaming</h2>
          <p className="text-xl mt-3 mb-6">Play and compete in poker against others from around the world.</p>
          <button className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-8 rounded-full transition-colors duration-200">Join Now</button>
        </div>
      </div>
    );
  }
  