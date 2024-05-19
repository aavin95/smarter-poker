"use client"
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import styles from './PokerGame.module.css';

export default function PokerGame({ params }) {
    const { data: session, status } = useSession();
    const [gameInfo, setGameInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        // Fetch game data or initialize a new game
        const fetchGameData = async () => {
            try {
                setLoading(true);
                const game_id = params.gameId;
                const res = await fetch(`/api/game/${game_id}`);
                console.log('response value:', res);
                if (!res.ok) throw new Error('Failed to fetch game data');
                const data = await res.json();
                console.log('data value:', data);
                setGameInfo(data.message);
                console.log('Game data is working');
            } catch (error) {
                setError('Failed to load game data.');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchGameData();
    }, []);

    const handleAction = (action) => {
        console.log(`${action} action taken`);
        // Implement action handling logic
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className={styles.gameContainer}>
            <h2>Poker Table</h2>
            <ul>
                {gameInfo?.players.map((player, index) => (
                    <li key={player.id}>
                        {player.name} {index === 0 ? '(Dealer)' : ''}
                    </li>
                ))}
            </ul>
            {gameInfo?.players[0]?.id === session?.user?.id && (
                <button onClick={() => handleAction('start')}>Start Game</button>
            )}
        </div>
    );
}
