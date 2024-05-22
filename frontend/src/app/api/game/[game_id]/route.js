import prisma from '@/lib/prisma';
import { NextResponse } from "next/server";

export async function GET(req) {
    if (!req.url) {
        return NextResponse.json({ message: 'Invalid request, query parameters are missing' }, { status: 400 });
    }

    const game_id = req.url.split('/').pop();

    if (!game_id || Array.isArray(game_id)) {
        return NextResponse.json({ message: 'Game ID must be provided and be a single string' }, { status: 400 });
    }

    try {
        const game = await prisma.game.findUnique({
            where: {
                id: parseInt(game_id, 10)
            },
            include: {
                players: true,
            }
        });

        if (game) {
            return NextResponse.json({ message: game}, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Game not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Failed to retrieve game data:', error);
        return NextResponse.json({ error: 'Failed to retrieve game data' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { userEmail, action } = await req.json();
        const game_id = req.url.split('/').pop();

        if (!userEmail) {
            return NextResponse.json({ message: 'User email must be provided' }, { status: 400 });
        }

        const user = await prisma.User.findFirst({
            where: { email: userEmail }
        });

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        if (action === 'create') {
            // Create a new game
            const newGame = await newGame({ user });
            return NextResponse.json({ message: `Game created with ID ${newGame}`, gameId: newGame }, { status: 201 });
        } else if (action === 'start' && game_id) {
            // Start the game by changing its state
            const game = await prisma.game.findUnique({
                where: { id: parseInt(game_id, 10) }
            });

            if (!game) {
                return NextResponse.json({ message: 'Game not found' }, { status: 404 });
            }

            const updatedGame = await prisma.game.update({
                where: { id: parseInt(game_id, 10) },
                data: { state: 'playing' },
                include: { players: true } // Include players to deal hands
            });

            console.log('Game started:', updatedGame);
            console.log('Dealing hands to players...', updatedGame.players);

            // Deal hands to players (example implementation)
            await dealHands(updatedGame.id);

            return NextResponse.json({ message: `Game with ID ${game_id} started`, game: updatedGame }, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Failed to process request:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

// Function to deal hands to players
async function dealHands(gameId) {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });

    if (!game) throw new Error('Game not found');

    for (const player of game.players) {
        console.log('Dealing hand to player:', player.id);
        await prisma.hand.deleteMany({
            where: { playerId: player.id }
        });
        const cards = generateHand(); // Implement this function to generate a hand of cards
        await prisma.hand.create({
            data: {
                playerId: player.id,
                gameId: game.id,
                cards: JSON.stringify(cards),
            },
        });
        console.log('Hand dealt to player:', player.id, cards);
    }
}

function generateHand() {
    // Example card dealing logic, replace with your actual implementation
    return [
        'AH',
        'AD',
    ];
}
