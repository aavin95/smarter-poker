'use server'
import { newGame } from '@/lib/newGame'

export async function NewGame(userEmail) {
    try
    {
        console.log("Attempting to find user with email in _actions.js:", userEmail);
        const user = await prisma.User.findUnique({
                where:  {
                    email: userEmail
                }
        });
        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }

        console.log("user id in _actions.js", user.id)
        const gameId = await newGame( { user });
        return gameId;
    }
    catch(error){
        console.error(error);
        return null;
    }
}

export async function LeaveGame(gameId, userEmail) {
    try {
        console.log("Attempting to find user with email:", userEmail);
        const user = await prisma.User.findFirst({
            where: {
                email: userEmail
            }
        });
        console.log("user id in _actions.js", user.id);
        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }
        const isUserInGame = await prisma.Game.findFirst({
            where: {
                id: gameId,
                players: {
                    some: {
                        id: user.id
                    }
                }
            },
            include: { players: true }
        });
        console.log("isUserInGame", isUserInGame);
        if (!isUserInGame) {
            console.log(`User with email ${userEmail} isn't in the game with id ${gameId}`);
            return null; // or some appropriate response indicating the user is already in the game
        }
        await prisma.hand.updateMany({
            where: { gameId: gameId },
            data: { state: 'finished' }
        });

        let game = await prisma.Game.update({
            where: { id: gameId },
            data: {
                players: {
                    disconnect: [{ id: user.id }]
                }
            },
            include: { players: true }
        });
        if (game.players.length === 0) {
            game = await prisma.Game.update({
                where: { id: gameId },
                data: {
                    state: 'finished'
                },
                include: { players: true }
            });
        }
        return game;
    }
    catch(error) {
        console.error(error);
        return null;
    }
}
