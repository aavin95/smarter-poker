const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const handRankings = {
    'HighCard': 1,
    'OnePair': 2,
    'TwoPair': 3,
    'ThreeOfAKind': 4,
    'Straight': 5,
    'Flush': 6,
    'FullHouse': 7,
    'FourOfAKind': 8,
    'StraightFlush': 9,
    'RoyalFlush': 10
};

// Function to evaluate hand strength
const evaluateHand = (hand) => {
    // Helper functions to count occurrences of ranks and suits
    const countOccurrences = (arr) => arr.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});

    const ranks = hand.map(card => card.rank);
    const suits = hand.map(card => card.suit);
    const rankCounts = Object.values(countOccurrences(ranks));
    const suitCounts = Object.values(countOccurrences(suits));

    const isFlush = suitCounts.includes(5);
    const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);
    const isStraight = sortedRanks.length === 5 && (sortedRanks[4] - sortedRanks[0] === 4);
    const isRoyal = sortedRanks.join('') === '1011121314';

    if (isFlush && isRoyal) {
        return { rank: handRankings.RoyalFlush, description: 'Royal Flush' };
    }
    if (isFlush && isStraight) {
        return { rank: handRankings.StraightFlush, description: 'Straight Flush' };
    }
    if (rankCounts.includes(4)) {
        return { rank: handRankings.FourOfAKind, description: 'Four of a Kind' };
    }
    if (rankCounts.includes(3) && rankCounts.includes(2)) {
        return { rank: handRankings.FullHouse, description: 'Full House' };
    }
    if (isFlush) {
        return { rank: handRankings.Flush, description: 'Flush' };
    }
    if (isStraight) {
        return { rank: handRankings.Straight, description: 'Straight' };
    }
    if (rankCounts.includes(3)) {
        return { rank: handRankings.ThreeOfAKind, description: 'Three of a Kind' };
    }
    if (rankCounts.filter(count => count === 2).length === 2) {
        return { rank: handRankings.TwoPair, description: 'Two Pair' };
    }
    if (rankCounts.includes(2)) {
        return { rank: handRankings.OnePair, description: 'One Pair' };
    }

    return { rank: handRankings.HighCard, description: 'High Card' };
};

// Function to determine the winner of the game
const determineWinner = async (prisma, io, gameId) => {
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true, hands: true }
        });

        if (!game) {
            throw new Error(`Game with ID ${gameId} not found`);
        }

        let bestHand = null;
        let winner = null;

        for (const player of game.players) {
            if (player.folded) continue;

            const playerHand = game.hands.find(hand => hand.playerId === player.id);
            if (!playerHand) continue;

            const handStrength = evaluateHand(playerHand.cards);

            if (!bestHand || handStrength.rank > bestHand.rank) {
                bestHand = handStrength;
                winner = player;
            }
        }

        if (!winner) {
            throw new Error('No winner could be determined');
        }

        console.log(`Winner is: ${winner.name} with ${bestHand.description}`);

        // Emit winner information to all connected clients
        io.emit('gameWinner', { winner: winner.name, handDescription: bestHand.description });

        // Update the player's stats
        await prisma.user.update({
            where: { id: winner.id },
            data: {
                numGamesWon: { increment: 1 },
                balance: winner.balance + game.pot  // Award the pot to the winner
            }
        });

        return winner;
    } catch (error) {
        console.error('Error in determineWinner:', error);
        throw error;
    }
};

module.exports = { determineWinner };
