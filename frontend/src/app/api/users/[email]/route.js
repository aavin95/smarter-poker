// pages/api/users/[email].js
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server";

//const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const url = new URL(request.url);
    console.log("this url", url);
    const user_email = url.pathname.split('/').pop();
    console.log("this user_email", user_email);
    const user = await prisma.user.findUnique({
      where: { email: user_email },
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