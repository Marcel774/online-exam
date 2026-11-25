import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.ts';

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  let uri = env.mongodbUri;

  if (!uri) {
    const dataDir = path.resolve(process.cwd(), '.exampro-mongo');
    fs.mkdirSync(dataDir, { recursive: true });

    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: dataDir,
          storageEngine: 'wiredTiger',
        },
      });
    } catch {
      // Fallback to ephemeral in-memory instance if local lock exists
      memoryServer = await MongoMemoryServer.create();
    }

    uri = memoryServer.getUri('exampro');
  }

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  console.log(`MongoDB connected (${env.mongodbUri ? 'external URI' : 'embedded MongoDB engine'})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
