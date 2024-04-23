"use client"
import { useSession, signIn } from "next-auth/react";
import { useState } from "react";

export default function NewGame() {
  const { data: session, status } = useSession();
  const [gameInfo, setGameInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGame = async () => {
    if (!session) {
      signIn(); // Prompt user to sign in if not already signed in
      return;
    }

    setLoading(true);
    const res = await fetch('/api/game/new-game', {
      method: 'POST',
    });

    if (!res.ok) {
      setError('Failed to create game');
      setLoading(false);
    } else {
      const data = await res.json();
      setGameInfo(data);
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Create a New Game</h1>
      {status === 'authenticated' ? (
        <button onClick={handleCreateGame} disabled={loading}>
          {loading ? 'Creating...' : 'Create Game'}
        </button>
      ) : (
        <p>Please sign in to create a game.</p>
      )}
      {gameInfo && (
        <p>Game created! Game ID: {gameInfo.id}</p>
      )}
      {error && (
        <p>Error: {error}</p>
      )}
    </div>
  );
}
