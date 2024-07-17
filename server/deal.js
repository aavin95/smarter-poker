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
    console.log("gameId in dealHands", gameId)
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true }
    });
    if (!game) throw new Error('Game not found');

    const currentDealer = game.dealer;
    const numPlayers = game.players.length;
    const newDealer = (currentDealer + 1) % numPlayers;

    await prisma.hand.updateMany({
        where: { gameId: game.id },
        data: { state: 'finished' }
    });

    await prisma.game.update({
        where: { id: gameId },
        data: {
            state: 'playing',
            usedCards: [],
            tableCards: [],
            round: 'pre-flop',
            currentBet: 0,
            pot: 0,
            currentTurn: 0,
            dealer: newDealer,
        },
    });

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

    await prisma.game.update({
        where: { id: game.id },
        data: { usedCards: usedCards.map(card => JSON.stringify(card)) },
    });
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
