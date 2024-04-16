export default function Navbar() {
    return (
      <nav className="bg-dark text-white py-4">
        <div className="container mx-auto flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-primary hover:text-primary transition-colors duration-200">
            Smarter Poker
          </a>          
          <div className="flex space-x-4">
            <a href="/" className="hover:text-primary transition-colors duration-200">Home</a>
            <a href="#" className="hover:text-primary transition-colors duration-200">Play Now</a>
            <a href="/dashboard" className="hover:text-primary transition-colors duration-200">Dashboard</a>
            <a href="http://localhost:3000/api/auth/signin/credentials" className="hover:text-primary transition-colors duration-200">Sign In</a>
            <a href="http://localhost:3000/api/auth/signout/credentials" className="hover:text-primary transition-colors duration-200">Sign Out</a>
          </div>
        </div>
      </nav>
    );
  }
  