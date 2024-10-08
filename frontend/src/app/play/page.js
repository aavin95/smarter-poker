"use client"
import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import { NewGame } from '../_actions';
import { useRouter } from 'next/navigation';

export default function CreateNewGame() {
    const { data: session, status } = useSession();
    const [gameInfo, setGameInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [joinGameId, setJoinGameId] = useState('');
    const router = useRouter(); 

    async function handleCreateGame() {
        if (!session) {
            signIn();
            return;
        }
        setLoading(true);

        try {
            const userEmail = session.user.email;
            const result = await NewGame(userEmail);
            if (result == null) {
                setError("Error creating game");
                setLoading(false);
                return;
            }
            setGameInfo(result);
            setLoading(false);
            // redirect to game page:
            router.push(`/game/${result}`);
        } catch (error) {
            console.error("can't find user");
            setLoading(false);
        }
    }

    async function handleJoinGame() {
        console.log('Attempting to join game:', joinGameId);
        if (!session) {
            signIn();
            return;
        }
        if (!joinGameId) {
            setError("Please enter a game ID.");
            return;
        }
        setLoading(true);
        try {
            console.log('Attempting to join game:', joinGameId);
            const res = await fetch(`http://localhost:8080/api/game/join/${joinGameId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userEmail: session.user.email })
            });
            console.log('res', res);
            if (!res.ok) {
                throw new Error('Failed to join game');
            }

            const data = await res.json();
            setGameInfo(data);
            setLoading(false);
            console.log('game info players:', data.players);
            console.log('joinGameId:', joinGameId); 
            // redirect to game page:
            router.push(`/game/${joinGameId}`);
        } catch (error) {
            console.error('Error joining game:', error);
            setError('Failed to join game.');
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {status === 'authenticated' ? (
                <>
                    <button 
                        type="submit" 
                        disabled={loading} 
                        onClick={handleCreateGame}
                        className="px-4 py-2 mb-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        Create Game
                    </button>
                    <div className="flex flex-col items-center">
                        <input
                            value={joinGameId}
                            onChange={(e) => setJoinGameId(e.target.value)}
                            placeholder="Enter Game ID"
                            className="px-4 py-2 mb-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                        />
                        <button 
                            type="submit" 
                            onClick={handleJoinGame}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            Join Game
                        </button>
                    </div>
                </>
            ) : (
                <p>Please sign in to create or join a game.</p>
            )}
            {error && (
                <p className="mt-4 text-red-500">Error: {error}</p>
            )}
        </div>
    );
}
