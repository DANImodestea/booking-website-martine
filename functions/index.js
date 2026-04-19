const functions = require('firebase-functions');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

const SECRET_KEY = process.env.JWT_SECRET || 'martine_super_secret_key_2026';

// Middleware
console.log('[INFO] [STARTUP] Setting up CORS middleware');
app.use(cors()); // Allows frontend to make requests to this backend
console.log('[INFO] [STARTUP] Setting up JSON middleware');
app.use(express.json()); // Allows backend to understand JSON data

// Configure Email Transporters for Admins
const transporters = {
    Dani: nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'kendanine8@gmail.com',
            pass: 'klgegeyisqvanjwy'
        }
    }),
    Martine: nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'mjuillan38@gmail.com',
            pass: 'fbmumyzmivnnpggm'
        }
    })
};

// Connect to MongoDB
console.log('\n[INFO] [STARTUP] Starting MongoDB connection process...');
const DB_URI = process.env.MONGO_URI || 'mongodb://kendanine8_db_user:Z2nf3DiWPb04dDHb@cluster0.svjjckc.mongodb.net:27017/bookingApp?retryWrites=true&w=majority';
console.log('[INFO] [STARTUP] DB_URI configured:', DB_URI.substring(0, 50) + '...');

mongoose.connect(DB_URI, {
    family: 4, // 👈 FORCES IPv4: Bypasses the "querySrv ECONNREFUSED" network bug entirely!
    serverSelectionTimeoutMS: 30000, // Increased from 10000
    socketTimeoutMS: 45000,
    retryWrites: true,
    authSource: 'admin'
})
    .then(() => {
        console.log('[OK] [MONGODB] Connected to MongoDB Database successfully!');
        console.log('[NET] [MONGODB] Connection state:', mongoose.connection.readyState);
        
        // Auto-patch old reservations missing a unique ID
        (async () => {
            try {
                const missingIdRes = await Reservation.find({ resId: { $exists: false } });
                for (let r of missingIdRes) {
                    if (!r.adminProfile) r.adminProfile = 'Martine'; // Legacy fallback
                    r.resId = generateResId();
                    await r.save();
                }
            } catch (err) {
                console.error('[ERR] [DB] Failed to auto-patch missing IDs:', err.message);
            }
        })();
        
        // Initialize Clients from existing reservations automatically
        (async () => {
            try {
                const clientCount = await Client.countDocuments();
                if (clientCount === 0) {
                    console.log('[INFO] [DB] Populating Client database from existing reservations...');
                    const allRes = await Reservation.find();
                    for (let r of allRes) {
                        const q = r.email ? { email: r.email } : (r.phone ? { phone: r.phone } : null);
                        const adminProf = r.adminProfile || 'Martine'; // Legacy fallback
                        if (q) {
                            await Client.findOneAndUpdate({ ...q, adminProfile: adminProf },
                                { $set: { fname: r.fname, lname: r.lname, adminProfile: adminProf, verified: true }, $inc: { totalReservations: 1 }, $max: { lastActive: r.createdAt } },
                                { upsert: true });
                        }
                    }
                    console.log('[OK] [DB] Client database populated.');
                }
            } catch (err) {
                console.error('[ERR] [DB] Failed to initialize clients:', err.message);
            }
        })();
    })
    .catch(err => {
        console.error('[ERR] [MONGODB] MongoDB connection error:', err.message);
        console.error('[ERR] [MONGODB] Full error stack:', err.stack);
        console.error('[ERR] [MONGODB] Connection code:', err.code);
        if (err.message.includes('querySrv ECONNREFUSED')) {
            console.log('\n[HINT] TIP: Your internet provider or router is blocking MongoDB SRV DNS lookups.\n[HINT] FIX: Change your computer DNS to 8.8.8.8 (Google DNS) OR use the legacy connection string from your Atlas dashboard.\n');
        }
    });

// MongoDB Connection Event Listeners for Detailed Debugging
mongoose.connection.on('connecting', () => console.log('[WAIT] [MONGODB] Attempting to connect...'));
mongoose.connection.on('connected', () => console.log('[OK] [MONGODB] Connected!'));
mongoose.connection.on('error', (err) => console.error('[ERR] [MONGODB] Error event:', err.message, '\nFull error:', err));
mongoose.connection.on('disconnecting', () => console.log('[WARN] [MONGODB] Disconnecting...'));
mongoose.connection.on('disconnected', () => console.log('[HALT] [MONGODB] Disconnected from MongoDB!'));
mongoose.connection.on('reconnected', () => console.log('[SYNC] [MONGODB] Reconnected after disconnection!'));
mongoose.connection.on('reconnectFailed', (err) => console.error('[ERR] [MONGODB] Reconnection failed:', err.message));

// Helper for robust date formatting in Node environments missing full ICU
const getParisFullDate = (isoString, lang) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    try {
        const formatter = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris'
        });
        const str = formatter.format(d);
        if (str.length < 10 || str.includes('/')) throw new Error('ICU missing');
        return str.replace(/\b\w/g, c => c.toUpperCase());
    } catch (e) {
        d.setUTCHours(d.getUTCHours() + 2);
        const daysFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const monthsFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayName = lang === 'fr' ? daysFr[d.getUTCDay()] : daysEn[d.getUTCDay()];
        const monthName = lang === 'fr' ? monthsFr[d.getUTCMonth()] : monthsEn[d.getUTCMonth()];
        return lang === 'fr' ? `${dayName} ${d.getUTCDate()} ${monthName} ${d.getUTCFullYear()}` : `${dayName}, ${monthName} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    }
};

// Helper to generate a unique readable Reservation ID (e.g. AB39K2)
function generateResId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes I, O, 1, 0 for readability
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Define the Permanent Client Database Schema
const clientSchema = new mongoose.Schema({
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    fname: { type: String, default: '' },
    lname: { type: String, default: '' },
    adminProfile: { type: String, required: true },
    totalReservations: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }, // 👈 NEW
    verificationCode: { type: String, default: '' }, // 👈 NEW
    codeExpires: { type: Date, default: null }, // 👈 NEW
    createdAt: { type: Date, default: Date.now }
});
const Client = mongoose.model('Client', clientSchema);

// Define the Reservation Database Schema
const reservationSchema = new mongoose.Schema({
    adminProfile: { type: String, required: true, enum: ['Martine', 'Dani'] }, // 👈 NEW: Track which admin
    resId: { type: String, default: generateResId, unique: true }, // 👈 NEW: Unique tracking ID
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    message: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    adminReply: { type: String, default: '' },
    classDone: { type: Boolean, default: false }, // 👈 NEW: Track if class was completed
    recurring: { type: String, default: 'one-time' },
    status: { type: String, default: 'pending' },
    startDate: { type: String, default: null },
    startTime: { type: String, default: null },
    endDate: { type: String, default: null },
    endTime: { type: String, default: null },
    extensionOffered: { type: Boolean, default: false },
    slots: [{
        day: String,
        time: String,
        fullDate: String,
        reminderSent: { type: Boolean, default: false },
        classDone: { type: Boolean, default: false } // 👈 NEW: Track individual slots
    }],
    studentLinks: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

const Reservation = mongoose.model('Reservation', reservationSchema);

// --- API ROUTES ---

// 0. Admin Login (JWT Generation)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\n[AUTH] [API] Login attempt for username: "${username}"`);
    
    // Check Martine
    if (username === 'Martine' && password === 'Mimi33') {
        console.log(`[OK] [API] Login successful for Martine`);
        const token = jwt.sign({ role: 'admin', adminProfile: 'Martine' }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, adminProfile: 'Martine' });
    }
    // Check Dani
    else if (username === 'Dani' && password === 'Dandan33') {
        console.log(`[OK] [API] Login successful for Dani`);
        const token = jwt.sign({ role: 'admin', adminProfile: 'Dani' }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, adminProfile: 'Dani' });
    }
    // Invalid credentials
    else {
        console.log(`[ERR] [API] Login failed (Invalid credentials for username: "${username}")`);
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// 1. GET all reservations
app.get('/api/reservations', async (req, res) => {
    try {
        const { adminProfile } = req.query; // Get admin profile from query params
        console.log('\n[REQ] [API] GET /api/reservations request received');
        console.log('[USER] [API] Admin Profile:', adminProfile);
        console.log('[NET] [API] MongoDB connection state:', mongoose.connection.readyState, '(0=disconnected, 1=connected, 2=connecting, 3=disconnecting)');
        
        if (mongoose.connection.readyState !== 1) {
            console.warn('[WARN] [API] WARNING: Not connected to MongoDB!');
        }
        
        // Build filter based on adminProfile
        const filter = adminProfile ? { adminProfile } : {};
        
        console.log('[WAIT] [API] Querying Reservation.find()...');
        const reservations = await Reservation.find(filter).sort({ createdAt: 1 });
        console.log('[OK] [API] Successfully fetched', reservations.length, 'reservations for profile:', adminProfile || 'all');
        res.json(reservations);
    } catch (error) {
        console.error('\n[ERR] [API] Failed to fetch reservations from MongoDB');
        console.error('[LOC] [API] Error message:', error.message);
        console.error('[LOC] [API] Error code:', error.code);
        console.error('[LOC] [API] Error stack:', error.stack);
        console.error('[NET] [API] Connection state at error:', mongoose.connection.readyState);
        res.status(500).json({ 
            message: "Error fetching reservations", 
            error: error.message,
            mongodb_connection_state: mongoose.connection.readyState
        });
    }
});

// 2. POST a new reservation
app.post('/api/reservations', async (req, res) => {
    try {
        console.log('\n[REQ] [API] POST /api/reservations request received');
        console.log('[NET] [API] MongoDB connection state:', mongoose.connection.readyState);
        console.log('[DATA] [API] Request body:', JSON.stringify(req.body).substring(0, 100), '...');
        
        // Ensure adminProfile is included
        if (!req.body.adminProfile) {
            return res.status(400).json({ message: "adminProfile is required" });
        }
        
        // Auto-populate studentLinks from previous reservations for this email
        if (req.body.email) {
            const previousRes = await Reservation.findOne({ 
                email: req.body.email, 
                adminProfile: req.body.adminProfile, 
                studentLinks: { $exists: true, $not: { $size: 0 } } 
            });
            if (previousRes && previousRes.studentLinks) {
                req.body.studentLinks = previousRes.studentLinks;
            }
        }

        // Upsert Permanent Client Record
        try {
            const clientQuery = req.body.email ? { email: req.body.email } : (req.body.phone ? { phone: req.body.phone } : null);
            if (clientQuery) {
                await Client.findOneAndUpdate(
                    { ...clientQuery, adminProfile: req.body.adminProfile },
                    { $set: { fname: req.body.fname, lname: req.body.lname, adminProfile: req.body.adminProfile },
                      $inc: { totalReservations: 1 },
                      $max: { lastActive: new Date() } },
                    { upsert: true, new: true }
                );
            }
        } catch (clientErr) {
            console.error('[ERR] [DB] Failed to upsert client record:', clientErr.message);
        }

        const newReservation = new Reservation(req.body);
        console.log('[WAIT] [API] Saving reservation to MongoDB for profile:', req.body.adminProfile);
        const savedReservation = await newReservation.save();
        console.log('[OK] [API] Successfully saved reservation with ID:', savedReservation._id);
        res.status(201).json(savedReservation);

        // --- ADMIN EMAIL NOTIFICATION LOGIC ---
        try {
            const adminEmail = req.body.adminProfile === 'Martine' ? 'mjuillan38@gmail.com' : 'kendanine8@gmail.com';
            const transporter = transporters[req.body.adminProfile] || transporters['Dani'];
            
            const formatTimeFR = (timeStr) => {
                if (!timeStr || (!timeStr.includes('AM') && !timeStr.includes('PM'))) return timeStr;
                const [time, modifier] = timeStr.split(' ');
                let [h, m] = time.split(':');
                h = parseInt(h, 10);
                if (modifier === 'PM' && h < 12) h += 12;
                if (modifier === 'AM' && h === 12) h = 0;
                return `${h.toString().padStart(2, '0')}h${m}`;
            };

            const slotsTextFr = savedReservation.slots && savedReservation.slots.length > 0 
                ? savedReservation.slots.map(s => {
                    let dayStr = s.day;
                    if (s.fullDate) {
                        dayStr = getParisFullDate(s.fullDate, 'fr');
                    } else if (dayStr) {
                        dayStr = dayStr.replace(/\b\w/g, c => c.toUpperCase());
                    }
                    return `- ${dayStr} à ${formatTimeFR(s.time)}`;
                }).join('\n') 
                : 'Aucun créneau spécifique';
                
            const mailOptions = {
                from: `"Système de Réservation" <${adminEmail}>`,
                to: adminEmail,
                subject: `Nouvelle réservation [${savedReservation.resId}] : ${savedReservation.fname} ${savedReservation.lname}`,
                text: `Bonjour ${req.body.adminProfile},\n\nVous avez reçu une nouvelle demande de réservation de la part de ${savedReservation.fname} ${savedReservation.lname}.\n\n` +
                      `Détails du client :\n` +
                      `- ID Réservation : ${savedReservation.resId}\n` +
                      `- Email : ${savedReservation.email || 'Non renseigné'}\n` +
                      `- Téléphone : ${savedReservation.phone || 'Non renseigné'}\n` +
                      `- Message : ${savedReservation.message || 'Aucun message'}\n\n` +
                      `Créneaux demandés (${savedReservation.recurring === 'weekly' ? 'Hebdomadaire' : 'Une fois'}) :\n${slotsTextFr}\n\n` +
                      `Cliquez sur le lien suivant pour gérer cette réservation :\nhttps://jr-english.onrender.com/\n\n` +
                      `Cordialement,\nVotre site web\n\n---\n` +
                      `Ceci est un message automatique, merci de ne pas y répondre.`
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.error(`[ERR] [EMAIL] Failed to send notification to ${adminEmail}:`, error.message);
                else console.log(`[OK] [EMAIL] Admin notification sent to ${adminEmail}`);
            });
        } catch (emailErr) {
            console.error('[ERR] [EMAIL] Could not trigger email:', emailErr.message);
        }
    } catch (error) {
        console.error('\n[ERR] [API] Error saving reservation');
        console.error('[LOC] [API] Error message:', error.message);
        console.error('[LOC] [API] Error stack:', error.stack);
        console.error('[NET] [API] Connection state at error:', mongoose.connection.readyState);
        res.status(400).json({ 
            message: "Error saving reservation", 
            error: error.message,
            mongodb_connection_state: mongoose.connection.readyState
        });
    }
});

// 3. PUT (Update) an existing reservation (Status, Admin Notes, Edits, etc.)
app.put('/api/reservations/:id', async (req, res) => {
    try {
        console.log('\n[REQ] [API] PUT /api/reservations/:id request received');
        console.log('[NET] [API] MongoDB connection state:', mongoose.connection.readyState);
        console.log('[ID] [API] Reservation ID:', req.params.id);
        console.log('[DATA] [API] Update data:', JSON.stringify(req.body).substring(0, 150), '...');
        
        // Validate MongoDB ID format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.warn('[WARN] [API] Invalid MongoDB ID format:', req.params.id);
            return res.status(400).json({ message: "Invalid reservation ID format" });
        }
        
        // Merge update data with existing data (preserve fields not being updated)
        const updateData = req.body;
        console.log('[WAIT] [API] Finding and updating reservation...');
        
        const oldReservation = await Reservation.findById(req.params.id);
        
        const updatedReservation = await Reservation.findByIdAndUpdate(
            req.params.id, 
            { $set: updateData }, // Use $set to update only provided fields
            { new: true, runValidators: false } // Return updated document, don't re-validate on partial updates
        );
        
        if (!updatedReservation) {
            console.warn('[WARN] [API] Reservation not found for ID:', req.params.id);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        // --- NEW: DEDICATED ADMIN REPLY EMAIL NOTIFICATION ---
        if (updateData.adminReply !== undefined && oldReservation && updateData.adminReply !== oldReservation.adminReply && updateData.adminReply.trim() !== '') {
            if (updatedReservation.email) {
                try {
                    const adminEmail = updatedReservation.adminProfile === 'Martine' ? 'mjuillan38@gmail.com' : 'kendanine8@gmail.com';
                    const transporter = transporters[updatedReservation.adminProfile] || transporters['Dani'];
                    
                    const mailOptions = {
                        from: `"Coach ${updatedReservation.adminProfile}" <${adminEmail}>`,
                        to: updatedReservation.email.trim(),
                        subject: `Nouveau message de votre coach / New message from coach [${updatedReservation.resId}]`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 8px;">
                                <h2 style="color: #0dcaf0; border-bottom: 2px solid #0dcaf0; padding-bottom: 10px; margin-top: 0;">Nouveau message / New message</h2>
                                <p style="font-size: 16px;">Bonjour <strong>${updatedReservation.fname}</strong>,</p>
                                <p style="font-size: 16px;">Votre coach <strong>${updatedReservation.adminProfile}</strong> a laissé un message concernant votre réservation (ID: <strong>${updatedReservation.resId}</strong>).</p>
                                <div style="background-color: #f8f9fa; border-left: 4px solid #0dcaf0; padding: 15px; border-radius: 4px; margin: 20px 0;">
                                    <p style="margin: 0; font-size: 16px;"><em>"${updateData.adminReply}"</em></p>
                                </div>
                                <p style="font-size: 16px;">Connectez-vous sur le site pour voir les détails complets de vos réservations.</p>
                                <p style="font-size: 16px;">Merci et à bientôt !</p>
                            </div>
                        `
                    };
                    transporter.sendMail(mailOptions, (err) => {
                        if (err) console.error('[ERR] [EMAIL] Failed to send admin reply email:', err.message);
                        else console.log('[OK] [EMAIL] Admin reply notification sent to:', updatedReservation.email);
                    });
                } catch (emailErr) { console.error('[ERR] [EMAIL] Could not trigger reply email:', emailErr.message); }
            }
        }
        
        // --- STUDENT EMAIL NOTIFICATION LOGIC ---
        if (updateData.status && ['approved', 'rejected'].includes(updateData.status) && updatedReservation.email) {
            try {
                const adminEmail = updatedReservation.adminProfile === 'Martine' ? 'mjuillan38@gmail.com' : 'kendanine8@gmail.com';
                const transporter = transporters[updatedReservation.adminProfile] || transporters['Dani'];
                
                const isApproved = updateData.status === 'approved';
                const statusFr = isApproved ? 'confirmée' : 'refusée';
                const statusEn = isApproved ? 'confirmed' : 'rejected';
                
                const formatTimeFR = (timeStr) => {
                    if (!timeStr || (!timeStr.includes('AM') && !timeStr.includes('PM'))) return timeStr;
                    const [time, modifier] = timeStr.split(' ');
                    let [h, m] = time.split(':');
                    h = parseInt(h, 10);
                    if (modifier === 'PM' && h < 12) h += 12;
                    if (modifier === 'AM' && h === 12) h = 0;
                    return `${h.toString().padStart(2, '0')}h${m}`;
                };

                const slotsListFr = updatedReservation.slots && updatedReservation.slots.length > 0 
                    ? updatedReservation.slots.map(s => {
                        let dayStr = s.day;
                        if (s.fullDate) dayStr = getParisFullDate(s.fullDate, 'fr');
                        else if (dayStr) dayStr = dayStr.replace(/\b\w/g, c => c.toUpperCase());
                        return `<li>${dayStr} à ${formatTimeFR(s.time)}</li>`;
                    }).join('') 
                    : '<li>Aucun créneau spécifique</li>';
                    
                const slotsListEn = updatedReservation.slots && updatedReservation.slots.length > 0 
                    ? updatedReservation.slots.map(s => {
                        let dayStr = s.day;
                        if (s.fullDate) dayStr = getParisFullDate(s.fullDate, 'en');
                        else if (dayStr) dayStr = dayStr.replace(/\b\w/g, c => c.toUpperCase());
                        return `<li>${dayStr} @ ${s.time}</li>`;
                    }).join('') 
                    : '<li>No specific slot</li>';
                    
                const studentLinksHtml = (updatedReservation.studentLinks && updatedReservation.studentLinks.length > 0)
                    ? `<div style="background-color: #e9ecef; padding: 15px; border-radius: 4px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #333; margin-bottom: 10px;">Vos liens utiles / Your useful links:</h4>
                        <ul style="margin-bottom: 0; padding-left: 20px; line-height: 1.5;">
                            ${updatedReservation.studentLinks.map(l => `<li><a href="${l.url}" style="color: #0d6efd; font-weight: bold; text-decoration: none;">${l.name}</a></li>`).join('')}
                        </ul>
                       </div>`
                    : '';
                    
                const coachReplyHtml = updatedReservation.adminReply
                    ? `<div style="background-color: #e0f7fa; border-left: 4px solid #0dcaf0; padding: 15px; border-radius: 4px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #087990; margin-bottom: 10px;">Message du coach / Message from coach:</h4>
                        <p style="margin: 0; font-size: 16px;"><em>"${updatedReservation.adminReply}"</em></p>
                       </div>`
                    : '';

                const clientEmail = updatedReservation.email.trim();
                    
                const mailOptions = {
                    from: `"Reservation ${updatedReservation.adminProfile}" <${adminEmail}>`,
                    to: clientEmail,
                    subject: `Votre réservation a été ${statusFr} / Reservation ${statusEn} [${updatedReservation.resId}]`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 8px;">
                            <h2 style="color: ${isApproved ? '#28a745' : '#dc3545'}; border-bottom: 2px solid ${isApproved ? '#28a745' : '#dc3545'}; padding-bottom: 10px; margin-top: 0;">
                                Réservation ${statusFr.charAt(0).toUpperCase() + statusFr.slice(1)} (ID: ${updatedReservation.resId})
                            </h2>
                            <p style="font-size: 16px;">Bonjour <strong>${updatedReservation.fname}</strong>,</p>
                            <p style="font-size: 16px;">Votre demande de réservation a été <strong style="color: ${isApproved ? '#28a745' : '#dc3545'};">${statusFr}</strong> par <strong>${updatedReservation.adminProfile}</strong>.</p>
                            
                            <div style="background-color: #f8f9fa; border-left: 4px solid ${isApproved ? '#28a745' : '#dc3545'}; padding: 15px; border-radius: 4px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #555; margin-bottom: 10px;">Détails des créneaux :</h4>
                                <ul style="margin-bottom: 15px; padding-left: 20px; line-height: 1.5;">
                                    ${slotsListFr}
                                </ul>
                                <h4 style="margin-top: 0; color: #555; margin-bottom: 10px;">Slot Details:</h4>
                                <ul style="margin-bottom: 0; padding-left: 20px; line-height: 1.5;">
                                    ${slotsListEn}
                                </ul>
                            </div>
                            
                            ${coachReplyHtml}
                            ${studentLinksHtml}
                            <p style="font-size: 16px;">Merci et à bientôt !</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                            <p style="color: #666; font-size: 14px;"><em>Hello <strong>${updatedReservation.fname}</strong>, your booking request has been <strong style="color: ${isApproved ? '#28a745' : '#dc3545'};">${statusEn}</strong> by ${updatedReservation.adminProfile}.</em></p>
                            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px dashed #ccc; font-size: 12px; color: #999; text-align: center;">
                                <p style="margin: 0; margin-bottom: 5px;">Ceci est un message automatique, merci de ne pas y répondre.</p>
                                <p style="margin: 0;">This is an automated message, please do not reply.</p>
                            </div>
                        </div>
                    `
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('[ERR] [EMAIL] Failed to send email to student', clientEmail, ':', error.message);
                    } else {
                        console.log('[OK] [EMAIL] Notification successfully delivered to student:', clientEmail);
                    }
                });
            } catch (emailErr) {
                console.error('[ERR] [EMAIL] Could not trigger student email:', emailErr.message);
            }
        }

        console.log('[OK] [API] Successfully updated reservation');
        console.log('[DATA] [API] Updated fields:', Object.keys(updateData).join(', '));
        res.json(updatedReservation);
    } catch (error) {
        console.error('\n[ERR] [API] Error updating reservation');
        console.error('[LOC] [API] Error message:', error.message);
        console.error('[LOC] [API] Error name:', error.name);
        console.error('[LOC] [API] Error stack:', error.stack);
        console.error('[NET] [API] Connection state at error:', mongoose.connection.readyState);
        res.status(400).json({ 
            message: "Error updating reservation", 
            error: error.message,
            mongodb_connection_state: mongoose.connection.readyState
        });
    }
});

// 5. Update Student Links globally across all reservations
app.put('/api/student-links/:email', verifyAdmin, async (req, res) => {
    try {
        console.log('\n[REQ] [API] PUT /api/student-links/:email request received');
        const { email } = req.params;
        const { links, notifyStudent, adminProfile } = req.body;
        const targetProfile = req.adminProfile || adminProfile; // Securely get the active coach from their token
        await Reservation.updateMany({ email: email, adminProfile: targetProfile }, { $set: { studentLinks: links } });
        
        // Automatically notify student if a NEW link was added
        if (notifyStudent && targetProfile) {
            const transporter = transporters[targetProfile] || transporters['Dani'];
            const adminEmail = targetProfile === 'Martine' ? 'mjuillan38@gmail.com' : 'kendanine8@gmail.com';
            const linksHtml = links.map(l => `<li><a href="${l.url}" style="color: #0d6efd; font-weight: bold; text-decoration: none;">${l.name}</a></li>`).join('');
            
            const mailOptions = {
                from: `"Réservation ${targetProfile}" <${adminEmail}>`,
                to: email,
                subject: `Nouveau lien ajouté à votre profil / New link added`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 8px;">
                        <h2 style="color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-top: 0;">Nouveau lien disponible</h2>
                        <p style="font-size: 16px;">Bonjour,</p>
                        <p style="font-size: 16px;"><strong>${targetProfile}</strong> a ajouté de nouveaux liens utiles sur votre profil étudiant.</p>
                        
                        <div style="background-color: #f8f9fa; border-left: 4px solid #0d6efd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #555; margin-bottom: 10px;">Vos liens actuels / Your current links:</h4>
                            <ul style="margin-bottom: 0; padding-left: 20px; line-height: 1.5;">
                                ${linksHtml}
                            </ul>
                        </div>
                        
                        <p style="font-size: 16px;">Ces liens seront inclus dans toutes vos futures confirmations de réservation.</p>
                        <p style="font-size: 16px;">Merci et à bientôt !</p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions, (error) => {
                if (error) console.error('[ERR] [EMAIL] Failed to send link update to', email, ':', error.message);
                else console.log('[OK] [EMAIL] Link update notification sent to', email);
            });
        }
        res.json({ message: "Links updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Get all clients (Permanent Client Database)
app.get('/api/clients', verifyAdmin, async (req, res) => {
    try {
        console.log('\n[REQ] [API] GET /api/clients request received');
        const filter = req.adminProfile ? { adminProfile: req.adminProfile } : {};
        const clients = await Client.find(filter).sort({ lastActive: -1 });
        console.log('[OK] [API] Successfully fetched', clients.length, 'clients');
        res.json(clients);
    } catch (error) {
        console.error('[ERR] [API] Error fetching clients:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 7. Send Summary via Email
app.post('/api/send-summary', verifyAdmin, async (req, res) => {
    try {
        console.log('\n[REQ] [API] POST /api/send-summary request received');
        const { targetEmail, month, htmlContent, adminProfile } = req.body;
        const activeProfile = req.adminProfile || adminProfile;
        const transporter = transporters[activeProfile] || transporters['Dani'];
        const adminEmail = activeProfile === 'Martine' ? 'mjuillan38@gmail.com' : 'kendanine8@gmail.com';
        
        // Strip classes that hide content in email clients so the layout renders perfectly
        const cleanHtml = htmlContent.replace(/d-none/g, '').replace(/d-print-block/g, '');

        const mailOptions = {
            from: `"Coach ${activeProfile}" <${adminEmail}>`,
            to: targetEmail,
            subject: `Résumé de vos cours - ${month} / Class Summary`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
                    <p>Bonjour,</p>
                    <p>Veuillez trouver ci-dessous le résumé de vos cours pour la période de <strong>${month}</strong> avec <strong>${activeProfile}</strong>.</p>
                    <div style="border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin-top: 20px; background-color: #f8f9fa;">
                        ${cleanHtml}
                    </div>
                    <p style="margin-top: 30px; font-size: 12px; color: #888; text-align: center;">Ceci est un message automatique, merci de ne pas y répondre.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) return res.status(500).json({ error: error.message });
            console.log('[OK] [EMAIL] Summary sent to', targetEmail);
            res.json({ message: "Email sent successfully" });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Auth / Verification Endpoints
app.post('/api/auth/request-code', async (req, res) => {
    try {
        const { email, adminProfile } = req.body;
        if (!email || !adminProfile) return res.status(400).json({ error: "Missing fields" });
        
        let client = await Client.findOne({ email, adminProfile });
        if (client && client.verified) return res.json({ verified: true });
        
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60000); // 15 mins
        
        if (!client) client = new Client({ email, adminProfile, verified: false });
        client.verificationCode = code;
        client.codeExpires = codeExpires;
        await client.save();
        
        const transporter = transporters[adminProfile] || transporters['Dani'];
        const adminEmail = adminProfile === 'Martine' ? 'mjuillan38@gmail.com' : 'kendanine8@gmail.com';
        
        const mailOptions = {
            from: `"Coach ${adminProfile}" <${adminEmail}>`,
            to: email,
            subject: `Code de vérification / Verification Code: ${code}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                    <h2 style="color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-top: 0;">Vérification de votre Email</h2>
                    <p style="font-size: 16px;">Bonjour,</p><p style="font-size: 16px;">Veuillez utiliser le code suivant pour vérifier votre adresse email sur le profil de <strong>${adminProfile}</strong> :</p>
                    <div style="font-size: 28px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px; letter-spacing: 8px; color: #333;">${code}</div>
                    <p style="font-size: 14px; color: #666;">Ce code expirera dans 15 minutes.</p></div>`
        };
        
        transporter.sendMail(mailOptions, (error) => {
            if (error) return res.status(500).json({ error: "Failed to send email" });
            res.json({ verified: false, message: "Code sent" });
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/verify-code', async (req, res) => {
    try {
        const { email, adminProfile, code } = req.body;
        const client = await Client.findOne({ email, adminProfile });
        if (!client) return res.status(404).json({ error: "Client not found" });
        if (client.verified) return res.json({ success: true });
        if (client.verificationCode !== code || new Date() > client.codeExpires) return res.status(400).json({ error: "Code invalide ou expiré / Invalid or expired code" });
        client.verified = true; client.verificationCode = ''; client.codeExpires = null;
        await client.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware to Verify Admin Token
function verifyAdmin(req, res, next) {
    console.log('\n[AUTH] [MIDDLEWARE] Token verification requested');
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        console.log('[ERR] [MIDDLEWARE] No token provided');
        return res.status(403).json({ message: 'No token provided' });
    }
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.log('[ERR] [MIDDLEWARE] Token verification failed:', err.message);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (decoded.role !== 'admin') {
            console.log('[ERR] [MIDDLEWARE] User is not admin, role:', decoded.role);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        console.log('[OK] [MIDDLEWARE] Token verified successfully for admin:', decoded.adminProfile);
        req.adminProfile = decoded.adminProfile; // 👈 NEW: Store admin profile in request
        next();
    });
};

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('\n[ERR] [GLOBAL-ERROR] Unhandled error caught');
    console.error('[LOC] [GLOBAL-ERROR] Error message:', err.message);
    console.error('[LOC] [GLOBAL-ERROR] Error stack:', err.stack);
    console.error('[NET] [GLOBAL-ERROR] MongoDB connection state:', mongoose.connection.readyState);
    res.status(500).json({
        message: 'Internal server error',
        error: err.message,
        mongodb_connected: mongoose.connection.readyState === 1
    });
});

// 4. DELETE a reservation
app.delete('/api/reservations/:id', verifyAdmin, async (req, res) => {
    try {
        console.log('\n[REQ] [API] DELETE /api/reservations/:id request received');
        console.log('[NET] [API] MongoDB connection state:', mongoose.connection.readyState);
        console.log('[ID] [API] Reservation ID:', req.params.id);
        
        const deletedReservation = await Reservation.findByIdAndDelete(req.params.id);
        if (!deletedReservation) {
            console.warn('[WARN] [API] Reservation not found for deletion, ID:', req.params.id);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        console.log('[OK] [API] Successfully deleted reservation:', req.params.id);
        res.json({ message: "Reservation deleted successfully" });
    } catch (error) {
        console.error('\n[ERR] [API] Error deleting reservation');
        console.error('[LOC] [API] Error message:', error.message);
        console.error('[LOC] [API] Error stack:', error.stack);
        console.error('[NET] [API] Connection state at error:', mongoose.connection.readyState);
        res.status(500).json({ 
            message: "Error deleting reservation", 
            error: error.message,
            mongodb_connection_state: mongoose.connection.readyState
        });
    }
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const mongoStateNames = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    console.log('\n[REQ] [HEALTH] Health check requested');
    console.log(`[NET] [HEALTH] MongoDB state: ${mongoStateNames[mongoState]} (${mongoState})`);
    
    res.json({
        status: 'ok',
        server: 'running',
        mongodb_connected: mongoState === 1,
        mongodb_state: mongoStateNames[mongoState],
        mongodb_state_code: mongoState,
        timestamp: new Date().toISOString()
    });
});

// Stats/Summary Endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const { adminProfile } = req.query; // Get admin profile from query params
        console.log('\n[REQ] [API] GET /api/stats request received');
        console.log('[USER] [API] Admin Profile:', adminProfile);
        
        // Build filter based on adminProfile
        const filter = adminProfile ? { adminProfile } : {};
        
        const reservations = await Reservation.find(filter);
        
        const stats = {
            total: reservations.length,
            pending: reservations.filter(r => r.status === 'pending').length,
            approved: reservations.filter(r => r.status === 'approved').length,
            rejected: reservations.filter(r => r.status === 'rejected').length,
            cancelled: reservations.filter(r => r.status === 'cancelled').length,
            blocked: reservations.filter(r => r.status === 'blocked').length,
            oneTime: reservations.filter(r => r.recurring === 'one-time').length,
            weekly: reservations.filter(r => r.recurring === 'weekly').length
        };
        
        console.log('[OK] [API] Stats calculated for profile', adminProfile || 'all', ':', JSON.stringify(stats));
        res.json(stats);
    } catch (error) {
        console.error('[ERR] [API] Error calculating stats:', error.message);
        res.status(500).json({ message: "Error calculating stats", error: error.message });
    }
});

// Bulk Fetch by Query - Advanced filtering
app.get('/api/reservations-by-email/:email', async (req, res) => {
    try {
        const { adminProfile } = req.query;
        console.log('\n[REQ] [API] GET /api/reservations-by-email/:email request for:', req.params.email);
        console.log('[USER] [API] Admin Profile:', adminProfile);
        
        const filter = { email: req.params.email };
        if (adminProfile) filter.adminProfile = adminProfile;
        
        const reservations = await Reservation.find(filter).sort({ createdAt: -1 });
        console.log('[OK] [API] Found', reservations.length, 'reservations for email');
        res.json(reservations);
    } catch (error) {
        console.error('[ERR] [API] Error fetching by email:', error.message);
        res.status(500).json({ message: "Error fetching reservations", error: error.message });
    }
});

app.get('/api/reservations-by-phone/:phone', async (req, res) => {
    try {
        const { adminProfile } = req.query;
        console.log('\n[REQ] [API] GET /api/reservations-by-phone/:phone request for:', req.params.phone);
        console.log('[USER] [API] Admin Profile:', adminProfile);
        
        const filter = { phone: req.params.phone };
        if (adminProfile) filter.adminProfile = adminProfile;
        
        const reservations = await Reservation.find(filter).sort({ createdAt: -1 });
        console.log('[OK] [API] Found', reservations.length, 'reservations for phone');
        res.json(reservations);
    } catch (error) {
        console.error('[ERR] [API] Error fetching by phone:', error.message);
        res.status(500).json({ message: "Error fetching reservations", error: error.message });
    }
});

// Get single reservation by ID
app.get('/api/reservations/:id', async (req, res) => {
    try {
        const { adminProfile } = req.query;
        console.log('\n[REQ] [API] GET /api/reservations/:id request for ID:', req.params.id);
        console.log('[USER] [API] Admin Profile:', adminProfile);
        
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid reservation ID format" });
        }
        
        const filter = { _id: req.params.id };
        if (adminProfile) filter.adminProfile = adminProfile;
        
        const reservation = await Reservation.findOne(filter);
        if (!reservation) {
            console.warn('[WARN] [API] Reservation not found for ID:', req.params.id);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        console.log('[OK] [API] Found reservation');
        res.json(reservation);
    } catch (error) {
        console.error('[ERR] [API] Error fetching reservation:', error.message);
        res.status(500).json({ message: "Error fetching reservation", error: error.message });
    }
});

// Export the Express app as a Firebase Cloud Function
exports.api = functions.https.onRequest(app);
