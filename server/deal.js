const DECK = [
    '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH', 'AH',
    '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', 'JD', 'QD', 'KD', 'AD',
    '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC', 'AC',
    '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS'
];

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

async function dealHands(prisma, gameId) {
    if (!gameId) throw new Error('Game ID is required');
    console.log("gameId in dealHands", gameId);
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });
    if (!game) throw new Error('Game not found');

    const currentDealer = game.dealer;
    const numPlayers = game.players.length;
    const newDealer = (currentDealer + 1) % numPlayers;
    const smallBlindIndex = (newDealer + 1) % numPlayers;
    const bigBlindIndex = (newDealer + 2) % numPlayers;

    await prisma.hand.updateMany({
        where: { gameId: game.id },
        data: { state: 'finished' }
    });

    // Deal initial hands and reset game state
    let localDeck = shuffleDeck([...DECK]);
    const usedCards = [];

    for (const player of game.players) {
        const playerCards = [];
        for (let i = 0; i < 2; i++) {
            localDeck = shuffleDeck(localDeck.filter(c => !usedCards.includes(c)));
            const card = localDeck.find(c => !usedCards.includes(c));
            usedCards.push(card);
            playerCards.push(card);
        }
        await prisma.hand.create({
            data: {
                playerId: player.id,
                gameId: game.id,
                cards: playerCards.map(card => JSON.stringify(card)),
            },
        });
    }

    // Deduct blinds and update pot
    const smallBlindPlayer = game.players[smallBlindIndex];
    const bigBlindPlayer = game.players[bigBlindIndex];
    const smallBlindAmount = game.smallBlind;
    const bigBlindAmount = game.bigBlind;

    await prisma.$transaction([
        prisma.user.update({
            where: { id: smallBlindPlayer.id },
            data: {
                balance: { decrement: smallBlindAmount },
                currentBet: { increment: smallBlindAmount }
            }
        }),
        prisma.user.update({
            where: { id: bigBlindPlayer.id },
            data: {
                balance: { decrement: bigBlindAmount },
                currentBet: { increment: bigBlindAmount }
            }
        }),
        prisma.bet.create({
            data: {
                playerId: smallBlindPlayer.id,
                gameId: game.id,
                amount: smallBlindAmount,
                round: 1 // Assuming round 1 is pre-flop
            }
        }),
        prisma.bet.create({
            data: {
                playerId: bigBlindPlayer.id,
                gameId: game.id,
                amount: bigBlindAmount,
                round: 1 // Assuming round 1 is pre-flop
            }
        }),
        prisma.game.update({
            where: { id: game.id },
            data: {
                pot: { increment: smallBlindAmount + bigBlindAmount },
                currentBet: bigBlindAmount,
                dealer: newDealer,
                usedCards: usedCards.map(card => JSON.stringify(card))
            },
        })
    ]);

    const smallBlind = await prisma.user.findUnique({
        where: { id: smallBlindPlayer.id }
    });
    console.log("smallBlind", smallBlind);
    const bigBlind = await prisma.user.findUnique({
        where: { id: bigBlindPlayer.id }
    });
    console.log("bigBlind", bigBlind);
}


async function dealCommunityCards(prisma, gameId, numCards) {
    if (!gameId) throw new Error('Game ID is required');
    console.log("gameId in dealHands", gameId)
    const game = await prisma.game.findUnique({
        where: { id: gameId },
    });

    if (!game) throw new Error('Game not found');
    let UsedCards = game.usedCards.map(card => JSON.parse(card));
    let deck = shuffleDeck([...DECK]).filter(card => !UsedCards.includes(card));
    const communityCards = [];
    for (let i = 0; i < numCards; i++) {
        deck = shuffleDeck(deck.filter(c => !UsedCards.includes(c)));
        const card = deck.find(c => !UsedCards.includes(c));
        UsedCards.push(card);
        communityCards.push(card);
    }

    await prisma.game.update({
        where: { id: game.id },
        data: {
            tableCards: {
                push: communityCards.map(card => JSON.stringify(card)),
            },
            usedCards: UsedCards.map(card => JSON.stringify(card)),
        },
    });
}

module.exports = { dealHands, dealCommunityCards };
