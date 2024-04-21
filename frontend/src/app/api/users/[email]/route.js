// pages/api/users/[email].js
import { PrismaClient } from '@prisma/client';
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    console.log("this req, ", request);
    const url = new URL(request.url);
    console.log("this url, ", url); 
    const email = url.pathname.split('/').pop();
    console.log("this email, ", email);
    const user = await prisma.user.findUnique({
      where: { email: email },
    });
    if (user) {
      console.log("this user, ", user);
      return NextResponse.json(user, { status: 200 });
    }
    else {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
  }
  catch (error) {
    return NextResponse.json({ error: 'Error fetching user' }, { status: 500 });
  }
}