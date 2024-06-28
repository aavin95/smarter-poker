import NextAuth from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import GoogleProvider from 'next-auth/providers/google';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const options = {
    session: {
        strategy: 'jwt',
    },
    providers: [
        GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            // Add user ID to the session object
            const dbUser = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
            session.user.id = dbUser.id;
            return session;
        },
    },
    adapter: PrismaAdapter(prisma),
};

const handler = NextAuth(options);

export { handler as GET, handler as POST };
