const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('✅ Admin user found:');
    console.log('  - ID:', admin.id);
    console.log('  - Email:', admin.email);
    console.log('  - Global Role:', admin.globalRole);
    console.log('  - Created:', admin.createdAt);

    if (admin.globalRole !== 'ADMIN') {
      console.log('\n⚠️  Admin user does not have ADMIN globalRole!');
      console.log('   Current role:', admin.globalRole);
      console.log('\n   Updating to ADMIN...');

      await prisma.user.update({
        where: { id: admin.id },
        data: { globalRole: 'ADMIN' },
      });

      console.log('✅ Admin user updated to ADMIN globalRole');
    } else {
      console.log('\n✅ Admin user has correct ADMIN globalRole');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
