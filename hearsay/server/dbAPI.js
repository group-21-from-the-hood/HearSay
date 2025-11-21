// Basic MongoDB access helpers and collection-specific CRUD for HearSay
//
// Env vars used:
// - MONGO_URI:       e.g. mongodb://localhost:27017
// - MONGO_DB_NAME:   e.g. HearSay (default)
//
// Example usage:
//   import { connectMongo, Albums } from './dbAPI.js';
//   await connectMongo();
//   const album = await Albums.create({ name: 'Test', artist: { name: 'X' } });
//   const found = await Albums.getById(album._id);
//
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Load .env so we can read DB credentials if this file is imported directly
dotenv.config();

// Read env - only use MONGO_* (ignore VITE_* on server)
const {
  MONGO_URI,
  MONGO_HOST = 'localhost',
  MONGO_PORT = '27017',
  MONGO_DB_NAME = 'HearSay',
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_AUTH_SOURCE
} = process.env;

let effectiveMongoUri = MONGO_URI;
if (!effectiveMongoUri) {
  const creds = MONGO_USERNAME
    ? `${encodeURIComponent(MONGO_USERNAME)}:${encodeURIComponent(MONGO_PASSWORD || '')}@`
    : '';
  const authSourceParam = MONGO_AUTH_SOURCE ? `authSource=${encodeURIComponent(MONGO_AUTH_SOURCE)}` : '';
  const params = [authSourceParam].filter(Boolean).join('&');
  const suffix = params ? `/?${params}` : '';
  effectiveMongoUri = `mongodb://${creds}${MONGO_HOST}:${MONGO_PORT}${suffix}`;
}

console.log('[DB] Effective Mongo URI (sanitized):', effectiveMongoUri.replace(/:[^:@/]+@/, ':****@'));

let client;
let db;

export async function connectMongo(uri = effectiveMongoUri, dbName = MONGO_DB_NAME) {
  if (db) return db;
  const opts = { maxPoolSize: 10 };
  client = new MongoClient(uri, opts);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Mongo not connected. Call connectMongo() first.');
  return db;
}

export function getClient() {
  if (!client) throw new Error('Mongo client not connected. Call connectMongo() first.');
  return client;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}

function toObjectId(id) {
  if (!id) return undefined;
  if (id instanceof ObjectId) return id;
  try { return new ObjectId(String(id)); } catch {
    return undefined;
  }
}

function collection(name) {
  return getDb().collection(name);
}

// Generic CRUD helpers
export const CRUD = {
  async insertOne(col, doc) {
    const { insertedId } = await collection(col).insertOne(doc);
    return { ...doc, _id: insertedId };
  },
  async findById(col, id, { projection } = {}) {
    const _id = toObjectId(id);
    if (!_id) return null;
    return collection(col).findOne({ _id }, { projection });
  },
  async findMany(col, filter = {}, { sort, limit, skip, projection } = {}) {
    let cursor = collection(col).find(filter, { projection });
    if (sort) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
  },
  async updateById(col, id, update, { upsert = false, returnDocument = 'after' } = {}) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const res = await collection(col).findOneAndUpdate(
      { _id },
      update && (update.$set || update.$inc || update.$push || update.$pull) ? update : { $set: update },
      { upsert, returnDocument }
    );
    return res.value;
  },
  async deleteById(col, id) {
    const _id = toObjectId(id);
    if (!_id) return { deletedCount: 0 };
    return collection(col).deleteOne({ _id });
  },
  async count(col, filter = {}) {
    return collection(col).countDocuments(filter);
  },
};

// Collection names
const COL = {
  albums: 'albums',
  artists: 'artists',
  reviews: 'reviews',
  songs: 'songs',
  users: 'users',
  sessions: 'sessions',
};

// Domain-specific wrappers (thin)
function makeApi(colName) {
  return {
    create: (doc) => CRUD.insertOne(colName, doc),
    getById: (id, opts) => CRUD.findById(colName, id, opts),
    list: (filter = {}, opts = {}) => CRUD.findMany(colName, filter, opts),
    update: (id, update, opts) => CRUD.updateById(colName, id, update, opts),
    remove: (id) => CRUD.deleteById(colName, id),
    count: (filter = {}) => CRUD.count(colName, filter),
    collection: () => collection(colName),
  };
}

export const Albums = makeApi(COL.albums);
export const Artists = makeApi(COL.artists);
export const Reviews = makeApi(COL.reviews);
export const Songs = makeApi(COL.songs);
export const Users = makeApi(COL.users);
export const Sessions = makeApi(COL.sessions);

// Convenience starter that you can call once on server boot
export async function initDb() {
  try {
    await connectMongo();
  } catch (e) {
    console.error('DB connection failed', e);
    console.log('Server failed to connect to DB, connection failure.');
  }
}

// Create helpful unique indexes to prevent duplicate user documents
export async function ensureUserIndexes() {
  await connectMongo();
  const users = collection('users');
  try {
    await users.createIndex(
      { email: 1 },
      {
        unique: true,
        // Only enforce uniqueness when email is a string (skip missing/null)
        partialFilterExpression: { email: { $type: 'string' } },
        name: 'uniq_email_if_string',
      }
    );
  } catch (e) {
    console.warn('[DB] ensureUserIndexes email index warning:', e.message || e);
  }

  try {
    await users.createIndex(
      { 'accounts.kind': 1, 'accounts.uid': 1 },
      {
        unique: true,
        // Enforce only when both kind and uid are strings
        partialFilterExpression: {
          'accounts.uid': { $type: 'string' },
          'accounts.kind': { $type: 'string' },
        },
        name: 'uniq_account_kind_uid',
      }
    );
  } catch (e) {
    console.warn('[DB] ensureUserIndexes accounts index warning:', e.message || e);
  }
}

// Ensure one review per user per item (song/album/artist)
export async function ensureReviewIndexes() {
  await connectMongo();
  const reviews = collection('reviews');
  try {
    await reviews.createIndex(
      { 'user.oid': 1, 'item.type': 1, 'item.oid': 1 },
      {
        unique: true,
        partialFilterExpression: {
          'user.oid': { $type: 'string' },
          'item.type': { $type: 'string' },
          'item.oid': { $type: 'string' },
        },
        name: 'uniq_user_item',
      }
    );
  } catch (e) {
    console.warn('[DB] ensureReviewIndexes warning:', e.message || e);
  }
}

export default {
  connectMongo,
  getDb,
  closeMongo,
  initDb,
  ensureUserIndexes,
  ensureReviewIndexes,
  CRUD,
  Albums,
  Artists,
  Reviews,
  Songs,
  Users,
  Sessions,
};
