import prisma from '@/lib/prisma';

import { NextResponse } from "next/server";


const DECK = [
    '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH', 'AH',
    '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', 'JD', 'QD', 'KD', 'AD',
    '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC', 'AC',
    '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS'
];

// Using Fisher–Yates Shuffle Algo.
function shuffleDeck(deck) {
    let currentIndex = deck.length;

    while (currentIndex !== 0) {
  
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      [deck[currentIndex], deck[randomIndex]] = [
        deck[randomIndex], deck[currentIndex]];
    }
    return deck;
}

// Function to deal hands to players
async function dealHands(gameId) {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });

    if (!game) throw new Error('Game not found');

    // makes deep copy of the deck and shuffles it
    let localDeck = shuffleDeck([...DECK]);
    const usedCards = [];
    

    // Deal two cards to each player
    for (const player of game.players) {
        const playerCards = [];
        for (let i = 0; i < 2; i++) {
            // shuffle all the cards in the deck excluding the used cards
            localDeck = shuffleDeck(localDeck.filter(c => !usedCards.includes(c)));
            const card = localDeck.find(c => !usedCards.includes(c));
            usedCards.push(card);
            playerCards.push(card);
        }
        await prisma.hand.create({
            data: {
                playerId: player.id,
                gameId: game.id,
                cards: playerCards.map(card => JSON.stringify(card)), // Store cards as JSON strings
            },
        });
    }

    // Update the game with the used cards
    await prisma.game.update({
        where: { id: game.id },
        data: { usedCards: usedCards.map(card => JSON.stringify(card)) },
    });
}

// Function to deal community cards
async function dealCommunityCards(gameId, numCards) {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { usedCards: true }
    });

    if (!game) throw new Error('Game not found');
    let localUsedCards = game.usedCards.map(card => JSON.parse(card));
    let deck = shuffleDeck([...DECK]).filter(card => !usedCards.includes(card));
    const communityCards = [];
    for (let i = 0; i < numCards; i++) {
        // shuffle all the cards in the deck excluding the used cards
        deck = shuffleDeck(deck.filter(c => !localUsedCards.includes(c)));
        const card = deck.find(c => !localUsedCards.includes(c));
        localUsedCards.push(card);
        communityCards.push(card);
    }

    // Update the game's table cards and the used cards
    await prisma.game.update({
        where: { id: game.id },
        data: {
            tableCards: {
                push: communityCards.map(card => JSON.stringify(card)),
            },
            usedCards: localUsedCards.map(card => JSON.stringify(card)),
        },
    });
}

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
                players: {
                    include: {
                        hand: true,
                    }
                },
                tableCards: true,
            }
        });

        

        if (game) {
            return NextResponse.json({ message: game }, { status: 200 });
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
        const game_id = req.url.split('/').pop();

        const game = await prisma.game.findUnique({
            where: { id: parseInt(game_id, 10) },
            include: {
                players: {
                    include: {
                        hand: true,
                    }
                },
                tableCards: true,
            }
        });

        if (!game) {
            return NextResponse.json({ message: 'Game not found' }, { status: 404 });
        }

        // Deal community cards based on the round
        const round = game.round;
        if (round !== 0) {
            let numCards;
            if (round === 1) {
                numCards = 3; // Flop
            } else if (round === 2 || round === 3) {
                numCards = 1; // Turn and River
            } else {
                return NextResponse.json({ message: 'Invalid round number' }, { status: 400 });
            }
    
            await dealCommunityCards(game.id, numCards);

        }
        else {
            // Deal hands to players
            await dealHands(game.id);
        }
        let updatedGame = game;
        updatedGame = await prisma.game.update({
            where: { id: game.id },
            data: { round: round + 1 },
        });


        return NextResponse.json({ message: `Dealt cards community cards for round ${round}`, game: updatedGame }, { status: 200 });
    } catch (error) {
        console.error('Failed to process request:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}