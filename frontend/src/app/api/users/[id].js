import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  // Assuming 'email' is the parameter passed in the query string and it's URL-encoded
  const { email } = req;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
}
