// ============================================
// PROFILE SELECTOR MODULE
// Handles selection of Martine or Dani
// ============================================

window.selectedAdminProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[MODULE] [PROFILE] Profile selector module loaded');
    
    // Always show profile selector first - clear any previous session data
    localStorage.removeItem('selectedAdminProfile');
    window.selectedAdminProfile = null;
    
    // Show profile modal and hide role modal
    const profileModal = document.getElementById('profile-modal');
    const roleModal = document.getElementById('role-modal');
    if (profileModal) profileModal.style.display = 'flex';
    if (roleModal) roleModal.style.display = 'none';
    
    console.log('[WAIT] [PROFILE] Waiting for profile selection...');
    setupProfileSelection();
});

// Setup profile selection listeners
function setupProfileSelection() {
    const profileMartineBtn = document.getElementById('profile-martine');
    const profileDaniBtn = document.getElementById('profile-dani');
    
    if (profileMartineBtn) {
        profileMartineBtn.addEventListener('click', () => selectProfile('Martine'));
    }
    
    if (profileDaniBtn) {
        profileDaniBtn.addEventListener('click', () => selectProfile('Dani'));
    }
    
    // Back button from role modal
    const backFromRoleBtn = document.getElementById('btn-back-from-role');
    if (backFromRoleBtn) {
        backFromRoleBtn.addEventListener('click', () => {
            console.log('[BACK] [PROFILE] Going back to profile selector');
            localStorage.removeItem('selectedAdminProfile');
            window.selectedAdminProfile = null;
            
            const roleModal = document.getElementById('role-modal');
            const profileModal = document.getElementById('profile-modal');
            
            if (roleModal) roleModal.style.display = 'none';
            if (profileModal) profileModal.style.display = 'flex';
        });
    }
    
    // Setup CV Modals Listeners
    const cvMartineBtn = document.getElementById('btn-martine-cv');
    if (cvMartineBtn) {
        cvMartineBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('cv-modal-martine').style.display = 'flex';
        });
    }

    const cvDaniBtn = document.getElementById('btn-dani-cv');
    if (cvDaniBtn) {
        cvDaniBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('cv-modal-dani').style.display = 'flex';
        });
    }

    // Setup Share functionality for CVs
    document.querySelectorAll('.share-btn').forEach(btn => {
        if (btn.dataset.listenerAttached) return;
        btn.dataset.listenerAttached = 'true';
        btn.addEventListener('click', async (e) => {
            const url = e.target.getAttribute('data-url');
            if (navigator.share) {
                try { await navigator.share({ title: 'Profil & CV', url: url }); }
                catch (err) { console.log('Share canceled or failed', err); }
            } else {
                navigator.clipboard.writeText(url).then(() => alert('Lien copié dans le presse-papiers !'))
                .catch(err => console.error('Could not copy text: ', err));
            }
        });
    });

    window.addEventListener('click', (e) => {
        const modalMartine = document.getElementById('cv-modal-martine');
        const modalDani = document.getElementById('cv-modal-dani');
        if (e.target === modalMartine) modalMartine.style.display = 'none';
        if (e.target === modalDani) modalDani.style.display = 'none';
    });
}

// Select profile and proceed
function selectProfile(profileName) {
    console.log('[TARGET] [PROFILE] Profile selected:', profileName);
    window.selectedAdminProfile = profileName;
    localStorage.setItem('selectedAdminProfile', profileName);
    
    // Update UI with selected profile
    updateUIWithProfile(profileName);
    
    // Update admin title
    const adminTitle = document.getElementById('admin-title');
    if (adminTitle) {
        adminTitle.innerHTML = `${profileName} - <span data-i18n="adminDashboard">${window.t('adminDashboard')}</span>`;
    }
    
    console.log('[OK] [PROFILE] Saving profile to localStorage');
    hideProfileModal();
    
    // Instantly fetch and isolate the reservations strictly for the selected profile
    if (typeof window.fetchReservations === 'function') window.fetchReservations();
}

// Update UI based on selected profile
function updateUIWithProfile(profileName) {
    const guestNavName = document.getElementById('guest-nav-name');
    const guestNavImg = document.getElementById('guest-nav-img');
    const adminNavImg = document.getElementById('admin-nav-img');
    const navLinkedIn = document.getElementById('nav-linkedin');
    const navEmailLink = document.getElementById('nav-email-link');
    const navEmailText = document.getElementById('nav-email-text');
    const navPhoneLink = document.getElementById('nav-phone-link');
    const navPhoneText = document.getElementById('nav-phone-text');
    const navAvailText = document.getElementById('nav-avail-text');

    if (profileName === 'Martine') {
        if (guestNavName) guestNavName.textContent = 'Martine Juillan';
        if (guestNavImg) guestNavImg.src = 'img/Martine.jpeg';
        if (adminNavImg) adminNavImg.src = 'img/Martine.jpeg';
        if (navLinkedIn) navLinkedIn.href = 'https://www.linkedin.com/in/martine-juillan/';
        if (navEmailLink) navEmailLink.href = 'mailto:mjuillan38@gmail.com';
        if (navEmailText) navEmailText.textContent = 'mjuillan38@gmail.com';
        if (navPhoneLink) navPhoneLink.href = 'tel:+33676100223';
        if (navPhoneText) navPhoneText.textContent = '06 76 10 02 23';
        if (navAvailText) navAvailText.setAttribute('data-i18n', 'martineAvailability');
    } else {
        if (guestNavName) guestNavName.textContent = 'Dani Rouabah';
        if (guestNavImg) guestNavImg.src = 'img/Dani.jpeg';
        if (adminNavImg) adminNavImg.src = 'img/Dani.jpeg';
        if (navLinkedIn) navLinkedIn.href = 'https://www.linkedin.com/in/mace-rouabah/';
        if (navEmailLink) navEmailLink.href = 'mailto:kendanine8@gmail.com';
        if (navEmailText) navEmailText.textContent = 'kendanine8@gmail.com';
        if (navPhoneLink) navPhoneLink.href = 'tel:+33769741268';
        if (navPhoneText) navPhoneText.textContent = '07 69 74 12 68';
        if (navAvailText) navAvailText.setAttribute('data-i18n', 'daniAvailability');
    }
    
    // Re-apply translations for dynamic content changes
    if (typeof window.applyTranslations === 'function') window.applyTranslations();
    
    console.log('[OK] [PROFILE] UI updated with profile:', profileName);
}

// Hide profile modal and show role modal
function hideProfileModal() {
    const profileModal = document.getElementById('profile-modal');
    const roleModal = document.getElementById('role-modal');
    
    if (profileModal) {
        profileModal.style.display = 'none';
        console.log('[OK] [PROFILE] Profile modal hidden');
    }
    
    if (roleModal) {
        roleModal.style.display = 'flex';
        console.log('[OK] [PROFILE] Role modal shown');
    }
}

// Change profile (called from app navigation)
window.changeProfile = function() {
    console.log('[SYNC] [PROFILE] Changing profile...');
    localStorage.removeItem('selectedAdminProfile');
    window.selectedAdminProfile = null;
    
    const profileModal = document.getElementById('profile-modal');
    const roleModal = document.getElementById('role-modal');
    
    // Hide all other modals
    document.querySelectorAll('.custom-modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Show profile modal
    if (profileModal) {
        profileModal.style.display = 'flex';
    }
    
    console.log('[OK] [PROFILE] Profile changed, showing profile selector');
};

// Get selected profile
window.getSelectedProfile = function() {
    return window.selectedAdminProfile || localStorage.getItem('selectedAdminProfile');
};

// Admin login button from profile selector
document.addEventListener('DOMContentLoaded', () => {
    const adminFromProfileBtn = document.getElementById('btn-admin-from-profile');
    if (adminFromProfileBtn) {
        adminFromProfileBtn.addEventListener('click', () => {
            console.log('[AUTH] [PROFILE] Admin login clicked from profile selector');
            const profileModal = document.getElementById('profile-modal');
            const loginModal = document.getElementById('login-modal');
            
            if (profileModal) profileModal.style.display = 'none';
            if (loginModal) loginModal.style.display = 'flex';
        });
    }
}, { once: true });

console.log('[OK] [PROFILE] Profile selector module initialized');
