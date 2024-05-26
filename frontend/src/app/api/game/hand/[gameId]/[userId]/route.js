import prisma from '@/lib/prisma';
import { NextResponse } from "next/server";

export async function GET(req) {
    if (!req.url) {
        return NextResponse.json({ message: 'Invalid request, query parameters are missing' }, { status: 400 });
    }
    let url = req.url.split('/');
    const user_id = url.pop();
    console.log("this user_id", user_id);
    const game_id = url.pop();
    console.log("this game_id", game_id);
    if (!game_id || Array.isArray(game_id)) {
        return NextResponse.json({ message: 'Game ID must be provided and be a single string' }, { status: 400 });
    }

    try {
        const hand = await prisma.hand.findFirst({
            where: {
                gameId: game_id,
                playerId: user_id,
                state: 'inProgress'
            },
            select: {
                cards: true
            }
        });

        if (hand) {
            return NextResponse.json({ hand: hand.cards.map(card => JSON.parse(card)) }, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Hand not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Failed to retrieve hand data:', error);
        return NextResponse.json({ error: 'Failed to retrieve hand data' }, { status: 500 });
    }
}