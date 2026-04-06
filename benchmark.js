const { performance } = require('perf_hooks');
const mongoose = require('mongoose');
const Redis = require('ioredis');

// We will test the latency of basic redis vs mongo
// Start redis client
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
});

async function run() {
  redis.on('error', (err) => console.log('Redis error:', err.message));
  
  const startRedis = performance.now();
  await redis.ping();
  const endRedis = performance.now();
  console.log(`Redis Ping Latency: ${endRedis - startRedis} ms`);

  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/mulli');
  const startMongo = performance.now();
  await mongoose.connection.db.admin().ping();
  const endMongo = performance.now();
  console.log(`Mongo Ping Latency: ${endMongo - startMongo} ms`);

  process.exit(0);
}

run();
