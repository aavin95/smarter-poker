"use client"
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react"

function Dashboard() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const { data: session, status } = useSession();  

  const userEmail = session?.user?.email;
  useEffect(() => {
    fetch(`/api/users/${userEmail}`)
    .then(response => response.json())
    .then(data => {
      if (data.balance !== undefined) {
        setBalance(data.balance);
        setLoading(false);
      } else {
        throw new Error(data.message || 'Failed to fetch balance');
      }
    })
    .catch(error => {
      console.error('Error fetching balance:', error);
      setLoading(false);
    });
  }, [userEmail]);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Your Balance: ${balance}</h1>
      {/* Additional content */}
    </div>
  );
}

export default Dashboard;
