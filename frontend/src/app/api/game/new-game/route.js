import { getSession } from "next-auth/react";
import prisma from "@/lib/prisma";

export async function GET(request) {
    return NextResponse.json({ message: 'good' }, { status: 200 });
    // try {
    //   const user = await prisma.user.findUnique({
    //     where: { email: email },
    //   });
    //   if (user) {
    //     console.log("this user, ", user);
    //     return NextResponse.json(user, { status: 200 });
    //   }
    //   else {
    //     return NextResponse.json({ message: 'User not found' }, { status: 404 });
    //   }
    // }
    // catch (error) {
    //   return NextResponse.json({ error: 'Error fetching user' }, { status: 500 });
    // }
  }