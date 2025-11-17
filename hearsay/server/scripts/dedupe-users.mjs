#!/usr/bin/env node
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import * as db from '../dbAPI.js';

async function dedupeByEmail() {
  const users = db.Users.collection();
  const dupes = await users
    .aggregate([
      { $match: { email: { $type: 'string' } } },
      { $group: { _id: '$email', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  let removed = 0;
  for (const d of dupes) {
    const ids = d.ids.sort(); // ObjectIds are comparable by hex string order
    const keep = ids[0];
    const toDelete = ids.slice(1);
    if (toDelete.length) {
      const res = await users.deleteMany({ _id: { $in: toDelete } });
      removed += res.deletedCount || 0;
      // eslint-disable-next-line no-console
      console.log(`[dedupe-email] Kept ${keep}, removed ${toDelete.length} for email=${d._id}`);
    }
  }
  return removed;
}

async function dedupeByGoogleUid() {
  const users = db.Users.collection();
  const dupes = await users
    .aggregate([
      { $unwind: '$accounts' },
      { $match: { 'accounts.kind': 'Google', 'accounts.uid': { $type: 'string' } } },
      { $group: { _id: '$accounts.uid', docs: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  let removed = 0;
  const alreadyRemoved = new Set();
  for (const d of dupes) {
    const ids = [...new Set(d.docs.map(String))].sort();
    const keep = ids[0];
    const toDelete = ids.slice(1).filter((id) => !alreadyRemoved.has(id));
    if (toDelete.length) {
      const res = await users.deleteMany({ _id: { $in: toDelete.map((s) => new ObjectId(s)) } });
      removed += res.deletedCount || 0;
      toDelete.forEach((id) => alreadyRemoved.add(id));
      // eslint-disable-next-line no-console
      console.log(`[dedupe-google] Kept ${keep}, removed ${toDelete.length} for uid=${d._id}`);
    }
  }
  return removed;
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('[dedupe] Connecting to DB...');
  await db.connectMongo();

  const removedEmail = await dedupeByEmail();
  const removedUid = await dedupeByGoogleUid();

  // eslint-disable-next-line no-console
  console.log(`[dedupe] Removed by email: ${removedEmail}, by google uid: ${removedUid}`);

  // Ensure unique indexes after cleanup
  await db.ensureUserIndexes();
  // eslint-disable-next-line no-console
  console.log('[dedupe] Unique indexes ensured.');
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[dedupe] Failed:', e);
  process.exit(1);
});
