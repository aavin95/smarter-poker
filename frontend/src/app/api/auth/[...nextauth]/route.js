import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google';
import prisma from '../../../../lib/prisma';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

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
    callback: {
        async signIn({ account, profile }) {
            if (!profile?.email) {
                throw new Error('No profile')
            }

            await prisma.User.upsert({
                where: {
                    email: profile.email,
                },
                create: {
                    email: profile.email,
                    name: profile.name,
                },
                update: {
                    name: profile.name,
                }
            })
            return true
        }
    }
}

const handler =  NextAuth(options)

export { handler as GET, handler as POST}