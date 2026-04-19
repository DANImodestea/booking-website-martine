document.addEventListener("DOMContentLoaded", () => {
    // Global API base resolver and fetch interceptor for file/Live Server usage
    window.getApiBase = function() {
        return window.API_BASE 
            || localStorage.getItem('apiBase') 
            || (location.port === '5500' ? 'http://localhost:3000' : '');
    };
    (function(origFetch){
        window.fetch = function(url, opts) {
            if (typeof url === 'string' && url.startsWith('/api/')) {
                url = window.getApiBase() + url;
            }
            return origFetch(url, opts);
        };
    })(window.fetch);

    window.fetchReservations = async function() {
        try {
            const selectedProfile = window.getSelectedProfile();
            // Build URL with adminProfile query parameter
            const url = selectedProfile 
                ? `/api/reservations?adminProfile=${encodeURIComponent(selectedProfile)}` 
                : '/api/reservations';
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status} - Database connection likely blocked.`);
            }
            const data = await response.json();
            if (Array.isArray(data)) {
                localStorage.setItem('reservations', JSON.stringify(data));
                window.dispatchEvent(new Event('reservationsUpdated'));
            }
        } catch (error) {
            console.error('Error fetching reservations:', error);
        }
    };
    window.fetchReservations(); // Fetch on initial load

    window.addEventListener('reservationsUpdated', () => {
        if (typeof window.loadAdminDashboard === 'function' && document.getElementById('admin-view').style.display === 'block') window.loadAdminDashboard();
        if (typeof window.loadGuestDashboard === 'function' && document.getElementById('guest-view').style.display === 'block') window.loadGuestDashboard();
        if (window.guestSchedule) window.guestSchedule.refresh();
        if (window.adminSchedule) {
            const searchInput = document.getElementById('admin-search');
            window.adminSchedule.refresh(searchInput ? searchInput.value : '');
        }
    });

    window.guestSchedule = initSchedule('schedule-grid', { prev: 'prev-week-btn', next: 'next-week-btn', display: 'week-display', today: 'today-btn' },
        (clickedSlot) => {
            let selectedSlots = window.getSelectedSlots ? window.getSelectedSlots() : [];
            if (clickedSlot.classList.contains('selected')) {
                clickedSlot.classList.remove('selected');
                clickedSlot.classList.add(clickedSlot.dataset.originalState || 'free');
                selectedSlots = [];
                if (window.setSelectedSlots) window.setSelectedSlots(selectedSlots);
                if (window.updateBookButton) window.updateBookButton();
            } else if (clickedSlot.classList.contains('free')) {
                // Clear previous selection visually
                selectedSlots.forEach(s => {
                    s.classList.remove('selected');
                    s.classList.add(s.dataset.originalState || 'free');
                });
                clickedSlot.classList.remove('free');
                clickedSlot.classList.add('selected');
                selectedSlots = [clickedSlot];
                if (window.setSelectedSlots) window.setSelectedSlots(selectedSlots);
                if (window.updateBookButton) window.updateBookButton();
            } else if (clickedSlot.classList.contains('processing')) {
                window.showDialog({
                    title: window.t('waitlistReq'), message: window.t('waitlistMsg'),
                    buttons: [
                        { text: window.t('yesProceed'), class: 'btn-warning w-100', onClick: () => {
                            selectedSlots.forEach(s => {
                                s.classList.remove('selected');
                                s.classList.add(s.dataset.originalState || 'free');
                            });
                            clickedSlot.classList.remove('processing');
                            clickedSlot.classList.add('selected');
                            selectedSlots = [clickedSlot];
                            if (window.setSelectedSlots) window.setSelectedSlots(selectedSlots);
                            if (window.updateBookButton) window.updateBookButton();
                        }},
                        { text: window.t('cancel'), class: 'btn-secondary w-100' }
                    ]
                });
            }
        },
        () => { if (window.setSelectedSlots) window.setSelectedSlots([]); if (window.updateBookButton) window.updateBookButton(); }
    );

    window.adminSchedule = initSchedule('admin-schedule-grid', { prev: 'admin-prev-week-btn', next: 'admin-next-week-btn', display: 'admin-week-display', today: 'admin-today-btn' },
        (clickedSlot) => {
            if (!clickedSlot.classList.contains('free')) return;
            const newRes = { adminProfile: window.getSelectedProfile(), fname: "Admin", lname: "Block", email: "", phone: "", message: "Manual admin reservation", recurring: "one-time", status: "pending", slots: [{ day: clickedSlot.dataset.day, time: clickedSlot.dataset.time, fullDate: clickedSlot.dataset.fullDate }] };
            
            fetch('/api/reservations', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(newRes)
            }).then(() => {
                window.fetchReservations();
            }).catch(err => {
                console.error(err);
            });
        },
        () => { if (window.loadAdminDashboard) window.loadAdminDashboard(); }
    );
});
