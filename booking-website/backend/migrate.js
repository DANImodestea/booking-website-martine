const mongoose = require('mongoose');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json');

console.log("🚀 Starting Migration from MongoDB to Firestore...");

// 1. Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

// 2. Connect to MongoDB
const MONGO_URI = 'mongodb://kendanine8_db_user:Z2nf3DiWPb04dDHb@cluster0.svjjckc.mongodb.net:27017/bookingApp?retryWrites=true&w=majority';

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI, { family: 4 });
    console.log("✅ Connected to MongoDB!");

    const db = mongoose.connection.db;

    // --- MIGRATE RESERVATIONS ---
    const reservations = await db.collection('reservations').find({}).toArray();
    console.log(`\n📦 Found ${reservations.length} reservations in MongoDB.`);

    let resCount = 0;
    for (const res of reservations) {
      const id = res._id.toString();
      delete res._id; // Remove MongoDB specific ID
      
      // Convert Dates to Strings to match the new Firebase API format
      Object.keys(res).forEach(key => {
          if (res[key] instanceof Date) {
              res[key] = res[key].toISOString();
          }
      });

      await firestore.collection('reservations').doc(id).set(res);
      resCount++;
    }
    console.log(`✅ Successfully copied ${resCount} reservations to Firestore!`);

    // --- MIGRATE CLIENTS ---
    const clients = await db.collection('clients').find({}).toArray();
    console.log(`\n📦 Found ${clients.length} clients in MongoDB.`);

    let clientCount = 0;
    for (const client of clients) {
      const id = client._id.toString();
      delete client._id;
      
      Object.keys(client).forEach(key => {
          if (client[key] instanceof Date) {
              client[key] = client[key].toISOString();
          }
      });

      await firestore.collection('clients').doc(id).set(client);
      clientCount++;
    }
    console.log(`✅ Successfully copied ${clientCount} clients to Firestore!`);

    console.log("\n🎉 MIGRATION COMPLETE! You can now close this terminal.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();