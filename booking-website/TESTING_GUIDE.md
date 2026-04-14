# Testing Guide - Multi-Admin Booking System

## Quick Start

```bash
# Terminal 1: Start Backend Server
cd booking-website/backend
npm install  # (if not already done)
node server.js

# Terminal 2: Open Website
# Navigate to http://localhost:3000/
```

---

## Application Flow

### 1. LANDING PAGE (Profile Selection)
**What you see:**
- Two profile circles: **Martine** 💪 and **Dani** 🎯
- **🔐 Admin** button in the top-right corner
- Language selector in the top-right

**What to do:**
- Click on either Martine or Dani to select the coach

---

### 2. PROFILE SELECTED → Role Selection Modal
**What you see:**
- Two buttons: "Réservation Invité" (Guest Booking) and "Administrateur" (Admin)

**What to do:**
- Click "Réservation Invité" to make a booking

---

### 3. GUEST LOGIN (Email / French Phone)
**What you see:**
- Input field: "Email ou Numéro de téléphone"
- Continue button

**Valid Formats:**
✅ Email: `your.email@example.com`
✅ French Phone: 
  - `06 12 34 56 78` (with spaces)
  - `0612345678` (no spaces)
  - `+33 6 12 34 56 78` (with +33 prefix)
  - `+336 12 34 56 78` (alternative format)

❌ Invalid:
  - `hello` (no format)
  - `123456` (incomplete phone)
  - `@example.com` (incomplete email)

**What to do:**
- Enter a valid email or French phone number
- Click "Continuer"

---

### 4. GUEST BOOKING INTERFACE
**What you see:**
- Calendar with available time slots
- Your profile name in navbar (Martine Juillan or Dani Coach)
- "Connexion Administrateur" button in navbar
- "Déconnexion" button to logout

**What to do:**
- Click on green slots to select time slots
- Click "Book" to make a reservation
- The reservation is tied to the selected profile (Martine or Dani)

---

### 5. ADMIN LOGIN (From Profile or Guest View)
**Access methods:**
1. From Profile Selector: Click **🔐 Admin** button (top-right)
2. From Guest View: Click **"Connexion Administrateur"** button (navbar)

**What you see:**
- Login form with fields:
  - Username
  - Password

**Admin Credentials:**
```
MARTINE:
- Username: Martine
- Password: Mimi33

DANI:
- Username: Dani
- Password: Dandan33
```

**What to do:**
- Enter credentials for Martine or Dani
- Click "Se connecter"

---

### 6. ADMIN DASHBOARD
**What you see:**
- "Tableau de bord Admin" (Admin Dashboard)
- Filter options: Temporary (One-time) / Permanent (Weekly)
- Search bar to find bookings by name/email
- Current week filter checkbox
- Left panel: Pending/Active reservations
- Right panel: Calendar with color-coded reservations
- Buttons:
  - **"Changer de profil"** - Switch to different admin
  - **"Bloquer un créneau"** - Block time slots
  - **"Déconnexion"** - Logout & go back to profile selector

**Important:** 
- Martine only sees reservations created for Martine
- Dani only sees reservations created for Dani
- NO data sharing between the two profiles

**What to do:**
- Click on reservations to view, edit, or approve/reject
- Click "Changer de profil" to switch to Dani (or vice versa)
- Logout returns to profile selector

---

## Test Scenarios

### Scenario 1: Complete Booking Workflow
1. ✅ Open website → See profile selector
2. ✅ Click Martine
3. ✅ Click "Réservation Invité"
4. ✅ Enter email: `test@example.com`
5. ✅ Click time slots to select
6. ✅ Click "Réserver" to book

### Scenario 2: Admin Verification
1. ✅ From guest view, click "Connexion Administrateur"
2. ✅ Login as Martine (Mimi33)
3. ✅ Verify you see the reservation you just made
4. ✅ Click "Changer de profil"
5. ✅ Back to profile selector
6. ✅ Select Dani
7. ✅ Login as Dani (Dandan33)
8. ✅ Verify Dani sees NO reservations from Martine's profile

### Scenario 3: Phone Number Validation
1. ✅ Open website → Profile selector
2. ✅ Select Dani
3. ✅ Click "Réservation Invité"
4. ✅ Test invalid phone: `123` → Should show error
5. ✅ Test valid phone: `06 12 34 56 78` → Should accept
6. ✅ Continue booking

### Scenario 4: Multi-Profile Independence
1. ✅ Book with Martine (email: `martine@test.com`)
2. ✅ Login to Martine admin → See booking
3. ✅ Logout & Select Dani profile
4. ✅ Book with Dani (email: `dani@test.com`)
5. ✅ Login to Dani admin → See ONLY Dani's booking
6. ✅ Switch back to Martine admin → See ONLY Martine's booking

---

## Expected Behavior Checklist

- [x] Profile selector appears first with both coaches
- [x] Admin login button visible on profile selector
- [x] Selecting profile shows role modal (Guest/Admin)
- [x] Guest login requires valid email or French phone
- [x] Reservations are tied to selected profile (Martine/Dani)
- [x] Admin can only see their own reservations
- [x] Admin login works from both profile selector and guest navbar
- [x] "Change Profile" button returns to profile selector
- [x] Language selector works on profile page
- [x] No data sharing between Martine and Dani profiles

---

## Troubleshooting

**Issue:** Server won't start
- Check MongoDB connection in `.env`
- Verify Node.js is installed: `node --version`
- Install dependencies: `npm install` in `/backend`

**Issue:** Reservations not showing in admin
- Verify you logged in with correct admin credentials
- Check that the reservation was created for this profile
- Refresh the page

**Issue:** Phone validation failing
- Must be a valid French phone number
- Accepted formats: `06 XX XX XX XX`, `+33 6 XX XX XX XX`, `0612345678`
- Try with email instead: `user@example.com`

**Issue:** Images not showing in profile selector
- Verify `img/Martine.jpeg` and `img/Dani.jpeg` exist
- Check browser console for 404 errors

---

## Files Modified

```
backend/
  └── server.js (Multi-admin system with profile filtering)

frontend/
  ├── profileSelector.js (Profile selection with admin login button)
  ├── auth.js (Guest phone/email validation + Admin login)
  ├── guest.js (Attach adminProfile to reservations)
  ├── main.js (Filter reservations by profile)
  └── admin.js (Display profile-specific reservations)

index.html (Admin button on profile selector)
```

---

## API Endpoints

All endpoints support `adminProfile` query parameter:

```
GET    /api/reservations?adminProfile=Martine
POST   /api/reservations (with adminProfile field)
PUT    /api/reservations/:id (updates only if belongs to admin)
DELETE /api/reservations/:id (requires auth)
GET    /api/stats?adminProfile=Dani
```

---

**Good luck testing! Let me know if you encounter any issues.** 🚀
