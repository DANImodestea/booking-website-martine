document.addEventListener("DOMContentLoaded", () => {
    const loginModal = document.getElementById('login-modal');
    const guestView = document.getElementById('guest-view');
    const adminView = document.getElementById('admin-view');
    const guestLoginModal = document.getElementById('guest-login-modal');
    
    // Validation helper for email only
    function isValidEmail(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        return emailRegex.test(input);
    }
    
    // Admin button from profile selector
    document.getElementById('btn-admin-from-profile')?.addEventListener('click', () => {
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
            profileModal.style.display = 'none';
        }
        if (guestLoginModal) guestLoginModal.style.display = 'none';
        loginModal.style.display = 'flex';
    });
    
    document.getElementById('close-guest-login')?.addEventListener('click', () => {
        guestLoginModal.style.display = 'none';
        document.getElementById('profile-modal').style.display = 'flex';
        document.getElementById('guest-login-step-2').style.display = 'none';
        document.getElementById('guest-login-step-1').style.display = 'block';
        document.getElementById('guest-code-input').value = '';
    });
    
    document.getElementById('btn-back-from-guest-login')?.addEventListener('click', () => {
        guestLoginModal.style.display = 'none';
        document.getElementById('profile-modal').style.display = 'flex';
        document.getElementById('guest-id-input').value = '';
        document.getElementById('guest-code-input').value = '';
        document.getElementById('guest-login-step-2').style.display = 'none';
        document.getElementById('guest-login-step-1').style.display = 'block';
    });

    function loginGuest(email) {
        localStorage.setItem('currentUser', email);
        guestLoginModal.style.display = 'none';
        document.getElementById('guest-login-step-2').style.display = 'none';
        document.getElementById('guest-login-step-1').style.display = 'block';
        document.getElementById('guest-code-input').value = '';
        
        guestView.style.display = 'block';
        if (window.guestSchedule) window.guestSchedule.refresh();
        if (window.loadGuestDashboard) window.loadGuestDashboard();
    }

    document.getElementById('btn-guest-login')?.addEventListener('click', async () => {
        const guestId = document.getElementById('guest-id-input').value.trim();
        if (!guestId) {
            window.showDialog({ 
                title: window.t('inputReq'), 
                message: window.t('inputReqMsg'), 
                buttons: [{ text: window.t('ok'), class: 'btn-success w-100' }] 
            });
            return;
        }
        
        // Validate email format
        if (!isValidEmail(guestId)) {
            window.showDialog({ 
                title: 'Format invalide', 
                message: 'Veuillez entrer une adresse email valide (ex: email@example.com)',
                buttons: [{ text: 'OK', class: 'btn-warning w-100' }] 
            });
            return;
        }
        
        const btn = document.getElementById('btn-guest-login');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-hourglass-split"></i> ...`;
        btn.disabled = true;

        try {
            const adminProfile = window.getSelectedProfile();
            const response = await fetch('/api/auth/request-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestId, adminProfile })
            });
            
            if (!response.ok) {
                throw new Error(`Serveur injoignable (Erreur ${response.status}). Avez-vous redémarré le serveur backend ?`);
            }
            
            const data = await response.json();
            
            if (data.verified) {
                loginGuest(guestId);
            } else {
                document.getElementById('guest-login-step-1').style.display = 'none';
                document.getElementById('guest-login-step-2').style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            window.showDialog({ title: 'Erreur', message: e.message || 'Serveur indisponible.', buttons: [{ text: window.t('ok'), class: 'btn-danger w-100' }] });
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-verify-code')?.addEventListener('click', async () => {
        const email = document.getElementById('guest-id-input').value.trim();
        const code = document.getElementById('guest-code-input').value.trim();
        const adminProfile = window.getSelectedProfile();
        if (!code) return;
        
        const btn = document.getElementById('btn-verify-code');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-hourglass-split"></i> ...`;
        btn.disabled = true;

        try {
            const res = await fetch('/api/auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, adminProfile, code })
            });
            
            if (!res.ok) {
                let errorMsg = `Erreur ${res.status}`;
                try {
                    const errData = await res.json();
                    errorMsg = errData.error || errorMsg;
                } catch(e) {}
                throw new Error(errorMsg);
            }
            
            const data = await res.json();
            
            if (data.success) {
                loginGuest(email);
            } else {
                window.showDialog({ title: 'Erreur', message: data.error || window.t('verifyError'), buttons: [{ text: window.t('ok'), class: 'btn-danger w-100' }] });
            }
        } catch (e) {
            console.error(e);
            window.showDialog({ title: 'Erreur', message: e.message || window.t('verifyError'), buttons: [{ text: window.t('ok'), class: 'btn-danger w-100' }] });
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-back-to-email')?.addEventListener('click', () => {
        document.getElementById('guest-login-step-2').style.display = 'none';
        document.getElementById('guest-login-step-1').style.display = 'block';
        document.getElementById('guest-code-input').value = '';
    });

    document.getElementById('btn-guest-logout')?.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        guestView.style.display = 'none';
        document.getElementById('profile-modal').style.display = 'flex';
        document.getElementById('guest-id-input').value = '';
    });

    document.getElementById('close-login')?.addEventListener('click', () => {
        loginModal.style.display = 'none';
        document.getElementById('profile-modal').style.display = 'flex';
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
    });
    
    document.getElementById('btn-back-from-admin-login')?.addEventListener('click', () => {
        loginModal.style.display = 'none';
        document.getElementById('profile-modal').style.display = 'flex';
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
    });
    
    document.getElementById('toggle-admin-pass')?.addEventListener('click', function() {
        const passInput = document.getElementById('admin-pass');
        const icon = document.getElementById('toggle-admin-pass-icon');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            icon.classList.remove('bi-eye');
            icon.classList.add('bi-eye-slash');
        } else {
            passInput.type = 'password';
            icon.classList.remove('bi-eye-slash');
            icon.classList.add('bi-eye');
        }
    });

    document.getElementById('btn-login')?.addEventListener('click', async () => {
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token); // Save the JWT
                localStorage.setItem('currentUser', 'admin');
                // Set the selected admin profile from login response
                window.selectedAdminProfile = data.adminProfile;
                localStorage.setItem('selectedAdminProfile', data.adminProfile);
                
                if (typeof window.updateUIWithProfile === 'function') {
                    window.updateUIWithProfile(data.adminProfile);
                }
                const adminTitle = document.getElementById('admin-title');
                if (adminTitle) {
                    adminTitle.innerHTML = `${data.adminProfile} - <span data-i18n="adminDashboard">${window.t('adminDashboard')}</span>`;
                }

                loginModal.style.display = 'none';
                adminView.style.display = 'block';
                // Refetch reservations with the correct profile
                if (window.fetchReservations) window.fetchReservations();
                if (window.loadAdminDashboard) window.loadAdminDashboard();
                if (window.adminSchedule) {
                    const searchInput = document.getElementById('admin-search');
                    window.adminSchedule.refresh(searchInput ? searchInput.value : '');
                }
            } else {
                window.showDialog({ title: window.t('accessDenied'), message: window.t('invalidCreds'), buttons: [{ text: window.t('ok'), class: 'btn-danger w-100' }] });
            }
        } catch(e) { 
            console.error('Login error:', e); 
            window.showDialog({ title: 'Server Error', message: 'Could not connect to the backend server. Make sure your server.js is running in the terminal!', buttons: [{ text: window.t('ok'), class: 'btn-danger w-100' }] });
        }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        adminView.style.display = 'none';
        document.getElementById('profile-modal').style.display = 'flex';
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
        const adminSearchInput = document.getElementById('admin-search');
        if (adminSearchInput) adminSearchInput.value = '';
        if (window.guestSchedule) window.guestSchedule.refresh();
        if (window.adminSchedule) window.adminSchedule.refresh('');
    });

    document.getElementById('btn-change-profile')?.addEventListener('click', () => {
        console.log('[SYNC] [AUTH] Changing admin profile...');
        adminView.style.display = 'none';
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        localStorage.removeItem('selectedAdminProfile');
        window.selectedAdminProfile = null;
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
        
        // Show profile selector
        window.changeProfile();
    });
});