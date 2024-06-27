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

// RESUME NOTE: This is a security measure
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

async function JoinGame(gameId, userEmail) {
    try {
        const user = await prisma.User.findFirst({
            where: {
                email: userEmail
            }
        });

        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }

        // Check if the user is already in the game
        const isUserInGame = await prisma.Game.findFirst({
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
        const game = await prisma.Game.update({
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
}

// API endpoint for joining a game
app.post('/api/game/join/:gameId', async (req, res) => {
    const { gameId } = req.params;
    const { userEmail } = req.body;

    try {
        const game = await JoinGame(gameId, userEmail);
        if (game) {
            // Emit sanitized event to Socket.io server
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
