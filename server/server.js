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
        console.log("Attempting to find user with email:", userEmail);
        const user = await prisma.User.findFirst({
            where: {
                email: userEmail
            }
        });

        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }

        console.log("user id in server.js", user.id);

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
        console.log("user about to be added to game", user);

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
    console.log('api/game/join/:gameId');
    const { gameId } = req.params;
    const { userEmail } = req.body;

    try {
        const game = await JoinGame(gameId, userEmail);
        if (game) {
            // Emit sanitized event to Socket.io server
            console.log("game after join", game);
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

// API endpoints for player actions: fold, call, check, raise
app.post('/api/game/:gameId/player/:playerId/fold', async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        await handlePlayerFold(playerId);
        const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true, hands: true } });
        console.log("game after fold", game);
        console.log("game after fold sanitized: ", sanitizeGameData(game));
        res.status(200).json(sanitizeGameData(game));
    } catch (error) {
        console.error('Failed to process fold action:', error);
        res.status(500).json({ error: 'Failed to process fold action' });
    }
});

app.post('/api/game/:gameId/player/:playerId/call', async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        await handlePlayerCall(playerId);
        const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true, hands: true } });
        res.status(200).json(sanitizeGameData(game));
    } catch (error) {
        console.error('Failed to process call action:', error);
        res.status(500).json({ error: 'Failed to process call action' });
    }
});

app.post('/api/game/:gameId/player/:playerId/check', async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        await handlePlayerCheck(playerId);
        const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true, hands: true } });
        res.status(200).json(sanitizeGameData(game));
    } catch (error) {
        console.error('Failed to process check action:', error);
        res.status(500).json({ error: 'Failed to process check action' });
    }
});

app.post('/api/game/:gameId/player/:playerId/raise', async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        const { raiseAmount } = req.body;
        await handlePlayerRaise(playerId, raiseAmount);
        const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true, hands: true } });
        res.status(200).json(sanitizeGameData(game));
    } catch (error) {
        console.error('Failed to process raise action:', error);
        res.status(500).json({ error: 'Failed to process raise action' });
    }
});

// Asynchronous game loop function
const startGameLoop = async (gameId) => {
    let game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });

    await dealHands(prisma, gameId);

    const gameLoop = async () => {
        if (game.state !== 'playing') return;

        console.log('Game loop running for game:', gameId);

        // Handle player turn timing
        const playerOnClock = game.players[game.playerOnClock];
        if (!playerOnClock) return;

        // Notify clients about the current player
        io.emit('gameUpdate', sanitizeGameData(game));
        console.log(`Player on clock: ${playerOnClock.id}`);
        // Wait for the player's turn duration (e.g., 30 seconds)
        await new Promise(resolve => setTimeout(resolve, 30000));

        await handlePlayerFold(playerOnClock.id);

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

const handlePlayerFold = async (playerId) => {
    const player = await prisma.user.findUnique({
        where: { id: playerId },
        include: { 
            bets: true,
            currentGame: true
        }
    });

    if (player && player.currentGame) {
        await prisma.hand.updateMany({
            where: { 
                playerId: player.id,
                gameId: player.currentGame.id
            },
            data: { state: 'folded' }
        });

        // Check if only one player remains in the game
        const game = await prisma.game.findUnique({
            where: { id: player.currentGame.id },
            include: { players: true, hands: true }
        });

        const activePlayers = game.players.filter(player => {
            const hand = game.hands.find(hand => hand.playerId === player.id);
            return hand && hand.state === 'inProgress';
        });

        if (activePlayers.length === 1) {
            // Only one player remains, they win the hand
            const winner = activePlayers[0];
            await prisma.user.update({
                where: { id: winner.id },
                data: { balance: { increment: game.pot } }
            });

            // deal next hands cards
            await dealHands(prisma, game.id);

            // Reset the game or start a new round as necessary
            await prisma.game.update({
                where: { id: game.id },
                data: {
                    pot: 0,
                    currentBet: 0,
                    round: 0,
                }
            });


            io.emit('gameOver', sanitizeGameData(game));
        } else {
            // Move to the next player
            const nextPlayerIndex = (game.playerOnClock + 1) % game.players.length;
            await prisma.game.update({
                where: { id: game.id },
                data: {
                    playerOnClock: nextPlayerIndex,
                }
            });

            io.emit('gameUpdate', sanitizeGameData(game));
        }
    }
};

const handlePlayerCall = async (playerId) => {
    const player = await prisma.user.findUnique({
        where: { id: playerId },
        include: { 
            bets: true,
            currentGame: true
        }
    });

    if (player && player.currentGame) {
        const game = await prisma.game.findUnique({
            where: { id: player.currentGame.id },
            include: { players: true }
        });

        const callAmount = game.currentBet - (player.bets ? player.bets.amount : 0);

        await prisma.bet.create({
            data: {
                gameId: player.currentGame.id,
                playerId: player.id,
                amount: callAmount,
                round: game.round
            }
        });

        await prisma.user.update({
            where: { id: player.id },
            data: { balance: { decrement: callAmount } }
        });

        await prisma.game.update({
            where: { id: game.id },
            data: { pot: { increment: callAmount } }
        });

        io.emit('gameUpdate', sanitizeGameData(game));
    }
};

const handlePlayerCheck = async (playerId) => {
    const player = await prisma.user.findUnique({
        where: { id: playerId },
        include: { 
            bets: true,
            currentGame: true
        }
    });

    if (player && player.currentGame) {
        const game = await prisma.game.findUnique({
            where: { id: player.currentGame.id },
            include: { players: true }
        });

        io.emit('gameUpdate', sanitizeGameData(game));
    }
};

const handlePlayerRaise = async (playerId, raiseAmount) => {
    const player = await prisma.user.findUnique({
        where: { id: playerId },
        include: { 
            bets: true,
            currentGame: true
        }
    });

    if (player && player.currentGame) {
        const game = await prisma.game.findUnique({
            where: { id: player.currentGame.id },
            include: { players: true }
        });

        const newBetAmount = game.currentBet + raiseAmount;

        await prisma.bet.create({
            data: {
                gameId: player.currentGame.id,
                playerId: player.id,
                amount: newBetAmount,
                round: game.round
            }
        });

        await prisma.user.update({
            where: { id: player.id },
            data: { balance: { decrement: newBetAmount } }
        });

        await prisma.game.update({
            where: { id: game.id },
            data: {
                pot: { increment: newBetAmount },
                currentBet: newBetAmount
            }
        });

        io.emit('gameUpdate', sanitizeGameData(game));
    }
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
