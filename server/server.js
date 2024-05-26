const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); 
const { PrismaClient } = require('@prisma/client');
const { dealHands, dealCommunityCards } = require('./deal');

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

// API endpoint to get game data
app.get('/api/game/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });

        if (game) {
            res.status(200).json(game);
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

        const round = game.round%4;
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
        console.log("game before beign sent to users", updatedGame);

        // Emit event to Socket.io server
        io.emit('gameUpdate', updatedGame);

        res.status(200).json({ message: `Dealt cards for round ${round}`, game: updatedGame });
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

        io.emit('gameUpdate', game); // Broadcast game update to all connected clients
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
