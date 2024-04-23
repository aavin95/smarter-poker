"use client"
import Head from 'next/head';
import { options } from "./api/auth/[...nextauth]/route"
import { getServerSession } from "next-auth/next"
import Hero from '../components/Hero'
import Features from '../components/Features'
import prisma from '@/lib/prisma'
import { useEffect, useState } from 'react';
import { useSession } from "next-auth/react"

export default function Home() {
  const { data: session, status } = useSession();  

  return (
    <div>
      <Head>
        <title>Smarter Poker</title>
        <meta name="description" content="Join Smarter Poker, the best place to play!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Hero />
      <>
        {session ? (
          <div className="bg-green-100 text-green-700 text-center py-4">
            <p>You are signed in!</p>
            <p>{session.user.email}</p>
          </div>
        ) : (
          <div className="bg-red-100 text-red-700 text-center py-4">
            <p>You are not signed in!</p>
          </div>
        )}
      </>
      <Features />
    </div>
  );
}
