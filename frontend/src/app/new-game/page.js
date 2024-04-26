"use client"
import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import prisma from "@/lib/prisma";
import { NewGame } from '../_actions';

export default function CreateNewGame() {
  const { data: session, status } = useSession();
  const [gameInfo, setGameInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

    async function handleCreateGame() {
    if (!session) {
      signIn();
      return;
    }
    setLoading(true);

    try {
        const userEmail = session.user.email;
        console.log("user email in page.js", userEmail)
        console.log("is user eamil a string", typeof userEmail)
        const result = await NewGame(userEmail);
        setGameInfo(result)
        console.log('Game created with ID:', result);
        setLoading(false);
    }
    catch (error) {
        console.error("can't find user");
        return;
    }
    }


  return (
    <div>
      <h1>Create a New Game</h1>
      {status === 'authenticated' ? (
        <button type="submit" disabled={loading} onClick={handleCreateGame}>
            Create Game
        </button>
      ) : (
        <p>Please sign in to create a game.</p>
      )}
      {gameInfo && (
        <p>Game created! Game ID: {gameInfo}</p>
      )}
      {error && (
        <p>Error: {error}</p>
      )}
    </div>
  );
}
