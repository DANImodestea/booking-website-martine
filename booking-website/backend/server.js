const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const app = express();

const SECRET_KEY = process.env.JWT_SECRET || 'martine_super_secret_key_2026';

// Middleware
console.log('⚙️  [STARTUP] Setting up CORS middleware');
app.use(cors()); // Allows frontend to make requests to this backend
console.log('⚙️  [STARTUP] Setting up JSON middleware');
app.use(express.json()); // Allows backend to understand JSON data

// Serve Frontend Static Files
console.log('⚙️  [STARTUP] Serving frontend static files from:', path.join(__dirname, '../frontend'));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
    console.log('\n📄 [API] GET / request received');
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Silence favicon missing errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Connect to MongoDB
console.log('\n🔍 [STARTUP] Starting MongoDB connection process...');
const DB_URI = process.env.MONGO_URI || 'mongodb://kendanine8_db_user:Z2nf3DiWPb04dDHb@cluster0.svjjckc.mongodb.net:27017/bookingApp?retryWrites=true&w=majority';
console.log('📝 [STARTUP] DB_URI configured:', DB_URI.substring(0, 50) + '...');

mongoose.connect(DB_URI, {
    family: 4, // 👈 FORCES IPv4: Bypasses the "querySrv ECONNREFUSED" network bug entirely!
    serverSelectionTimeoutMS: 30000, // Increased from 10000
    socketTimeoutMS: 45000,
    retryWrites: true,
    authSource: 'admin'
})
    .then(() => {
        console.log('✅ [MONGODB] Connected to MongoDB Database successfully!');
        console.log('🔗 [MONGODB] Connection state:', mongoose.connection.readyState);
    })
    .catch(err => {
        console.error('❌ [MONGODB] MongoDB connection error:', err.message);
        console.error('❌ [MONGODB] Full error stack:', err.stack);
        console.error('❌ [MONGODB] Connection code:', err.code);
        if (err.message.includes('querySrv ECONNREFUSED')) {
            console.log('\n👉 TIP: Your internet provider or router is blocking MongoDB SRV DNS lookups.\n👉 FIX: Change your computer DNS to 8.8.8.8 (Google DNS) OR use the legacy connection string from your Atlas dashboard.\n');
        }
    });

// MongoDB Connection Event Listeners for Detailed Debugging
mongoose.connection.on('connecting', () => console.log('⏳ [MONGODB] Attempting to connect...'));
mongoose.connection.on('connected', () => console.log('✅ [MONGODB] Connected!'));
mongoose.connection.on('error', (err) => console.error('❌ [MONGODB] Error event:', err.message, '\nFull error:', err));
mongoose.connection.on('disconnecting', () => console.log('⚠️  [MONGODB] Disconnecting...'));
mongoose.connection.on('disconnected', () => console.log('⛔ [MONGODB] Disconnected from MongoDB!'));
mongoose.connection.on('reconnected', () => console.log('🔄 [MONGODB] Reconnected after disconnection!'));
mongoose.connection.on('reconnectFailed', (err) => console.error('❌ [MONGODB] Reconnection failed:', err.message));

// Define the Reservation Database Schema
const reservationSchema = new mongoose.Schema({
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    message: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    recurring: { type: String, default: 'one-time' },
    status: { type: String, default: 'pending' },
    startDate: { type: String, default: null },
    startTime: { type: String, default: null },
    endDate: { type: String, default: null },
    endTime: { type: String, default: null },
    slots: [{
        day: String,
        time: String,
        fullDate: String
    }],
    createdAt: { type: Date, default: Date.now }
});

const Reservation = mongoose.model('Reservation', reservationSchema);

// --- AUTOMATED WEEKLY CLEANUP (Runs every Sunday at 23:59) ---
cron.schedule('59 23 * * 0', async () => {
    console.log('\n🧹 [CRON] Weekly cleanup task started');
    console.log('🔗 [CRON] MongoDB connection state:', mongoose.connection.readyState);
    
    try {
        console.log('⏳ [CRON] Fetching all reservations...');
        const reservations = await Reservation.find();
        console.log('✅ [CRON] Fetched', reservations.length, 'total reservations');
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        oneWeekAgo.setHours(0, 0, 0, 0);

        let toDeleteIds = [];
        
        reservations.forEach(res => {
            let latestDate = new Date(res.createdAt);
            if (res.endDate) {
                latestDate = new Date(res.endDate);
            } else if (res.slots && res.slots.length > 0) {
                const slotDates = res.slots.map(s => new Date(s.fullDate).getTime());
                latestDate = new Date(Math.max(...slotDates));
            } else if (res.startDate) {
                latestDate = new Date(res.startDate);
            }

            if (latestDate.getTime() < oneWeekAgo.getTime()) {
                toDeleteIds.push(res._id);
            }
        });

        if (toDeleteIds.length > 0) {
            console.log('🗑️  [CRON] Deleting', toDeleteIds.length, 'old reservations...');
            const result = await Reservation.deleteMany({ _id: { $in: toDeleteIds } });
            console.log(`✅ [CRON] Auto-cleanup complete: Erased ${result.deletedCount} old reservations from the server.`);
        } else {
            console.log('✅ [CRON] No old reservations to delete');
        }
    } catch (err) {
        console.error('❌ [CRON] Cleanup error:', err.message);
        console.error('📍 [CRON] Error stack:', err.stack);
        console.error('🔗 [CRON] Connection state at error:', mongoose.connection.readyState);
    }
});

// --- API ROUTES ---

// 0. Admin Login (JWT Generation)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\n🔐 [API] Login attempt for username: "${username}"`);
    
    if (username === 'Martine' && password === 'Mimi33') {
        console.log(`✅ [API] Login successful for Admin`);
        const token = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token });
    } else {
        console.log(`❌ [API] Login failed (Invalid credentials for username: "${username}")`);
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// 1. GET all reservations
app.get('/api/reservations', async (req, res) => {
    try {
        console.log('\n📊 [API] GET /api/reservations request received');
        console.log('🔗 [API] MongoDB connection state:', mongoose.connection.readyState, '(0=disconnected, 1=connected, 2=connecting, 3=disconnecting)');
        
        if (mongoose.connection.readyState !== 1) {
            console.warn('⚠️  [API] WARNING: Not connected to MongoDB!');
        }
        
        console.log('⏳ [API] Querying Reservation.find()...');
        const reservations = await Reservation.find().sort({ createdAt: 1 });
        console.log('✅ [API] Successfully fetched', reservations.length, 'reservations');
        res.json(reservations);
    } catch (error) {
        console.error('\n❌ [API] Failed to fetch reservations from MongoDB');
        console.error('📍 [API] Error message:', error.message);
        console.error('📍 [API] Error code:', error.code);
        console.error('📍 [API] Error stack:', error.stack);
        console.error('🔗 [API] Connection state at error:', mongoose.connection.readyState);
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
        console.log('\n📝 [API] POST /api/reservations request received');
        console.log('🔗 [API] MongoDB connection state:', mongoose.connection.readyState);
        console.log('📦 [API] Request body:', JSON.stringify(req.body).substring(0, 100), '...');
        
        const newReservation = new Reservation(req.body);
        console.log('⏳ [API] Saving reservation to MongoDB...');
        const savedReservation = await newReservation.save();
        console.log('✅ [API] Successfully saved reservation with ID:', savedReservation._id);
        res.status(201).json(savedReservation);
    } catch (error) {
        console.error('\n❌ [API] Error saving reservation');
        console.error('📍 [API] Error message:', error.message);
        console.error('📍 [API] Error stack:', error.stack);
        console.error('🔗 [API] Connection state at error:', mongoose.connection.readyState);
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
        console.log('\n✏️  [API] PUT /api/reservations/:id request received');
        console.log('🔗 [API] MongoDB connection state:', mongoose.connection.readyState);
        console.log('🆔 [API] Reservation ID:', req.params.id);
        console.log('📦 [API] Update data:', JSON.stringify(req.body).substring(0, 150), '...');
        
        // Validate MongoDB ID format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.warn('⚠️  [API] Invalid MongoDB ID format:', req.params.id);
            return res.status(400).json({ message: "Invalid reservation ID format" });
        }
        
        // Merge update data with existing data (preserve fields not being updated)
        const updateData = req.body;
        console.log('⏳ [API] Finding and updating reservation...');
        
        const updatedReservation = await Reservation.findByIdAndUpdate(
            req.params.id, 
            { $set: updateData }, // Use $set to update only provided fields
            { new: true, runValidators: false } // Return updated document, don't re-validate on partial updates
        );
        
        if (!updatedReservation) {
            console.warn('⚠️  [API] Reservation not found for ID:', req.params.id);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        console.log('✅ [API] Successfully updated reservation');
        console.log('📦 [API] Updated fields:', Object.keys(updateData).join(', '));
        res.json(updatedReservation);
    } catch (error) {
        console.error('\n❌ [API] Error updating reservation');
        console.error('📍 [API] Error message:', error.message);
        console.error('📍 [API] Error name:', error.name);
        console.error('📍 [API] Error stack:', error.stack);
        console.error('🔗 [API] Connection state at error:', mongoose.connection.readyState);
        res.status(400).json({ 
            message: "Error updating reservation", 
            error: error.message,
            mongodb_connection_state: mongoose.connection.readyState
        });
    }
});

// Middleware to Verify Admin Token
const verifyAdmin = (req, res, next) => {
    console.log('\n🔐 [MIDDLEWARE] Token verification requested');
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        console.log('❌ [MIDDLEWARE] No token provided');
        return res.status(403).json({ message: 'No token provided' });
    }
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.log('❌ [MIDDLEWARE] Token verification failed:', err.message);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (decoded.role !== 'admin') {
            console.log('❌ [MIDDLEWARE] User is not admin, role:', decoded.role);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        console.log('✅ [MIDDLEWARE] Token verified successfully');
        next();
    });
};

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('\n❌ [GLOBAL-ERROR] Unhandled error caught');
    console.error('📍 [GLOBAL-ERROR] Error message:', err.message);
    console.error('📍 [GLOBAL-ERROR] Error stack:', err.stack);
    console.error('🔗 [GLOBAL-ERROR] MongoDB connection state:', mongoose.connection.readyState);
    res.status(500).json({
        message: 'Internal server error',
        error: err.message,
        mongodb_connected: mongoose.connection.readyState === 1
    });
});

// 4. DELETE a reservation
app.delete('/api/reservations/:id', verifyAdmin, async (req, res) => {
    try {
        console.log('\n🗑️  [API] DELETE /api/reservations/:id request received');
        console.log('🔗 [API] MongoDB connection state:', mongoose.connection.readyState);
        console.log('🆔 [API] Reservation ID:', req.params.id);
        
        const deletedReservation = await Reservation.findByIdAndDelete(req.params.id);
        if (!deletedReservation) {
            console.warn('⚠️  [API] Reservation not found for deletion, ID:', req.params.id);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        console.log('✅ [API] Successfully deleted reservation:', req.params.id);
        res.json({ message: "Reservation deleted successfully" });
    } catch (error) {
        console.error('\n❌ [API] Error deleting reservation');
        console.error('📍 [API] Error message:', error.message);
        console.error('📍 [API] Error stack:', error.stack);
        console.error('🔗 [API] Connection state at error:', mongoose.connection.readyState);
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
    console.log('\n🏥 [HEALTH] Health check requested');
    console.log(`🔗 [HEALTH] MongoDB state: ${mongoStateNames[mongoState]} (${mongoState})`);
    
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
        console.log('\n📈 [API] GET /api/stats request received');
        const reservations = await Reservation.find();
        
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
        
        console.log('✅ [API] Stats calculated:', JSON.stringify(stats));
        res.json(stats);
    } catch (error) {
        console.error('❌ [API] Error calculating stats:', error.message);
        res.status(500).json({ message: "Error calculating stats", error: error.message });
    }
});

// Bulk Fetch by Query - Advanced filtering
app.get('/api/reservations-by-email/:email', async (req, res) => {
    try {
        console.log('\n🔍 [API] GET /api/reservations-by-email/:email request for:', req.params.email);
        const reservations = await Reservation.find({ email: req.params.email }).sort({ createdAt: -1 });
        console.log('✅ [API] Found', reservations.length, 'reservations for email');
        res.json(reservations);
    } catch (error) {
        console.error('❌ [API] Error fetching by email:', error.message);
        res.status(500).json({ message: "Error fetching reservations", error: error.message });
    }
});

app.get('/api/reservations-by-phone/:phone', async (req, res) => {
    try {
        console.log('\n🔍 [API] GET /api/reservations-by-phone/:phone request for:', req.params.phone);
        const reservations = await Reservation.find({ phone: req.params.phone }).sort({ createdAt: -1 });
        console.log('✅ [API] Found', reservations.length, 'reservations for phone');
        res.json(reservations);
    } catch (error) {
        console.error('❌ [API] Error fetching by phone:', error.message);
        res.status(500).json({ message: "Error fetching reservations", error: error.message });
    }
});

// Get single reservation by ID
app.get('/api/reservations/:id', async (req, res) => {
    try {
        console.log('\n📄 [API] GET /api/reservations/:id request for ID:', req.params.id);
        
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid reservation ID format" });
        }
        
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) {
            console.warn('⚠️  [API] Reservation not found for ID:', req.params.id);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        console.log('✅ [API] Found reservation');
        res.json(reservation);
    } catch (error) {
        console.error('❌ [API] Error fetching reservation:', error.message);
        res.status(500).json({ message: "Error fetching reservation", error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 [STARTUP] Backend Server running on http://localhost:${PORT}`);
    console.log(`⏰ [STARTUP] Server started at ${new Date().toISOString()}`);
    console.log(`🔗 [STARTUP] Current MongoDB connection state: ${mongoose.connection.readyState}`);
    console.log(`✅ [STARTUP] Server is ready to accept requests\n`);
});