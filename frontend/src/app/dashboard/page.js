"use client"
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react"

function Dashboard() {
  const [balance, setBalance] = useState(0);
  const [numGamesPlayed, setNumGamesPlayed] = useState(0);
  const [numGamesWon, setNumGamesWon] = useState(0);
  const [loading, setLoading] = useState(true);

  const { data: session, status } = useSession();  

  const userEmail = session?.user?.email;
  useEffect(() => {
    if (userEmail) {
      const encodedEmail = userEmail;
      fetch(`/api/users/${encodedEmail}`)
      .then(response => response.json())
      .then(data => {
        if (data.balance !== undefined) {
          setBalance(data.balance);
          setLoading(false);
        } else {
          throw new Error(data.message || 'Failed to fetch balance');
        }
        if (data.numGamesPlayed !== undefined) {
          setNumGamesPlayed(data.numGamesPlayed);
        }
        else {
          throw new Error(data.message || 'Failed to num games played');
        }
        if (data.numGamesWon !== undefined) {
          setNumGamesWon(data.numGamesWon);
        }
        else {
            throw new Error(data.message || 'Failed to num games won');
        }
      })
      .catch(error => {
        console.error('Error fetching balance:', error);
        setLoading(false);
      });
    }
  }, [userEmail]);
  

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Your Balance: ${balance}</h1>
      <h1>Number of Games Played: {numGamesPlayed}</h1>
      <h1>Number of Games Won: {numGamesWon}</h1>
      <h1>Win Percentage: {numGamesPlayed > 0 ? ((numGamesWon / numGamesPlayed) * 100).toFixed(2) : 0}%</h1>
    </div>
  );
}

export default Dashboard;
