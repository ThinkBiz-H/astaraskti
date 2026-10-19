const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter Password: ", async (password) => {
  const hash = await bcrypt.hash(password, 10);

  console.log("\nPassword :", password);
  console.log("Hash     :", hash);

  rl.close();
});
