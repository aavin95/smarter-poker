"use client";
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { LeaveGame } from '../../_actions';

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

    if (loading) return <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">Loading...</div>;
    if (error) return <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">Error: {error}</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <h2 className="text-2xl font-bold mb-4">Poker Table</h2>
            {gameInfo?.state === 'playing' ? (
                <p className="mb-4">Game in progress</p>
            ) : (
                <p className="mb-4">Waiting for players to join...</p>
            )}
            <p className="mb-4">Pot size: {gameInfo?.pot}</p>
            <ul className="mb-4">
                {Array.isArray(players) && players.map((player, index) => (
                    <li key={player.id} className="mb-2">
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
                                <button onClick={() => dealHands(gameInfo.id)} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Deal Hands</button>
                            </div> : ''}
                    </li>
                ))}
            </ul>
            {gameInfo?.players[0]?.email === session?.user?.email && gameInfo?.state === 'waiting'
                && gameInfo?.players.length >= 2 && (
                    <button onClick={handleStartGame} className="px-4 py-2 mb-4 bg-blue-500 text-white rounded hover:bg-blue-600">Start Game</button>
                )}
            {gameInfo?.state === 'playing' && (
                <div className="flex space-x-2 mb-4">
                    <button onClick={() => handlePlayerAction('fold')} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Fold</button>
                    <button onClick={() => handlePlayerAction('check')} className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">Check</button>
                    <button onClick={() => handlePlayerAction('call')} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Call</button>
                    <button onClick={() => handlePlayerAction('raise', 100)} className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">Raise</button>
                </div>
            )}
            <button onClick={handleLeaveGame} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Leave Game</button>
        </div>
    );
}
