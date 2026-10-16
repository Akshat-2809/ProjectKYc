// Usage: npm run hash-password
// Prompts for the admin password (input hidden) and prints the value for ADMIN_PASSWORD_HASH.
// The plain password is never written anywhere.
import { randomBytes, scryptSync } from "node:crypto";
import readline from "node:readline";

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write("*");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.argv[2] ?? (await ask("Admin password: "));
if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`\nADMIN_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}\n`);
