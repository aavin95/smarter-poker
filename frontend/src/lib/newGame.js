import prisma from "./prisma"

export async function newGame({ user }) {
    if (!user) {
        console.error("User is undefined");
        return null;
    }
    try
    {  
        console.log("user id in newGame.js", user.id)
        const game = await prisma.Game.create({
        data: {
            players: {
                connect: [{
                    id: user.id
                }]
            }
        },
    });
    return game.id;
    }
    catch(error) {
        console.error(error);
        return null;
    }

}