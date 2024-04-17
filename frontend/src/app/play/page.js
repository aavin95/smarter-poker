import Head from 'next/head';
import { options } from "../api/auth/[...nextauth]/route"
import { getServerSession } from "next-auth/next"
import Navbar from '../../components/Navbar'
import Hero from '../../components/Hero'
import Features from '../../components/Features'
import Footer from '../../components/Footer'

export default async function Home() {
  const session = await getServerSession(options)
  return (
    <div>
      <Head>
        <title>Smarter Poker</title>
        <meta name="description" content="Join Smarter Poker, the best place to play!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <>
        {session ? (
          <div className="bg-green-100 text-green-700 text-center py-4">
            <p>You are signed in!</p>
          </div>
        ) : (
          <div className="bg-red-100 text-red-700 text-center py-4">
            <p>You are not signed in!</p>
          </div>
        )}
      </>
    </div>
  );
}
