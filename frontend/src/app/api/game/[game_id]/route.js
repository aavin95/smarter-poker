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
                id: game_id
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
                where: { id: game_id },
                include: { players: true }
            });

            if (!game) {
                return NextResponse.json({ message: 'Game not found' }, { status: 404 });
            }
            //console.log('Dealing hands to players...', game.players);

            // Deal hands to players (example implementation)
            // const res = fetch(`/api/game/deal/${game.id}`);
            // const res = await fetch(`${req.headers.get('origin')}/api/game/deal/${game.id}`, {
            //     method: 'POST',
            // });
            // if (!res.ok) throw new Error('Failed to fetch game data');

            const updatedGame = await prisma.game.update({
                where: { id: game_id },
                data: { state: 'playing' },
                include: { players: true } // Include players to deal hands
            });

            console.log('Game started:', updatedGame);
            return NextResponse.json({ message: `Game with ID ${game_id} started`, game: updatedGame }, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Failed to process request:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
