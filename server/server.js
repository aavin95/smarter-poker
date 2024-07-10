const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { dealHands, dealCommunityCards } = require('./deal');
const { determineWinner } = require('./determineWinner');
require('dotenv').config(); // Load environment variables

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3001", // Your Next.js app URL
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(cors({ origin: 'http://localhost:3001' })); // Enable CORS for your Next.js app

// Function to sanitize game data before sending it to the client
const sanitizeGameData = (game) => {
    const sanitizedGame = {
        ...game,
        players: game.players.map(player => ({
            ...player,
            hands: [], // Exclude player hands
        })),
        usedCards: [] // Exclude used cards
    };
    return sanitizedGame;
};

// Utility functions
const updateGame = async (gameId, data) => {
    const updateData = { ...data };

    if (data.players) {
        updateData.players = {
            updateMany: data.players.map(player => ({
                where: { id: player.id },
                data: {
                    balance: player.balance || 0,
                    currentBet: player.currentBet || 0,
                    folded: player.folded || false
                }
            }))
        };
    }

    return await prisma.game.update({
        where: { id: gameId },
        data: updateData,
        include: { players: true, hands: true, bets: true }
    });
};

const resetGame = async (gameId) => {
    return await prisma.game.update({
        where: { id: gameId },
        data: {
            state: 'waiting',
            round: 0,
            currentTurn: 0,
            tableCards: [],
            usedCards: [],
            pot: 0,
            currentBet: 0
        }
    });
};

const getNextPlayer = (game) => {
    let nextPlayer = (game.playerOnClock + 1) % game.players.length;
    while (game.players[nextPlayer].folded) {
        nextPlayer = (nextPlayer + 1) % game.players.length;
    }
    return nextPlayer;
};

const JoinGame = async (gameId, userEmail) => {
    try {
        const user = await prisma.user.findFirst({
            where: {
                email: userEmail
            }
        });

        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }

        // Check if the user is already in the game
        const isUserInGame = await prisma.game.findFirst({
            where: {
                id: gameId,
                players: {
                    some: {
                        id: user.id
                    }
                }
            }
        });

        if (isUserInGame) {
            console.log(`User with email ${userEmail} is already in the game with id ${gameId}`);
            return null; // or some appropriate response indicating the user is already in the game
        }

        // Add user to the game if they are not already a participant
        const game = await prisma.game.update({
            where: { id: gameId },
            data: {
                players: {
                    connect: [{ id: user.id }]
                }
            },
            include: { players: true }
        });
        if (!game) {
            console.log('Failed to add user to game');
            return null;
        }

        return game;
    } catch (error) {
        console.error(error);
        return null;
    }
};

// API endpoint to get game data
app.get('/api/game/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });

        if (game) {
            res.status(200).json(sanitizeGameData(game));
        } else {
            res.status(404).json({ message: 'Game not found' });
        }
    } catch (error) {
        console.error('Failed to retrieve game data:', error);
        res.status(500).json({ error: 'Failed to retrieve game data' });
    }
});

// API endpoint for joining a game
app.post('/api/game/join/:gameId', async (req, res) => {
    const { gameId } = req.params;
    const { userEmail } = req.body;

    try {
        const game = await JoinGame(gameId, userEmail);
        if (game) {
            io.emit('gameUpdate', sanitizeGameData(game));
            res.status(200).json(sanitizeGameData(game));
        } else {
            res.status(500).json({ error: 'Failed to join game' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to join game' });
    }
});

// API endpoint for starting a game
app.post('/api/game/start/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });

        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }

        const updatedGame = await prisma.game.update({
            where: { id: gameId },
            data: { state: 'playing' },
            include: { players: true }
        });

        io.emit('gameUpdate', sanitizeGameData(updatedGame));

        // Start the game loop
        startGameLoop(gameId);

        res.status(200).json({ message: `Game with ID ${gameId} started`, game: sanitizeGameData(updatedGame) });
    } catch (error) {
        console.error('Failed to process request:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Function to handle betting actions
const handleBetAction = async (gameId, playerId, action, amount = 0) => {
    try{
        let game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });
        console.log('handelBetAction', action);
        let player = game.players.find(p => p.id === playerId);

        switch (action) {
            case 'check':
                console.log('currentBet', game.currentBet);
                console.log('player.currentBet', player.currentBet);
                if (game.currentBet === 0 || player.currentBet === game.currentBet) {
                    game.playerOnClock = getNextPlayer(game);
                } else {
                    throw new Error('Invalid action: cannot check');
                }
                console.log('is this breaking?');
                break;
            case 'fold':
                player.folded = true;
                game.playerOnClock = getNextPlayer(game);
                break;
            case 'call':
                let callAmount = game.currentBet - player.currentBet;
                player.balance -= callAmount;
                player.currentBet = game.currentBet;
                game.pot += callAmount;
                console.log('pot', game.pot);
                game.playerOnClock = getNextPlayer(game);
                break;
            case 'raise':
                let raiseAmount = amount - player.currentBet;
                player.balance -= raiseAmount;
                player.currentBet = amount;
                game.currentBet = amount;
                game.pot += raiseAmount;
                game.playerOnClock = getNextPlayer(game);
                break;
            default:
                throw new Error('Invalid action');
        }

        // Ensure balance and pot are valid numbers
        player.balance = player.balance || 0;
        game.pot = game.pot || 0;
        console.log('pot', game.pot);
        console.log('about to update game');
        game = await updateGame(game.id, {
            players: game.players.map(player => ({
                id: player.id,
                balance: player.balance,
                currentBet: player.currentBet,
                folded: player.folded
            })),
            pot: game.pot,
            playerOnClock: game.playerOnClock,
            currentBet: game.currentBet
        });

        io.emit('gameUpdate', sanitizeGameData(game));
        console.log('game updated');
        return game;
    } catch(error){
        console.error('Error in handleBetAction:', error);
        return null;
    }
};

// API endpoint for a player action
app.post('/api/game/action/:gameId/:playerId', async (req, res) => {
    const { gameId, playerId } = req.params;
    const { action, amount } = req.body;

    try {
        let game = await handleBetAction(gameId, playerId, action, amount);
        res.status(200).json({ message: `Game with ID ${gameId} had ${action} action processed`, data: sanitizeGameData(game) });
    } catch (error) {
        console.error('Failed to process action:', error);
        res.status(500).json({ error: 'Failed to process action' });
    }
});

// Helper function to wait for player action
const waitForPlayerAction = (player, gameId) => {
    console.log('Setting up waitForPlayerAction for player:', player.id);
    return new Promise((resolve, reject) => {
        const handleAction = async (actionData) => {
            console.log('Received playerAction event:', actionData);
            try {
                if (actionData.gameId === gameId && actionData.playerId === player.id) {
                    console.log('Player action matched, handling action...');
                    io.off('playerAction', handleAction); // Clean up listener
                    game = await handleBetAction(gameId, player.id, actionData.action, actionData.amount);
                    resolve(game);
                }
            } catch (error) {
                io.off('playerAction', handleAction); // Clean up listener on error
                console.error('Error handling player action:', error);
                reject(error);
            }
        };
        io.on('playerAction', handleAction);
        console.log('Listener set for playerAction');
    });
};

// Function to handle betting rounds
const handleBettingRound = async (game) => {
    let activePlayers = game.players.filter(player => !player.folded);
    let playerOnClockIndex = game.playerOnClock;
    let roundCompleted = false;

    // Emit game update and inform the client which player is on the clock
    io.emit('gameUpdate', sanitizeGameData(game));

    console.log('playerOnClockIndex', playerOnClockIndex);
    // Loop until the betting round is completed
    while (!roundCompleted) {
        console.log('in the betting round loop');
        const currentPlayer = activePlayers[playerOnClockIndex];
        console.log('currentPlayer');
        // Wait for the current player to make an action
        game = await waitForPlayerAction(currentPlayer);
        console.log('waited for player action');
        // Move to the next player
        playerOnClockIndex = (playerOnClockIndex + 1) % activePlayers.length;

        // Check if all players have completed their actions
        console.log('about to check break condition');
        if (playerOnClockIndex === game.playerOnClock) {
            // Check if there are any remaining actions (i.e., players need to match the current bet)
            const remainingActions = activePlayers.some(player => player.currentBet < game.currentBet && !player.folded);
            if (!remainingActions) {
                roundCompleted = true;
            }
        }
    }

    // Update the game state to reflect the end of the betting round
    await updateGame(game.id, { round: game.round, playerOnClock: playerOnClockIndex });

    io.emit('gameUpdate', sanitizeGameData(game));
};

// Function to start the game loop
const startGameLoop = async (gameId) => {
    try {
        let game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });

        if (!game) {
            console.error('Game not found');
            return;
        }

        await dealHands(prisma, game.id);
        game = await updateGame(game.id, { 
            round: game.round + 1, 
            currentBet: game.bigBlind,
            pot: game.bigBlind + game.smallBlind 
        });
        io.emit('gameUpdate', sanitizeGameData(game));
        await handleBettingRound(game);

        // Deal flop
        await dealCommunityCards(prisma, game.id, 3);
        game = await updateGame(game.id, { round: game.round + 1 });
        io.emit('gameUpdate', sanitizeGameData(game));
        await handleBettingRound(game);

        // Deal turn
        await dealCommunityCards(prisma, game.id, 1);
        game = await updateGame(game.id, { round: game.round + 1 });
        io.emit('gameUpdate', sanitizeGameData(game));
        await handleBettingRound(game);

        // Deal river
        await dealCommunityCards(prisma, game.id, 1);
        game = await updateGame(game.id, { round: game.round + 1 });
        io.emit('gameUpdate', sanitizeGameData(game));
        await handleBettingRound(game);

        // Determine the winner
        // const winner = await determineWinner(prisma, game.id);
        // game = await updateGame(game.id, { state: 'finished' });
        // io.emit('gameUpdate', sanitizeGameData(game));

        // Move the dealer chip
        const nextDealer = (game.dealer + 1) % game.players.length;
        game = await resetGame(game.id);
        game = await updateGame(game.id, { dealer: nextDealer });
        io.emit('gameUpdate', sanitizeGameData(game));

        // Start a new hand
        await startGameLoop(game.id);
    } catch (error) {
        console.error('Failed to run game loop:', error);
    }
};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('dealCards', async (gameId) => {
        await dealHands(gameId);
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: { include: { hands: true } } }
        });

        io.emit('gameUpdate', sanitizeGameData(game));
    });

    socket.on('playerAction', async (actionData) => {
        try {
            const { gameId, playerId, action, amount } = actionData;
            await handleBetAction(gameId, playerId, action, amount); 
            console.log('player action handled');
        } catch (error) {
            console.error('Failed to process player action:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

app.get('/', (req, res) => {
    res.send('Socket.io server running');
});

server.listen(8080, () => {
    console.log('Server listening on port 8080');
});
