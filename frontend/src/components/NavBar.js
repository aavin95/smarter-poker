"use client"
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';


  return (
    <nav className="bg-dark text-white py-4">
      <div className="container mx-auto flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-primary hover:text-primary transition-colors duration-200">
          Smarter Poker
        </a>
        <div className="flex space-x-4">
          <a href="/" className="hover:text-primary transition-colors duration-200">Home</a>
          <a href="/play" className="hover:text-primary transition-colors duration-200">Play Now</a>
          <a href="/dashboard" className="hover:text-primary transition-colors duration-200">Dashboard</a>
          {session ? (
            <button onClick={() => signOut()} className="hover:text-primary transition-colors duration-200">
              Sign Out
            </button>
          ) : (
            <button onClick={() => signIn()} className="hover:text-primary transition-colors duration-200">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
