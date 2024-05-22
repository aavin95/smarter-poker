"use client"
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import styles from './PokerGame.module.css';

export default function PokerGame({ params }) {
    const { data: session, status } = useSession();
    const [gameInfo, setGameInfo] = useState(null);
    const [players, setPlayers] = useState([]);
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
                if (!res.ok) throw new Error('Failed to fetch game data');
                const data = await res.json();
                setGameInfo(data.message);
                setPlayers(data.message.players);
                console.log('Game data is working');
            } catch (error) {
                setError('Failed to load game data.');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchGameData();
    }, [params.gameId]);

    async function handleStartGame() {
        try {
            const res = await fetch(`/api/game/${params.gameId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userEmail: session.user.email,
                    action: 'start',
                }),
            });
    
            if (!res.ok) throw new Error('Failed to start game');
            const data = await res.json();
            setGameInfo(data.game);
            setPlayers(data.game.players);
        } catch (error) {
            console.error('Error starting game:', error);
            setError('Failed to start game.');
        }
    }

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className={styles.gameContainer}>
            <h2>Poker Table</h2>
            {gameInfo?.state === 'playing' ? (
                <p>Game in progress</p>
            ) : (
                <p>Waiting for players to join...</p>
            )}
            <ul>
                {players.map((player, index) => (
                    <li key={player.id}>
                        {player.name} {index === 0 ? '(Dealer)' : ''}
                        {player.hand && (
                            <div>
                                <p>Cards:</p>
                                <ul>
                                    {player.hand.cards.map((card, cardIndex) => (
                                        <li key={cardIndex}>{card.suit} {card.rank}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {gameInfo?.players[0]?.email === session?.user?.email && gameInfo?.state === 'waiting' && (
                <button onClick={handleStartGame}>Start Game</button>
            )}
        </div>
    );
}
