const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { dealHands, dealCommunityCards } = require('./deal');
const { determineWinner } = require('./determineWinner');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "http://localhost:3001",
        methods: ["GET", "POST"]
    }
});
;

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3001' }));

const sanitizeGameData = (game) => {
    return {
        ...game,
        players: game.players.map(player => ({
            ...player,
            hands: [],
        })),
        usedCards: []
    };
};

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
    // Fetch the current game state
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });

    // Check if the game exists
    if (!game) {
        throw new Error(`Game with ID ${gameId} not found`);
    }

    // Calculate the new dealer position
    const newDealer = (game.dealer + 1) % game.players.length;
    const newPot = game.bigBlind + game.smallBlind;
    const newCurrentBet = game.bigBlind;

    // Update the game state
    return await prisma.game.update({
        where: { id: gameId },
        data: {
            state: 'pre_flop', // Start directly in the pre-flop state
            round: 'pre_flop',
            currentTurn: 0,
            tableCards: [],
            usedCards: [],
            pot: newPot,
            currentBet: newCurrentBet,
            dealer: newDealer,
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
        const user = await prisma.user.findFirst({ where: { email: userEmail } });

        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }

        const isUserInGame = await prisma.game.findFirst({
            where: {
                id: gameId,
                players: {
                    some: { id: user.id }
                }
            }
        });

        if (isUserInGame) {
            console.log(`User with email ${userEmail} is already in the game with id ${gameId}`);
            return null;
        }

        const game = await prisma.game.update({
            where: { id: gameId },
            data: { players: { connect: [{ id: user.id }] } },
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

        // Deal initial hands and set state to pre_flop
        await dealHands(prisma, gameId);
        const updatedGame = await prisma.game.update({
            where: { id: gameId },
            data: { 
                state: 'playing', 
                round: 'pre_flop',
                pot: game.bigBlind + game.smallBlind,
                currentBet: game.bigBlind
            },
            include: { players: true }
        });

        io.emit('gameUpdate', sanitizeGameData(updatedGame));

        res.status(200).json({ message: `Game with ID ${gameId} started`, game: sanitizeGameData(updatedGame) });
    } catch (error) {
        console.error('Failed to process request:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

const handleBetAction = async (gameId, playerId, action, amount = 0) => {
    try {
        let game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true }
        });
        let player = game.players.find(p => p.id === playerId);

        switch (action) {
            case 'check':
                if (game.currentBet === 0 || player.currentBet === game.currentBet) {
                    game.playerOnClock = getNextPlayer(game);
                } else {
                    throw new Error('Invalid action: cannot check');
                }
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

        player.balance = player.balance || 0;
        game.pot = game.pot || 0;

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
        return game;
    } catch (error) {
        console.error('Error in handleBetAction:', error);
        throw error;
    }
};

const handlePlayerAction = async (action) => {
    const { gameId, playerId, actionType, amount } = action;
    try {
        console.log('Handling player action:', action);
        const game = await handleBetAction(gameId, playerId, actionType, amount);

        if (game) {
            if (allPlayersActed(game)) {
                console.log('All players have acted');
                await transitionToNextState(gameId);
            }
            io.emit('gameUpdate', sanitizeGameData(game));
        }
    } catch (error) {
        console.error('Error in handlePlayerAction:', error);
        throw error;
    }
};

const transitionToNextState = async (gameId) => {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    let nextState;
    if (!game.state === 'playing') {
        throw new Error('Invalid game state');
    }
    switch (game.round) {
        case 'pre_flop':
            nextState = 'flop';
            console.log('Transitioning to flop');
            await dealCommunityCards(prisma, gameId, 3); // Deal the flop (3 cards)
            break;
        case 'flop':
            nextState = 'turn';
            await dealCommunityCards(prisma, gameId, 1); // Deal the turn (1 card)
            break;
        case 'turn':
            nextState = 'river';
            await dealCommunityCards(prisma, gameId, 1); // Deal the river (1 card)
            break;
        case 'river':
            nextState = 'showdown';
            //await determineWinner(prisma, gameId); // Determine the winner
            break;
        case 'showdown':
            nextState = 'pre_flop';
            await resetGame(gameId); // Reset the game for a new round
            await dealHands(prisma, gameId); // Deal initial hands for the new game
            break;
    }

    await prisma.game.update({
        where: { id: gameId },
        data: { round: nextState },
    });

    const updatedGame = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });
    io.emit('gameUpdate', sanitizeGameData(updatedGame));
};

const allPlayersActed = (game) => {
    console.log('Checking if all players have acted');
    console.log(game);
    return game.players.every(player => player.folded || player.currentBet === game.currentBet);
};

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('playerAction', (action, callback = () => {}) => {
        handlePlayerAction(action).then(() => {
            callback({ success: true });
        }).catch(error => {
            console.error('Error handling player action:', error);
            callback({ success: false, message: error.message });
        });
    });

    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
    });
});

server.listen(process.env.PORT || 8080, () => {
    console.log(`Server listening on port ${process.env.PORT || 8080}`);
});
