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
    const [dealer, setDealer] = useState('');
    const [loading, setLoading] = useState(true);
    const [playerHand, setPlayerHand] = useState([]);
    const [error, setError] = useState('');
    const router = useRouter();

    const updateHand = (newHand) => {
        setPlayerHand(newHand);
    };

    const updatePlayers = (newPlayers) => {
        console.log('New players before update:', newPlayers);
        console.log('Type of newPlayers:', typeof newPlayers);

        // Ensure newPlayers is converted to an array of values if it's not already an array
        const playersArray = Array.isArray(newPlayers) ? newPlayers : Object.values(newPlayers);

        console.log('Converted playersArray:', playersArray);
        setPlayers(playersArray);
        console.log('Updated players state:', playersArray);
    };

    useEffect(() => {
        if (players.length > 0 && gameInfo?.dealer !== undefined) {
            updateDealer(gameInfo.dealer);
        }
    }, [players, gameInfo]);

    const updateDealer = (dealerIndex) => {
        console.log('about to update dealer:', dealerIndex, players.length);
        if (players.length > 0 && dealerIndex < players.length) {
            console.log('updating dealer:', players[dealerIndex].email);
            setDealer(players[dealerIndex].email);
        }
    };

    useEffect(() => {
        if (status === "authenticated") {
            socket.on('connect', () => {
                console.log('Connected to Socket.io server');
            });

            socket.on('gameUpdate', async (updatedGame) => {
                if (updatedGame.id === params.gameId) {
                    setGameInfo(updatedGame);
                    const playersData = updatedGame.players;
                    console.log('playersData:', playersData);
                    updatePlayers(playersData);
                    const player = playersData.find(player => player.email === session.user.email);
                    if (player) {
                        // Fetch the user's hand using the API
                        const hand = await fetchUserHand(params.gameId, player.id);
                        updateHand(hand);
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

    const fetchGameData = async () => {
        try {
            setLoading(true);
            const game_id = params.gameId;
            const res = await fetch(`http://localhost:8080/api/game/${game_id}`);
            if (!res.ok) throw new Error('Failed to fetch game data');
            const data = await res.json();
            setGameInfo(data);
            console.log('game info players:', data.players);
            const playersData = data.players;
            console.log('playersData:', playersData);
            updatePlayers(playersData);

            const currentPlayer = playersData.find(player => player.email === session.user.email);
            if (currentPlayer) {
                const hand = await fetchUserHand(params.gameId, currentPlayer.id);
                setPlayerHand(hand);
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
            updatePlayers(data.game.players);
            fetchGameData();
        } catch (error) {
            console.error('Error starting game:', error);
            setError('Failed to start game.');
        }
    }

    async function handleJoinGame() {
        if (!session) {
            signIn();
            return;
        }
        if (!params.gameId) {
            setError("Please enter a game ID.");
            return;
        }
        setLoading(true);
        try {
            const userId = session.user.id;
            const result = await JoinGame(params.gameId, userId);
            if (result == null) {
                setError("Can't join a game you're already in.");
                setLoading(false);
                return;
            }
            setGameInfo(result);
            setLoading(false);
            // redirect to game page:
            router.push(`/play`);
        } catch (error) {
            console.error("can't find user");
            setLoading(false);
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
            setGameInfo(data.game);
            updatePlayers(data.game.players);
        } catch (error) {
            console.error('Error dealing hands:', error);
            setError('Failed to deal hands.');
        }
    }

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    console.log("dealer:", dealer);

    return (
        <div className={styles.gameContainer}>
            <h2>Poker Table</h2>
            {gameInfo?.state === 'playing' ? (
                <p>Game in progress</p>
            ) : (
                <p>Waiting for players to join...</p>
            )}
            <ul>
                {console.log('players in html:', players)}
                {Array.isArray(players) && players.map((player, index) => (
                    <li key={player.id}>
                        {player.name} {player.email === dealer ? '(Dealer)' : ''}
                        {player.email === session.user.email && gameInfo?.state === 'playing' && (
                            <div>
                                <p>Your Cards: {playerHand[0]}, {playerHand[1]}</p>
                            </div>
                        )}
                        {dealer === session.user.email && player.email === session.user.email && gameInfo?.state === 'playing' 
                            ? <div>
                                <button onClick={() => dealHands(gameInfo.id)}>Deal Hands</button>
                            </div> : ''}
                    </li>
                ))}
            </ul>
            {gameInfo?.players[0]?.email === session?.user?.email && gameInfo?.state === 'waiting' 
                && gameInfo?.players.length >= 2 && (
                <button onClick={handleStartGame}>Start Game</button>
            )}
        </div>
    );
}
