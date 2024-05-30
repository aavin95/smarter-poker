const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { dealHands, dealCommunityCards } = require('./deal');
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

// API endpoint to deal cards
app.post('/api/game/deal/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });

        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }

        const round = game.round % 4;
        if ((round) !== 0) {
            let numCards;
            if (round === 1) {
                numCards = 3; // Flop
            } else if (round === 2 || round === 3) {
                numCards = 1; // Turn and River
            } else {
                return res.status(400).json({ message: 'Invalid round number' });
            }

            await dealCommunityCards(prisma, game.id, numCards);
        } else {
            await dealHands(prisma, game.id);
        }

        let updatedGame = await prisma.game.update({
            where: { id: game.id },
            include: { players: true },
            data: { round: round + 1 },
        });
        console.log("game before being sent to users", updatedGame);

        // Emit sanitized event to Socket.io server
        io.emit('gameUpdate', sanitizeGameData(updatedGame));

        res.status(200).json({ message: `Dealt cards for round ${round}`, game: sanitizeGameData(updatedGame) });
    } catch (error) {
        console.error('Failed to process request:', error);
        res.status(500).json({ error: 'Failed to process request' });
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

        // Emit sanitized event to Socket.io server
        io.emit('gameUpdate', sanitizeGameData(updatedGame));

        // Start the game loop
        startGameLoop(gameId);

        res.status(200).json({ message: `Game with ID ${gameId} started`, game: sanitizeGameData(updatedGame) });
    } catch (error) {
        console.error('Failed to process request:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Asynchronous game loop function
const startGameLoop = async (gameId) => {
    let game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });

    const gameLoop = async () => {
        if (game.state !== 'playing') return;

        console.log('Game loop running for game:', gameId);

        // Handle player turn timing
        const playerOnClock = game.players[game.playerOnClock];
        if (!playerOnClock) return;

        // Notify clients about the current player
        io.emit('gameUpdate', sanitizeGameData(game));

        // Wait for the player's turn duration (e.g., 30 seconds)
        await new Promise(resolve => setTimeout(resolve, 30000));
        let player = await prisma.User.findUnique({
            where: { id: playerOnClock.id },
            include: { hands: true }
        });
        // TODO: ended here. I was just about to implement the logic to check if the player has 
        // folded by running out of time or not. next you need to finish reading this function and 
        // making edits to it. you will also need to implement fold, check, call, and raise functions/ api endpoints
        // to handle player actions.
        // Move to the next player
        const nextPlayerIndex = (game.playerOnClock + 1) % game.players.length;
        game = await prisma.game.update({
            where: { id: gameId },
            data: { playerOnClock: nextPlayerIndex },
            include: { players: true }
        });

        // Automatically deal community cards or handle other game events if needed
        if (game.round === 1 || game.round === 2 || game.round === 3) {
            await dealCommunityCards(prisma, game.id, 1);
            game = await prisma.game.update({
                where: { id: gameId },
                data: { round: game.round + 1 },
                include: { players: true }
            });
        } else if (game.round === 4) {
            await dealHands(prisma, game.id);
            game = await prisma.game.update({
                where: { id: gameId },
                data: { round: 0 },
                include: { players: true }
            });
        }

        // Emit sanitized event to Socket.io server
        io.emit('gameUpdate', sanitizeGameData(game));

        // Schedule the next iteration of the game loop
        setTimeout(gameLoop, 0);
    };

    // Start the game loop
    gameLoop();
};


io.on('connection', (socket) => {
    console.log('a user connected');
    
    socket.on('dealCards', async (gameId) => {
        // Implement logic to deal cards and update the game state
        await dealHands(gameId);
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: { include: { hands: true } } }
        });

        io.emit('gameUpdate', sanitizeGameData(game)); // Broadcast sanitized game update to all connected clients
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        // TODO: Pause them from the game
    });
});

app.get('/', (req, res) => {
    res.send('Socket.io server running');
});

server.listen(8080, () => {
    console.log('Server listening on port 8080');
});
