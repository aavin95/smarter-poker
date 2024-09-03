"use client";
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { LeaveGame } from '../../_actions';

const socket = io('http://localhost:8080');

const cardToUnicode = {
    'AS': '🂡', '2S': '🂢', '3S': '🂣', '4S': '🂤', '5S': '🂥', '6S': '🂦', '7S': '🂧', '8S': '🂨', '9S': '🂩', '10S': '🂪', 'JS': '🂫', 'QS': '🂭', 'KS': '🂮',
    'AH': '🂱', '2H': '🂲', '3H': '🂳', '4H': '🂴', '5H': '🂵', '6H': '🂶', '7H': '🂷', '8H': '🂸', '9H': '🂹', '10H': '🂺', 'JH': '🂻', 'QH': '🂽', 'KH': '🂾',
    'AD': '🃁', '2D': '🃂', '3D': '🃃', '4D': '🃄', '5D': '🃅', '6D': '🃆', '7D': '🃇', '8D': '🃈', '9D': '🃉', '10D': '🃊', 'JD': '🃋', 'QD': '🃍', 'KD': '🃎',
    'AC': '🃑', '2C': '🃒', '3C': '🃓', '4C': '🃔', '5C': '🃕', '6C': '🃖', '7C': '🃗', '8C': '🃘', '9C': '🃙', '10C': '🃚', 'JC': '🃛', 'QC': '🃝', 'KC': '🃞'
};

function translateCardToUnicode(card) {
    return cardToUnicode[card] || card;
}

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

    const currentGameId = params.gameId;

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
                console.log('Received game update:', updatedGame);
                if (updatedGame.id === params.gameId) {
                    console.log('Updating game state:', updatedGame.state);
                    const updatedHand = updatedGame.tableCards;
                    const updatedGameWithPrettyHands = { // TODO: fix this
                        ...updatedGame,
                        tableCards: Array.isArray(updatedHand) ? updatedHand.map(translateCardToUnicode) : [],
                    };
                    console.log(updatedGameWithPrettyHands);
                    setGameInfo(updatedGameWithPrettyHands);
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
            socket.on('gameWinner', ({ winner, handDescription }) => {
                alert(`Winner is ${winner} with a ${handDescription}`);
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
            const hand = [translateCardToUnicode(data.hand[0]), translateCardToUnicode(data.hand[1])]
            console.log('data', data);
            console.log("hand", hand);
            return hand;
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
            setDealer(data.game.dealer);
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

    const handlePlayerAction = (action, amount = 0) => {
        const currentPlayerId = session?.user?.id;
        console.log('currentPlayerId', currentPlayerId);
        console.log('session', session);
        console.log('user', session?.user);
        console.log('Attempting to handle player action:', action, amount, currentGameId, currentPlayerId);
        socket.emit('playerAction', { gameId: currentGameId, playerId: currentPlayerId, actionType: action, amount: amount });
    };

    const shareLink = `http://localhost:3000/game/${currentGameId}`;

    if (loading) return <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">Loading...</div>;
    if (error) return <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">Error: {error}</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <h2 className="text-2xl font-bold mb-4">Poker Table</h2>
            {(gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') ? (
                <p className="mb-4">Game in progress</p>
            ) : (
                <div className="mb-4">
                    <p>Waiting for players to join...</p>
                    <p className="mt-2">Share this link with others to join: <a href={shareLink} className="text-blue-500">{shareLink}</a></p>
                </div>
            )}
            <p>Players in game:</p>
            <ul className="mb-4">
                {Array.isArray(players) && players.map((player, index) => (
                    <li key={player.id} className="mb-2">
                        {player.name} {player.email === dealer && (gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') ? '(Dealer)' : ''}
                        {index === (gameInfo.dealer + 1) % players.length && (gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') ? '(Small Blind)' : ''}
                        {index === (gameInfo.dealer + 2) % players.length && (gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') ? '(Big Blind)' : ''}
                        {index === onClockPlayer && (gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') ? '(On Clock)' : ''}
                        {player.email === session.user.email && (gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') && (
                            <div>
                                <p>
                                    <span style={{ fontSize: '5em' }}>{translateCardToUnicode(playerHand[0])}</span>,
                                    <span style={{ fontSize: '5em' }}>{translateCardToUnicode(playerHand[1])}</span>
                                </p>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            <div>
                {(gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') ? (
                    <>
                        <p>Pot: {gameInfo?.pot}</p>
                        <p>Current Bet: {gameInfo?.currentBet}</p>
                        <p>Table Cards: {gameInfo?.tableCards.join(', ')}</p>
                    </>
                ) : ''}
            </div>
            {gameInfo?.players[0]?.email === session?.user?.email && gameInfo?.state === 'waiting'
                && gameInfo?.players.length >= 2 && (
                    <button onClick={handleStartGame} className="px-4 py-2 mb-4 bg-blue-500 text-white rounded hover:bg-blue-600">Start Game</button>
                )}
            {(gameInfo?.state === 'playing' || gameInfo?.state === 'preflop') && onClockPlayer === players.findIndex(player => player.email === session.user.email) && (
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
