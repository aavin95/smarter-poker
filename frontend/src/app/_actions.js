'use server'
import { newGame } from '@/lib/newGame'

export async function NewGame(userEmail) {
    try
    {
        console.log("Attempting to find user with email:", userEmail);
        const user = await prisma.User.findFirst({
                where:  {
                    email: userEmail
                }
        });
        console.log("user id in _actions.js", user.id)
        const gameId = await newGame( { user });
        return gameId;
    }
    catch(error){
        console.error(error);
        return null;
    }
}