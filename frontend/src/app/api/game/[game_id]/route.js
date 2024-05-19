// /app/api/game/[game_id]/route.js

import prisma from '@/lib/prisma';
import { NextResponse } from "next/server";

export async function GET(req) {
    console.log('req value:', req);
    console.log('req.url value:', req.url);
    console.log('req.url.pathname value:', req.url.split('/').pop());

    if (!req.url) {
        return NextResponse.json({ message: 'Invalid request, query parameters are missing' }, { status: 400 });
    }

    const game_id = req.url.split('/').pop()

    console.log('Received game_id:', game_id);
    console.log('game_id int', parseInt(game_id, 10))

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
        console.log('game value:', game);
        if (game) {
            return NextResponse.json({ message: game}, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Game not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Failed to retrieve game data:', error);
        return NextResponse.json({ error: 'Failed to retrieve game data' }, { status: 500 });
    }
};
