import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import GoogleProvider from 'next-auth/providers/google';


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

//const prisma = new PrismaClient()

const options = {
    session: {
        strategy: 'jwt'
    },
    providers: [
        GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET
        })
    ],
    adapter: PrismaAdapter(prisma)
}

const handler =  NextAuth(options)

export { handler as GET, handler as POST}