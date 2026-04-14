// ============================================
// PROFILE SELECTOR MODULE
// Handles selection of Martine or Dani
// ============================================

window.selectedAdminProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 [PROFILE] Profile selector module loaded');
    
    // Check if profile is already selected
    const savedProfile = localStorage.getItem('selectedAdminProfile');
    if (savedProfile) {
        console.log('✅ [PROFILE] Profile already selected:', savedProfile);
        window.selectedAdminProfile = savedProfile;
        // Hide profile modal and show role modal
        hideProfileModal();
    } else {
        console.log('⏳ [PROFILE] Waiting for profile selection...');
        setupProfileSelection();
    }
});

// Setup profile selection listeners
function setupProfileSelection() {
    const profileMartineBtn = document.getElementById('profile-martine');
    const profileDaniBtn = document.getElementById('profile-dani');
    
    if (profileMartineBtn) {
        profileMartineBtn.addEventListener('click', () => selectProfile('Martine'));
        profileMartineBtn.addEventListener('mouseover', () => {
            profileMartineBtn.style.transform = 'scale(1.05)';
        });
        profileMartineBtn.addEventListener('mouseout', () => {
            profileMartineBtn.style.transform = 'scale(1)';
        });
    }
    
    if (profileDaniBtn) {
        profileDaniBtn.addEventListener('click', () => selectProfile('Dani'));
        profileDaniBtn.addEventListener('mouseover', () => {
            profileDaniBtn.style.transform = 'scale(1.05)';
        });
        profileDaniBtn.addEventListener('mouseout', () => {
            profileDaniBtn.style.transform = 'scale(1)';
        });
    }
}

// Select profile and proceed
function selectProfile(profileName) {
    console.log('🎯 [PROFILE] Profile selected:', profileName);
    window.selectedAdminProfile = profileName;
    localStorage.setItem('selectedAdminProfile', profileName);
    
    // Update UI with selected profile
    updateUIWithProfile(profileName);
    
    // Update admin title
    const adminTitle = document.getElementById('admin-title');
    if (adminTitle) {
        adminTitle.textContent = `${profileName} - ${profileName === 'Martine' ? 'Tableau de bord Admin' : 'Admin Dashboard'}`;
    }
    
    console.log('✅ [PROFILE] Saving profile to localStorage');
    hideProfileModal();
}

// Update UI based on selected profile
function updateUIWithProfile(profileName) {
    const guestBrand = document.querySelector('.navbar-brand');
    if (guestBrand) {
        guestBrand.textContent = profileName === 'Martine' ? 'Martine Juillan' : 'Dani Coach';
    }
    console.log('✅ [PROFILE] UI updated with profile:', profileName);
}

// Hide profile modal and show role modal
function hideProfileModal() {
    const profileModal = document.getElementById('profile-modal');
    const roleModal = document.getElementById('role-modal');
    
    if (profileModal) {
        profileModal.style.display = 'none';
        console.log('✅ [PROFILE] Profile modal hidden');
    }
    
    if (roleModal) {
        roleModal.style.display = 'flex';
        console.log('✅ [PROFILE] Role modal shown');
    }
}

// Change profile (called from app navigation)
window.changeProfile = function() {
    console.log('🔄 [PROFILE] Changing profile...');
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
    
    console.log('✅ [PROFILE] Profile changed, showing profile selector');
};

// Get selected profile
window.getSelectedProfile = function() {
    return window.selectedAdminProfile || localStorage.getItem('selectedAdminProfile');
};

console.log('✅ [PROFILE] Profile selector module initialized');
