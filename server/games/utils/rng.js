const crypto = require('crypto');

function randomInt(min, max) {
  return crypto.randomInt(min, max);
}

function randomFloat() {
  return crypto.randomInt(0, 1000000) / 1000000;
}

function generateSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function hmacResult(serverSeed, clientSeed, nonce) {
  return crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
}

module.exports = { randomInt, randomFloat, generateSeed, hashSeed, hmacResult };
