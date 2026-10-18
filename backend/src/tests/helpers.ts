import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Express } from 'express';
import supertest from 'supertest';
import { createApp } from '../app';
import { connectDB, disconnectDB } from '../config/db';

let mongo: MongoMemoryServer;
let app: Express;

export async function startTestServer() {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri());
  app = createApp();
  return app;
}

export async function stopTestServer() {
  await disconnectDB();
  if (mongo) await mongo.stop();
}

export async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export function api() {
  return supertest(app);
}

/** Bootstrap the first (owner) user and return an auth token + helpers. */
export async function bootstrapOwner(email = 'owner@mnm.test', password = 'secret123') {
  await supertest(app).post('/api/auth/register').send({ name: 'Owner', email, password }).expect(201);
  const res = await supertest(app).post('/api/auth/login').send({ email, password }).expect(200);
  const token: string = res.body.data.token;
  return {
    token,
    auth: (req: supertest.Test) => req.set('Authorization', `Bearer ${token}`),
  };
}
