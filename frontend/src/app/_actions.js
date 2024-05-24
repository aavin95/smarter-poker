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

// Server action to add a player to a game
export async function JoinGame(gameId, userEmail) {
    try {
        console.log("Attempting to find user with email:", userEmail);
        const user = await prisma.User.findFirst({
            where: {
                email: userEmail
            }
        });

        if (!user) {
            throw new Error(`No user found with email: ${userEmail}`);
        }

        console.log("user id in _actions.js", user.id);

        // Check if the user is already in the game
        const isUserInGame = await prisma.Game.findFirst({
            where: {
                id: gameId,
                players: {
                    some: {
                        id: user.id
                    }
                }
            }
        });

        if (isUserInGame) {
            console.log(`User with email ${userEmail} is already in the game with id ${gmaeId}`);
            return null; // or some appropriate response indicating the user is already in the game
        }

        // Add user to the game if they are not already a participant
        const game = await prisma.Game.update({
            where: { id: gameId },
            data: {
                players: {
                    connect: [{ id: user.id }]
                }
            }
        });

        return game.id;
    } catch (error) {
        console.error(error);
        return null;
    }
}
