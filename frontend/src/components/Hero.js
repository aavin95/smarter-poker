"use client"
import { useSession } from 'next-auth/react';
export default function Hero() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // Optional: Render nothing while loading
  if (loading) return null;

    return (
      <div className="relative text-center text-white py-24 bg-gradient-to-r from-dark to-gray-900">
        <div className="relative z-10">
          <h2 className="text-4xl font-bold">Experience Elite Poker Gaming</h2>
          <p className="text-xl mt-3 mb-6">Play and compete in poker against others from around the world.</p>
          {
            session ? (
              <div>
                <p className="text-lg">Welcome back, {session.user.name}!</p>
                <a href='/new-game' >
                  <button className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-8 rounded-full transition-colors duration-200">Start A Game!</button>
                </a>
              </div> 
            ) : (
              <button className="text-lg">Sign in to start playing!</button>
            )
          }
        </div>
      </div>
    );
  }
  