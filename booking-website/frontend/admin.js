window.loadAdminDashboard = function() {
    const colAll = document.getElementById('col-all');
    const colPending = document.getElementById('col-pending');
    const colAccepted = document.getElementById('col-accepted');
    const colRejected = document.getElementById('col-rejected');
    
    if (!colPending) return;

    const adminSearchInput = document.getElementById('admin-search');
    const adminCurrentWeekFilter = document.getElementById('admin-current-week-filter');
    let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
    if (!Array.isArray(reservations)) reservations = [];
    const searchTerm = adminSearchInput ? adminSearchInput.value.toLowerCase() : '';
    const showCurrentWeekOnly = adminCurrentWeekFilter ? adminCurrentWeekFilter.checked : false;
    const activeFeed = document.querySelector('input[name="feed-type"]:checked')?.value || 'one-time';
    
    let mappedRes = reservations.map((res, idx) => ({ ...res, originalIndex: idx }));
    mappedRes.reverse();
    
    mappedRes = mappedRes.filter(res => res.recurring === activeFeed);

    if (showCurrentWeekOnly && window.adminSchedule) {
        const visibleDays = window.adminSchedule.getVisibleDays();
        if (visibleDays && visibleDays.length > 0) {
            const startOfWeek = new Date(visibleDays[0]).getTime();
            const endOfWeek = new Date(visibleDays[6]).getTime() + 86399999;
            mappedRes = mappedRes.filter(res => {
                if (res.status === 'blocked') {
                    const bStart = new Date(res.startDate).getTime();
                    const bEnd = new Date(res.endDate).getTime() + 86399999;
                    return bStart <= endOfWeek && bEnd >= startOfWeek;
                }
                return res.slots && res.slots.some(s => {
                    if (!s.fullDate) return true;
                    const slotDate = new Date(s.fullDate).getTime();
                    const endDate = res.endDate ? new Date(res.endDate).getTime() + 86399999 : Infinity;
                    if (res.recurring === 'weekly') return slotDate <= endOfWeek && endDate >= startOfWeek;
                    return slotDate >= startOfWeek && slotDate <= endOfWeek;
                });
            });
        }
    }
    if (searchTerm) {
        mappedRes = mappedRes.filter(res => {
            const searchStr = `${res.fname} ${res.lname} ${res.email} ${res.phone}`.toLowerCase();
            return searchStr.includes(searchTerm);
        });
    }

    let htmlAll = '', htmlPending = '', htmlAccepted = '', htmlRejected = '';

    mappedRes.forEach((res) => {
        const index = res.originalIndex;
        
        const formatTimeStr = (t) => {
            if (!t) return '';
            let [h, m] = t.split(':');
            let ampm = 'AM';
            h = parseInt(h, 10);
            if (h >= 12) { ampm = 'PM'; if(h > 12) h -= 12; }
            else if (h === 0) h = 12;
            return `${h}:${m} ${ampm}`;
        };
        const startT = res.startTime ? formatTimeStr(res.startTime) : '';
        const endT = res.endTime ? formatTimeStr(res.endTime) : '';
        const timeStr = (startT || endT) ? ` (${startT || 'Start'} - ${endT || 'End'})` : '';
        
        const slotsHtml = res.slots && res.slots.length > 0 
            ? res.slots.map(s => `<span class="badge bg-light text-dark border me-1">${s.day} @ ${s.time}</span>`).join(' ')
            : (res.status === 'blocked' ? `<span class="badge bg-secondary mt-1">${window.t('blocked')}: ${res.startDate} ${window.t('to')} ${res.endDate}${timeStr}</span>` : window.t('none'));
        const cardBg = res.status === 'blocked' ? 'bg-secondary-subtle' : res.status === 'approved' ? 'bg-success-subtle' : res.status === 'rejected' || res.status === 'cancelled' ? 'bg-danger-subtle' : 'bg-warning-subtle';
        
        let actionBtns = `<div class="d-flex gap-1 mt-2">`;
        if (res.status === 'blocked') {
            actionBtns += `<button class="btn btn-sm btn-danger reject-btn flex-fill fw-bold px-1 py-0" style="font-size:0.85rem;" data-index="${index}">${window.t('unblock')}</button>`;
        } else {
            if (res.status !== 'pending') actionBtns += `<button class="btn btn-sm btn-warning pending-btn flex-fill fw-bold px-1 py-0" style="font-size:0.85rem;" data-index="${index}">${window.t('pending')}</button>`;
            if (res.status !== 'approved') actionBtns += `<button class="btn btn-sm btn-success accept-btn flex-fill fw-bold px-1 py-0" style="font-size:0.85rem;" data-index="${index}">${window.t('accept')}</button>`;
            if (res.status !== 'rejected' && res.status !== 'cancelled') actionBtns += `<button class="btn btn-sm btn-danger reject-btn flex-fill fw-bold px-1 py-0" style="font-size:0.85rem;" data-index="${index}">${window.t('reject')}</button>`;
        }
        actionBtns += `</div>`;

        let editMenuHtml = '';
        if (res.status === 'blocked') {
            editMenuHtml = `
                <div class="mt-2 border-top pt-2">
                    <button class="btn btn-sm btn-outline-secondary w-100 edit-block-toggle-btn fw-bold" data-index="${index}">${window.t('modifyBlockTime')}</button>
                </div>
            `;
        } else {
            editMenuHtml = `
                <div class="mt-2 border-top pt-2">
                    <button class="btn btn-sm btn-outline-secondary w-100 edit-toggle-btn fw-bold" data-index="${index}">${window.t('modifyInfo')}</button>
                </div>
            `;
        }

        const isHighlightedCard = (window.activeAdminResIndex === index) ? 'highlight-card' : '';
        const cardHtml = `
        <div class="card mb-3 shadow-sm border-0 ${cardBg} admin-res-card ${isHighlightedCard}" data-res-index="${index}" style="cursor: pointer;">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-1 border-bottom pb-1">
                    <h6 class="card-title mb-0 fw-bold">${res.fname} ${res.lname}</h6>
                </div>
                <div class="text-muted small mb-3">
                    <div><strong>Email:</strong> ${res.email || 'N/A'}</div>
                    <div><strong>${window.t('phone')}:</strong> ${res.phone || 'N/A'}</div>
                    <div><strong>${window.t('type')}:</strong> <span class="badge bg-secondary">${res.recurring === 'weekly' ? window.t('weekly') : window.t('oneTime')}</span> ${res.endDate ? `(${window.t('until')}: ${res.endDate})` : ''}</div>
                </div>
                <div class="mb-2">
                    <strong class="small d-block mb-1">${window.t('slots')}:</strong>
                    ${slotsHtml}
                </div>
                ${res.message ? `<div class="small p-2 border rounded bg-white mb-2"><strong>${window.t('message')}:</strong> ${res.message}</div>` : ''}
                ${res.adminNote ? `<div class="small p-2 border border-warning rounded bg-light mb-2"><strong>${window.t('note')}:</strong> ${res.adminNote}</div>` : ''}
                ${actionBtns}
                ${editMenuHtml}
            </div>
        </div>`;

        htmlAll = cardHtml + htmlAll;
        if (res.status === 'approved') htmlAccepted += cardHtml;
        else if (res.status === 'rejected' || res.status === 'cancelled') htmlRejected += cardHtml;
        else htmlPending += cardHtml;
    });

    if (colAll) colAll.innerHTML = htmlAll || `<div class="text-muted small text-center p-3">${window.t('empty')}</div>`;
    colPending.innerHTML = htmlPending || `<div class="text-muted small text-center p-3">${window.t('empty')}</div>`;
    colAccepted.innerHTML = htmlAccepted || `<div class="text-muted small text-center p-3">${window.t('empty')}</div>`;
    colRejected.innerHTML = htmlRejected || `<div class="text-muted small text-center p-3">${window.t('empty')}</div>`;

    ['accept-btn', 'reject-btn', 'pending-btn'].forEach(cls => {
        document.querySelectorAll(`.${cls}`).forEach(btn => btn.addEventListener('click', async (e) => {
            const idx = e.target.getAttribute('data-index');
            let newStatus = cls.split('-')[0];
            if (newStatus === 'accept') newStatus = 'approved';
            if (newStatus === 'reject') newStatus = 'rejected';
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const target = reservations[idx];
            if (target && target._id) {
                try {
                    await fetch(`/api/reservations/${target._id}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ status: newStatus })
                    });
                    await window.fetchReservations();
                } catch(e) { console.error(e); }
            } else if (target) {
                target.status = newStatus;
                localStorage.setItem('reservations', JSON.stringify(reservations));
                window.dispatchEvent(new Event('reservationsUpdated'));
            }
        }));
    });

    document.querySelectorAll('.admin-res-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea')) return;
            
            const idx = parseInt(card.getAttribute('data-res-index'));
            window.activeAdminResIndex = (window.activeAdminResIndex === idx) ? null : idx;
            window.dispatchEvent(new Event('adminHighlightChange'));
        });
    });

    document.querySelectorAll('.edit-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
        window.openEditModal(e.target.getAttribute('data-index'), true);
    }));
    document.querySelectorAll('.edit-block-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
        window.openBlockModal(e.target.getAttribute('data-index'));
    }));
};

window.openEditModal = function(idx, isAdmin) {
    const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
    const res = reservations[idx];
    if(!res) return;

    document.getElementById('edit-index').value = idx;
    document.getElementById('edit-fname').value = res.fname || '';
    document.getElementById('edit-lname').value = res.lname || '';
    document.getElementById('edit-email').value = res.email || '';
    document.getElementById('edit-phone').value = res.phone || '';
    document.getElementById('edit-recurring').value = res.recurring || 'one-time';
    document.getElementById('edit-enddate-group').style.display = res.recurring === 'weekly' ? 'block' : 'none';
    document.getElementById('edit-enddate').value = res.endDate || '';
    document.getElementById('edit-weeks').value = '';
    document.getElementById('edit-message').value = res.message || '';
    
    if (isAdmin) {
        document.getElementById('edit-admin-note-group').style.display = 'block';
        document.getElementById('edit-adminnote').value = res.adminNote || '';
    } else {
        document.getElementById('edit-admin-note-group').style.display = 'none';
    }
    document.getElementById('edit-modal').style.display = 'flex';
};

window.openBlockModal = function(idx = null) {
    const blockModal = document.getElementById('block-modal');
    const form = document.getElementById('block-form');
    const title = document.getElementById('block-modal-title');
    const indexInput = document.getElementById('block-index');
    const delBtn = document.getElementById('block-delete-btn');
    const subBtn = document.getElementById('block-submit-btn');
    const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
    const existingSelect = document.getElementById('existing-blocks-select');
    const existingSection = document.getElementById('existing-blocks-section');

    if (existingSelect && existingSection) {
        existingSelect.innerHTML = `<option value="">${window.t('selectBlock')}</option>`;
        let hasBlocks = false;
        reservations.forEach((r, i) => {
            if (r.status === 'blocked') {
                hasBlocks = true;
                const opt = document.createElement('option');
                opt.value = i;
                opt.innerText = `${r.startDate}${r.startTime ? ' ' + r.startTime : ''} to ${r.endDate}${r.endTime ? ' ' + r.endTime : ''}${r.message ? ' (' + r.message + ')' : ''}`;
                if (idx !== null && idx == i) opt.selected = true;
                existingSelect.appendChild(opt);
            }
        });
        existingSection.style.display = hasBlocks ? 'block' : 'none';
    }

    if (idx !== null) {
        const res = reservations[idx];
        if (!res) return;
        indexInput.value = idx;
        document.getElementById('block-start').value = res.startDate || '';
        document.getElementById('block-start-time').value = res.startTime || '';
        document.getElementById('block-end').value = res.endDate || '';
        document.getElementById('block-end-time').value = res.endTime || '';
        document.getElementById('block-reason').value = res.message || '';
        title.innerText = window.t('modifyBlockTime');
        subBtn.innerText = window.t('saveChanges');
        delBtn.classList.remove('d-none');
        
        delBtn.onclick = async () => {
            if (res && res._id) {
                try {
                    await fetch(`/api/reservations/${res._id}`, { 
                        method: 'DELETE',
                        headers: { 
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    await window.fetchReservations();
                } catch(e) { console.error(e); }
            } else {
                reservations[idx].status = 'cancelled';
                localStorage.setItem('reservations', JSON.stringify(reservations));
                window.dispatchEvent(new Event('reservationsUpdated'));
            }
            blockModal.style.display = 'none';
        };
    } else {
        form.reset();
        indexInput.value = '';
        title.innerText = window.t('blockTimeVacation');
        subBtn.innerText = window.t('blockDates');
        delBtn.classList.add('d-none');
        delBtn.onclick = null;
    }
    blockModal.style.display = 'flex';
};

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('admin-feed-selector')?.addEventListener('change', (e) => {
        document.querySelectorAll('.admin-feed-col').forEach(col => col.classList.remove('active-feed'));
        const selectedWrap = document.getElementById('wrap-' + e.target.value);
        if (selectedWrap) selectedWrap.classList.add('active-feed');
    });

    document.getElementById('admin-search')?.addEventListener('input', (e) => {
        window.loadAdminDashboard();
        if (window.adminSchedule) window.adminSchedule.refresh(e.target.value);
    });

    document.getElementById('admin-current-week-filter')?.addEventListener('change', window.loadAdminDashboard);
    document.querySelectorAll('.feed-type-toggle').forEach(radio => radio.addEventListener('change', window.loadAdminDashboard));

    const resizer = document.getElementById('admin-resizer');
    const leftPanel = document.getElementById('admin-left-panel');
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
            let newWidth = e.clientX - leftPanel.getBoundingClientRect().left;
            const minWidth = 300;
            const maxWidth = containerWidth * 0.8;
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

    const blockTimeBtn = document.getElementById('btn-block-time');
    const blockModal = document.getElementById('block-modal');
    
    if (blockTimeBtn && blockModal) {
        blockTimeBtn.addEventListener('click', () => window.openBlockModal(null));
        document.getElementById('close-block-modal').addEventListener('click', () => blockModal.style.display = 'none');
        
        document.getElementById('existing-blocks-select')?.addEventListener('change', (e) => {
            window.openBlockModal(e.target.value === '' ? null : e.target.value);
        });

        document.getElementById('block-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const idx = document.getElementById('block-index').value;
            const blockData = {
                fname: "Vacation", lname: "Block", email: "", phone: "", status: "blocked", recurring: "one-time",
                startDate: document.getElementById('block-start').value,
                startTime: document.getElementById('block-start-time').value,
                endDate: document.getElementById('block-end').value,
                endTime: document.getElementById('block-end-time').value,
                message: document.getElementById('block-reason').value, slots: []
            };
            
            if (idx !== '' && idx !== null) {
                const target = reservations[idx];
                if (target && target._id) {
                    try {
                        await fetch(`/api/reservations/${target._id}`, {
                            method: 'PUT',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify(blockData)
                        });
                    } catch(e) { console.error(e); }
                }
            } else {
                try {
                    await fetch('/api/reservations', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(blockData)
                    });
                } catch(e) { console.error(e); }
            }
            
            await window.fetchReservations();
            blockModal.style.display = 'none';
            document.getElementById('block-form').reset();
        });
    }

    document.getElementById('close-edit-modal')?.addEventListener('click', () => document.getElementById('edit-modal').style.display = 'none');

    document.getElementById('edit-recurring')?.addEventListener('change', (e) => {
        document.getElementById('edit-enddate-group').style.display = e.target.value === 'weekly' ? 'block' : 'none';
    });

    document.getElementById('edit-weeks')?.addEventListener('change', (e) => {
        const weeks = parseInt(e.target.value, 10);
        const idx = document.getElementById('edit-index').value;
        const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
        if (weeks && reservations[idx]) {
            let baseDate = new Date();
            if (reservations[idx].slots && reservations[idx].slots.length > 0 && reservations[idx].slots[0].fullDate) {
                baseDate = new Date(reservations[idx].slots[0].fullDate);
            }
            baseDate.setDate(baseDate.getDate() + (weeks * 7));
            document.getElementById('edit-enddate').value = baseDate.toISOString().split('T')[0];
        }
    });

    document.getElementById('edit-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idx = document.getElementById('edit-index').value;
        const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
        if(!reservations[idx]) return;
        
        const target = reservations[idx];
        const updatedData = {
            fname: document.getElementById('edit-fname').value,
            lname: document.getElementById('edit-lname').value,
            email: document.getElementById('edit-email').value,
            phone: document.getElementById('edit-phone').value,
            recurring: document.getElementById('edit-recurring').value,
            endDate: document.getElementById('edit-recurring').value === 'weekly' ? document.getElementById('edit-enddate').value : null,
            message: document.getElementById('edit-message').value
        };
        if (document.getElementById('edit-admin-note-group').style.display === 'block') {
            updatedData.adminNote = document.getElementById('edit-adminnote').value;
        }
        
        if (target && target._id) {
            try {
                await fetch(`/api/reservations/${target._id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(updatedData)
                });
                await window.fetchReservations();
            } catch(e) { console.error(e); }
        } else {
            Object.assign(target, updatedData);
            localStorage.setItem('reservations', JSON.stringify(reservations));
            window.dispatchEvent(new Event('reservationsUpdated'));
        }
        
        document.getElementById('edit-modal').style.display = 'none';
        window.showDialog({ title: window.t('success'), message: window.t('resUpdated'), buttons: [{ text: window.t('ok'), class: 'btn-success w-100' }] });
    });
});

// Global Admin Highlight Tracker
window.activeAdminResIndex = null;

window.addEventListener('adminHighlightChange', () => {
    // Toggle classes without full reload to preserve vertical scroll initially
    document.querySelectorAll('.admin-res-card').forEach(card => {
        if (parseInt(card.getAttribute('data-res-index')) === window.activeAdminResIndex) {
            card.classList.add('highlight-card');
        } else {
            card.classList.remove('highlight-card');
        }
    });
    
    if (window.adminSchedule && document.getElementById('admin-view').style.display === 'block') {
        let dateChanged = false;
        if (window.activeAdminResIndex !== null) {
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const activeRes = reservations[window.activeAdminResIndex];
            if (activeRes) {
                if (activeRes.status === 'blocked' && activeRes.startDate) {
                    window.adminSchedule.goToDate(new Date(activeRes.startDate));
                    dateChanged = true;
                } else if (activeRes.slots && activeRes.slots.length > 0 && activeRes.slots[0].fullDate) {
                    window.adminSchedule.goToDate(new Date(activeRes.slots[0].fullDate));
                    dateChanged = true;
                }
            }
        }
        
        if (!dateChanged) {
            const searchInput = document.getElementById('admin-search');
            window.adminSchedule.refresh(searchInput ? searchInput.value : '');
        }
        
        setTimeout(() => {
            const highlightedCard = document.querySelector(`.admin-res-card[data-res-index="${window.activeAdminResIndex}"]`);
            if (highlightedCard) {
                highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            const highlightedSlot = document.querySelector('#admin-schedule-grid .highlight-slot');
            if (highlightedSlot) {
                highlightedSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 50);
    }
});