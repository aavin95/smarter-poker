const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config(); // Load environment variables

async function playerTest() {
    let player = await prisma.User.findUnique({
        where: { id: "clwwkurr00007etenhgu57r9g" },
        include: { 
            hands: true,
            bets: true,
            currentGame: true
        }
    });
    console.log(player);
    console.log(player.currentGame.currentBet);
    console.log(player.currentGame.pot);
}

playerTest();