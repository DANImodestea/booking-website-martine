window.loadGuestDashboard = function() {
    const guestDashboard = document.getElementById('guest-dashboard');
    const listContainer = document.getElementById('guest-reservations-list');
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser || currentUser === 'admin') return;

    let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
    if (!Array.isArray(reservations)) reservations = [];
    const mappedRes = reservations.map((r, i) => ({...r, originalIndex: i})).filter(r => r.email === currentUser || r.phone === currentUser);

    const resCountBadge = document.getElementById('guest-res-count');
    if (resCountBadge) {
        resCountBadge.innerText = mappedRes.length;
    }

    if (mappedRes.length > 0) {
        guestDashboard.style.display = 'block';
        listContainer.innerHTML = mappedRes.reverse().map(res => {
            const slotsHtml = res.slots && res.slots.length > 0 ? res.slots.map(s => `<span class="badge bg-light text-dark border me-1">${s.day} @ ${s.time}</span>`).join(' ') : '';
            let statusBadge = 'bg-warning text-dark';
            if (res.status === 'approved' || res.status === 'accept') statusBadge = 'bg-success';
            if (res.status === 'rejected' || res.status === 'reject' || res.status === 'cancelled') statusBadge = 'bg-danger text-white';
            let cancelBtn = (res.status === 'pending' || res.status === 'approved') 
                ? `<button class="btn btn-sm btn-outline-danger mt-2 w-100 guest-cancel-btn" data-index="${res.originalIndex}">${window.t('cancelRes')}</button>` : '';
            
            let editBtn = (res.status !== 'rejected' && res.status !== 'cancelled') ? `<button class="btn btn-sm btn-outline-primary mt-2 w-100 guest-edit-toggle-btn fw-bold" data-index="${res.originalIndex}">${window.t('editDetails')}</button>` : '';

            return `<div class="col-12"><div class="card shadow-sm border-0 h-100 guest-res-card"><div class="card-body">
                <div class="d-flex justify-content-between mb-2"><strong class="text-success">${res.fname} ${res.lname}</strong><span class="badge ${statusBadge}">${res.status.toUpperCase()}</span></div>
                <div class="small mb-2"><strong>${window.t('type')}:</strong> ${res.recurring === 'weekly' ? window.t('weekly') : window.t('oneTime')} ${res.endDate ? `(${window.t('until')} ${res.endDate})` : ''}</div>
                <div class="small"><strong>${window.t('slots')}:</strong><br>${slotsHtml}</div>
                ${editBtn}
                ${cancelBtn}
            </div></div></div>`;
        }).join('');

        document.querySelectorAll('.guest-cancel-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            window.showDialog({
                title: window.t('cancelRes'), message: window.t('cancelResConf'),
                buttons: [
                    { text: window.t('yesCancel'), class: 'btn-danger w-100', onClick: async () => {
                            const allRes = JSON.parse(localStorage.getItem('reservations')) || [];
                            const target = allRes[idx];
                            if (target && target._id) {
                                try {
                                    await fetch(`/api/reservations/${target._id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'cancelled' })
                                    });
                                    await window.fetchReservations();
                                } catch(e) { console.error(e); }
                            } else if (target) {
                                target.status = 'cancelled';
                                localStorage.setItem('reservations', JSON.stringify(allRes));
                                window.dispatchEvent(new Event('reservationsUpdated'));
                            }
                        } 
                    },
                    { text: window.t('noKeep'), class: 'btn-secondary w-100' }
                ]
            });
        }));

        document.querySelectorAll('.guest-edit-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
            window.openEditModal(e.target.getAttribute('data-index'), false);
        }));
    } else {
        guestDashboard.style.display = 'none';
        listContainer.innerHTML = '';
    }
};

document.addEventListener("DOMContentLoaded", () => {
    let selectedSlots = [];

    window.modalController = initModal(async (clientData, slotsToBook) => {
        const selectedProfile = window.getSelectedProfile();
        const newRes = { 
            ...clientData, 
            adminProfile: selectedProfile, // 👈 NEW: Add selected admin profile
            status: 'pending', 
            slots: slotsToBook.map(slot => ({ day: slot.dataset.day, time: slot.dataset.time, fullDate: slot.dataset.fullDate })) 
        };
        try {
            await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRes)
            });
            await window.fetchReservations();
            window.showDialog({ title: window.t('success'), message: `${window.t('resReqFor')} ${clientData.fname}!`, buttons: [{ text: window.t('awesome'), class: 'btn-success w-100' }] });
            selectedSlots = [];
            window.updateBookButton();
        } catch(e) { console.error(e); }
    });

    window.updateBookButton = function() {
        const btns = document.querySelectorAll('.book-action-btn');
        const count = selectedSlots.length;
        btns.forEach(btn => {
            btn.classList.remove('btn-secondary', 'btn-success');
            btn.classList.add(count > 0 ? 'btn-success' : 'btn-secondary');
            if (count > 0) {
                btn.removeAttribute('disabled');
                btn.innerText = window.t('bookSelected').replace('{n}', count);
            } else {
                btn.setAttribute('disabled', 'true');
                btn.innerText = window.t('bookBtnDefault');
            }
        });
    };
    window.getSelectedSlots = () => selectedSlots;
    window.setSelectedSlots = (slots) => { selectedSlots = slots; };
    document.querySelectorAll('.book-action-btn').forEach(btn => {
        btn.addEventListener('click', () => { if (selectedSlots.length > 0) window.modalController.openModal(selectedSlots); });
    });

    // --- GUEST PANEL RESIZER LOGIC ---
    const resizer = document.getElementById('guest-resizer');
    const leftPanel = document.getElementById('guest-left-panel');
    let isResizing = false;

    if (resizer && leftPanel) {
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            resizer.classList.add('is-resizing');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerWidth = leftPanel.parentElement.getBoundingClientRect().width;
            
            // Calculate the distance from the left edge
            let newWidth = e.clientX - leftPanel.getBoundingClientRect().left;
            const minWidth = 300;
            const maxWidth = containerWidth * 0.6; // Keep it from squishing the calendar out of view
            
            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > maxWidth) newWidth = maxWidth;
            leftPanel.style.flex = `0 0 ${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                resizer.classList.remove('is-resizing');
            }
        });
    }
});