const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllHands() {
  try {
    const deleteResult = await prisma.hand.deleteMany({});
    console.log(`${deleteResult.count} hands were deleted.`);
  } catch (error) {
    console.error('Failed to delete hands:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllHands();
