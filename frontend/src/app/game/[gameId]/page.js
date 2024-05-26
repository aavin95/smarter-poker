"use client";
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import styles from './PokerGame.module.css';

const socket = io('http://localhost:8080');

export default function PokerGame({ params }) {
    const { data: session, status } = useSession();
    const [gameInfo, setGameInfo] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playerHand, setPlayerHand] = useState([]);
    const [error, setError] = useState('');
    const router = useRouter();

    const updateHand = (newHand) => {
        setPlayerHand(newHand);
    };

    useEffect(() => {
        if (status === "authenticated") {
            socket.on('connect', () => {
                console.log('Connected to Socket.io server');
            });

            socket.on('gameUpdate', async (updatedGame) => {
                if (updatedGame.id === params.gameId) {
                    console.log('Received game update:', updatedGame);
                    setGameInfo(updatedGame);
                    setPlayers(updatedGame.players);
                    const player = updatedGame.players.find(player => player.email === session.user.email);
                    console.log("player", player);
                    if (player) {
                        // Fetch the user's hand using the API
                        console.log("player.id", player.id);
                        console.log("params.gameId", params.gameId);
                        const hand = await fetchUserHand(params.gameId, player.id);
                        console.log("hand", hand);
                        updateHand(hand);
                        console.log("playerHand after setPlayerHand call:", playerHand);
                    } else {
                        setPlayerHand([]);
                    }
                }
            });

            socket.on('connect_error', (err) => {
                console.error('Socket.io connection error:', err);
                setError('Failed to connect to Socket.io server.');
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from Socket.io server');
            });

            return () => {
                socket.off('gameUpdate');
                socket.off('connect_error');
                socket.off('disconnect');
            };
        }
    }, [params.gameId, status]);

    useEffect(() => {
        console.log("playerHand state updated:", playerHand);
    }, [playerHand]);

    const fetchGameData = async () => {
        try {
            setLoading(true);
            const game_id = params.gameId;
            const res = await fetch(`http://localhost:8080/api/game/${game_id}`);
            if (!res.ok) throw new Error('Failed to fetch game data');
            const data = await res.json();
            setGameInfo(data);
            setPlayers(data.players);

            const currentPlayer = data.players.find(player => player.email === session.user.email);
            if (currentPlayer && currentPlayer.hand) {
                setPlayerHand(currentPlayer.hand.cards.map(card => JSON.parse(card)));
            } else {
                setPlayerHand([]);
            }
        } catch (error) {
            setError('Failed to load game data.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated") {
            fetchGameData();
        }
    }, [params.gameId, status]);

    async function fetchUserHand(gameId, userId) {
        try {
            console.log("Fetching user hand for gameId:", gameId, "userId:", userId);
            const res = await fetch(`/api/game/hand/${gameId}/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error('Failed to fetch user hand');
            }

            const data = await res.json();
            console.log("Fetched hand data:", data);
            return data.hand;
        } catch (error) {
            console.error('Error fetching user hand:', error);
            return [];
        }
    }

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

            if (!res.ok) {
                throw new Error('Failed to start game');
            }
            const data = await res.json();
            setGameInfo(data.game);
            setPlayers(data.game.players);
            fetchGameData();
        } catch (error) {
            console.error('Error starting game:', error);
            setError('Failed to start game.');
        }
    }

    async function dealHands(gameId) {
        try {
            const res = await fetch(`http://localhost:8080/api/game/deal/${gameId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error('Failed to deal cards');
            }

            const data = await res.json();
            console.log("data", data);
            setGameInfo(data.game);
            setPlayers(data.game.players);
        } catch (error) {
            console.error('Error dealing hands:', error);
            setError('Failed to deal hands.');
        }
    }

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    console.log("session:", session);
    console.log("gameInfo:", gameInfo);
    console.log("session.user.id:", session?.user?.id);
    console.log("gameInfo.host:", gameInfo?.hostId);

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
                        {player.email === session.user.email && (
                            <div>
                                <p>Your Cards: {playerHand[0]}, {playerHand[1]}</p>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {gameInfo?.players[0]?.email === session?.user?.email && gameInfo?.state === 'waiting' 
                && gameInfo?.players.length >= 2 && (
                <button onClick={handleStartGame}>Start Game</button>
            )}
            {
                gameInfo?.state === 'playing' && gameInfo.host === session.user?.id && (
                    <button onClick={() => dealHands(gameInfo.id)}>Deal Hands</button>
                )
            }
        </div>
    );
}