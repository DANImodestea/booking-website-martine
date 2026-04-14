document.addEventListener("DOMContentLoaded", () => {
    const roleModal = document.getElementById('role-modal');
    const loginModal = document.getElementById('login-modal');
    const guestView = document.getElementById('guest-view');
    const adminView = document.getElementById('admin-view');
    const guestLoginModal = document.getElementById('guest-login-modal');
    
    document.getElementById('btn-guest')?.addEventListener('click', () => {
        roleModal.style.display = 'none';
        guestLoginModal.style.display = 'flex';
    });

    document.getElementById('close-guest-login')?.addEventListener('click', () => {
        guestLoginModal.style.display = 'none';
        roleModal.style.display = 'flex';
    });

    document.getElementById('btn-guest-login')?.addEventListener('click', () => {
        const guestId = document.getElementById('guest-id-input').value.trim();
        if (!guestId) {
            window.showDialog({ 
                title: window.t('inputReq'), 
                message: window.t('inputReqMsg'), 
                buttons: [{ text: window.t('ok'), class: 'btn-success w-100' }] 
            });
            return;
        }
        localStorage.setItem('currentUser', guestId);
        guestLoginModal.style.display = 'none';
        guestView.style.display = 'block';
        if (window.guestSchedule) window.guestSchedule.refresh();
        if (window.loadGuestDashboard) window.loadGuestDashboard();
    });

    document.getElementById('btn-guest-logout')?.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        guestView.style.display = 'none';
        roleModal.style.display = 'flex';
        document.getElementById('guest-id-input').value = '';
    });

    document.getElementById('btn-admin')?.addEventListener('click', () => {
        roleModal.style.display = 'none';
        loginModal.style.display = 'flex';
    });

    document.getElementById('close-login')?.addEventListener('click', () => {
        loginModal.style.display = 'none';
        roleModal.style.display = 'flex';
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
                loginModal.style.display = 'none';
                adminView.style.display = 'block';
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
        roleModal.style.display = 'flex';
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
        const adminSearchInput = document.getElementById('admin-search');
        if (adminSearchInput) adminSearchInput.value = '';
        if (window.guestSchedule) window.guestSchedule.refresh();
        if (window.adminSchedule) window.adminSchedule.refresh('');
    });
});