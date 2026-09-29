// INTENTIONALLY VULNERABLE SAMPLE — do not deploy.
const crypto = require("crypto");

function hashPassword(password) {
  // Unsalted MD5 — fast to brute force, identical passwords collide.
  return crypto.createHash("md5").update(password).digest("hex");
}

function checkPassword(password, storedHash) {
  return hashPassword(password) == storedHash;
}

module.exports = { hashPassword, checkPassword };
