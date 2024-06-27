const poker = require('poker-hand-evaluator');

const determineWinner = async (prisma, gameId) => {
    // Get game data
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
            players: true,
            hands: true
        }
    });

    if (!game) {
        throw new Error('Game not found');
    }

    // Get community cards
    const communityCards = game.tableCards;

    // Evaluate hands for each player
    let bestHands = game.players.map(player => {
        const playerHand = game.hands.find(hand => hand.playerId === player.id).cards;
        const fullHand = [...communityCards, ...playerHand];
        const handRank = poker.getHand(fullHand);
        return { player, handRank, fullHand };
    });

    // Sort hands by rank
    bestHands.sort((a, b) => b.handRank.value - a.handRank.value);

    // Determine winner(s)
    let winners = [bestHands[0]];
    for (let i = 1; i < bestHands.length; i++) {
        if (bestHands[i].handRank.value === bestHands[0].handRank.value) {
            winners.push(bestHands[i]);
        } else {
            break;
        }
    }

    // Update player statistics and distribute pot
    const pot = game.pot;
    const winnings = pot / winners.length;

    const winnerIds = winners.map(w => w.player.id);

    await prisma.$transaction(async (tx) => {
        // Distribute winnings and update game state
        for (let winner of winners) {
            await tx.user.update({
                where: { id: winner.player.id },
                data: {
                    balance: { increment: winnings },
                    numGamesWon: { increment: 1 }
                }
            });
        }

        await tx.game.update({
            where: { id: gameId },
            data: {
                state: 'finished',
                pot: 0
            }
        });

        for (let player of game.players) {
            await tx.user.update({
                where: { id: player.id },
                data: {
                    numGamesPlayed: { increment: 1 }
                }
            });
        }
    });

    return winners.map(w => w.player);
};

module.exports = { determineWinner };
