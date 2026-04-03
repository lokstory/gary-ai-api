import * as argon2 from 'argon2';

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error('Usage: ts-node scripts/hash-password.ts <password>');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password);
  console.log(passwordHash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
