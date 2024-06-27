"use client";
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { LeaveGame } from '../../_actions';
import styles from './PokerGame.module.css';

const socket = io('http://localhost:8080');

export default function PokerGame({ params }) {
    const { data: session, status } = useSession();
    const [gameInfo, setGameInfo] = useState(null);
    const [players, setPlayers] = useState([]);
    const [dealer, setDealer] = useState('');
    const [loading, setLoading] = useState(true);
    const [playerHand, setPlayerHand] = useState([]);
    const [gameState, setGameState] = useState('');
    const [onClockPlayer, setOnClockPlayer] = useState(0);
    const [error, setError] = useState('');
    const router = useRouter();

    const updateHand = (newHand) => {
        setPlayerHand(newHand);
    };

    const updatePlayers = (newPlayers) => {
        const playersArray = Array.isArray(newPlayers) ? newPlayers : Object.values(newPlayers);
        setPlayers(playersArray);
    };

    useEffect(() => {
        if (players.length > 0 && gameInfo?.dealer !== undefined) {
            updateDealer(gameInfo.dealer);
        }
    }, [players, gameInfo]);

    const updateDealer = (dealerIndex) => {
        if (players.length > 0 && dealerIndex < players.length) {
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
                    setOnClockPlayer(updatedGame.playerOnClock);
                    updatePlayers(playersData);
                    const player = playersData.find(player => player.email === session.user.email);
                    if (player) {
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
            const playersData = data.players;
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
            const res = await fetch(`http://localhost:8080/api/game/start/${params.gameId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

    async function handleLeaveGame() {
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
            const userEmail = session.user.email;
            const result = await LeaveGame(params.gameId, userEmail);
            if (result == null) {
                setError("An error occurred while trying to leave the game.");
                setLoading(false);
                return;
            } else if (result === 'deleted game') {
                router.push(`/`);
                return;
            }
            setGameInfo(result);
            setPlayers(result.players);
            setLoading(false);
            router.push(`/play`);
        } catch (error) {
            console.error("Can't find user");
            setLoading(false);
        }
    }

    async function dealHands(gameId) {
        try {
            const res = await fetch(`http://localhost:8080/api/game/deal/${gameId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
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

    async function handlePlayerAction(action, amount = 0) {
        try {
            const res = await fetch(`http://localhost:8080/api/game/${params.gameId}/player/${session.user.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raiseAmount: amount })
            });

            if (!res.ok) {
                throw new Error(`Failed to ${action}`);
            }

            const data = await res.json();
            setGameInfo(data);
            console.log('Player action data:', data);
            console.log('Player action:', data.players);
            updatePlayers(data.players);
        } catch (error) {
            console.error(`Error performing ${action}:`, error);
            setError(`Failed to ${action}.`);
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
            <p>Pot size: {gameInfo?.pot}</p>
            <ul>
                {Array.isArray(players) && players.map((player, index) => (
                    <li key={player.id}>
                        {player.name} {player.email === dealer ? '(Dealer)' : ''}
                        {index === (gameInfo.dealer + 1) % players.length ? '(Small Blind)' : ''}
                        {index === (gameInfo.dealer + 2) % players.length ? '(Big Blind)' : ''}
                        {index === onClockPlayer ? '(On Clock)' : ''}
                        {player.email === session.user.email && gameInfo?.state === 'playing' && (
                            <div>
                                <p>Your Cards: {playerHand[0]}, {playerHand[1]}</p>
                                <p>Your Contribution to Pot: {player.contribution}</p>
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
            {gameInfo?.state === 'playing' && (
                <div>
                    <button onClick={() => handlePlayerAction('fold')}>Fold</button>
                    <button onClick={() => handlePlayerAction('check')}>Check</button>
                    <button onClick={() => handlePlayerAction('call')}>Call</button>
                    <button onClick={() => handlePlayerAction('raise', 100)}>Raise</button> {/* Amount can be changed */}
                </div>
            )}
            <button onClick={handleLeaveGame}>Leave Game</button>
        </div>
    );
}
