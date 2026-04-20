window.loadAdminDashboard = function() {
    window.pendingSlotSelections = window.pendingSlotSelections || {};

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
                    const bStart = new Date(`${res.startDate}T00:00:00`).getTime();
                    const bEnd = new Date(`${res.endDate}T23:59:59`).getTime();
                    return bStart <= endOfWeek && bEnd >= startOfWeek;
                }
                return res.slots && res.slots.some(s => {
                    if (!s.fullDate) return true;
                    const slotDate = new Date(s.fullDate).getTime();
                    if (res.recurring === 'weekly' && res.endDate) {
                        const endDate = new Date(`${res.endDate}T23:59:59`).getTime();
                        return slotDate <= endOfWeek && endDate >= startOfWeek;
                    }
                    return slotDate >= startOfWeek && slotDate <= endOfWeek;
                });
            });
        }
    }
    if (searchTerm) {
        mappedRes = mappedRes.filter(res => {
            const searchStr = `${res.fname} ${res.lname} ${res.email} ${res.phone} ${res.resId || ''}`.toLowerCase();
            return searchStr.includes(searchTerm);
        });
    }

    let htmlAll = '', htmlPending = '', htmlAccepted = '', htmlRejected = '';

    mappedRes.forEach((res) => {
        const index = res.originalIndex;
        
        const getDisplayTime = (timeStr) => {
            if (window.currentLang !== 'fr') return timeStr;
            if (!timeStr || (!timeStr.includes('AM') && !timeStr.includes('PM'))) return timeStr;
            const [time, modifier] = timeStr.split(' ');
            let [h, m] = time.split(':');
            h = parseInt(h, 10);
            if (modifier === 'PM' && h < 12) h += 12;
            if (modifier === 'AM' && h === 12) h = 0;
            return `${h.toString().padStart(2, '0')}h${m}`;
        };

        const getDisplayDate = (fullDate, fallbackDay) => {
            if (!fullDate) return fallbackDay ? fallbackDay.replace(/\b\w/g, c => c.toUpperCase()) : '';
            const lang = window.currentLang === 'fr' ? 'fr-FR' : 'en-US';
            const str = new Date(fullDate).toLocaleDateString(lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' });
            return str.replace(/\b\w/g, c => c.toUpperCase());
        };

        const formatTimeStr = (t) => {
            if (!t) return '';
            let [h, m] = t.split(':');
            h = parseInt(h, 10);
            if (window.currentLang === 'fr') return `${h.toString().padStart(2, '0')}h${m}`;
            let ampm = 'AM';
            if (h >= 12) { ampm = 'PM'; if(h > 12) h -= 12; }
            else if (h === 0) h = 12;
            return `${h}:${m} ${ampm}`;
        };
        const startT = res.startTime ? formatTimeStr(res.startTime) : '';
        const endT = res.endTime ? formatTimeStr(res.endTime) : '';
        const timeStr = (startT || endT) ? ` (${startT || 'Start'} - ${endT || 'End'})` : '';
        const dailyTxt = res.recurring === 'daily' ? ` ${window.t('dailyRec')}` : '';
        
        const resKey = res._id || `local-${index}`;
        const existingSelection = window.pendingSlotSelections[resKey];
        if (!existingSelection && res.slots && res.slots.length > 0) {
            window.pendingSlotSelections[resKey] = res.slots.map((_, i) => i);
        }
        const selection = window.pendingSlotSelections[resKey] || [];

        let slotsHtml = '';
        if (res.slots && res.slots.length > 0) {
            slotsHtml = res.slots.map((s, i) => {
                const isChecked = selection.includes(i);
                const uncheckedClass = (!isChecked && res.status === 'pending') ? 'slot-unchecked' : '';
                const sDoneMark = (s.classDone || res.classDone) ? ' <span class="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle ms-1" style="width: 14px; height: 14px; font-size: 10px; line-height: 1;">✓</span>' : '';
                return `
                    <label class="form-check d-inline-flex align-items-center gap-1 me-2 mb-1 slot-check-label ${uncheckedClass}">
                        <input type="checkbox" class="form-check-input slot-checkbox" data-res-index="${index}" data-slot-index="${i}" ${isChecked ? 'checked' : ''}>
                        <span class="badge bg-light text-dark border">${getDisplayDate(s.fullDate, s.day)} @ ${getDisplayTime(s.time)}${sDoneMark}</span>
                    </label>
                `;
            }).join('');
        } else {
            slotsHtml = res.status === 'blocked' ? `<span class="badge bg-secondary mt-1">${window.t('blocked')}: ${res.startDate} ${window.t('to')} ${res.endDate}${timeStr}${dailyTxt}</span>` : window.t('none');
        }
        const statusClass = res.status === 'blocked' ? 'status-blocked' 
            : res.status === 'approved' ? 'status-approved' 
            : (res.status === 'rejected' || res.status === 'cancelled') ? 'status-rejected' 
            : 'status-pending';
            
        const statusBgClass = res.status === 'blocked' ? 'status-blocked-bg' 
            : res.status === 'approved' ? 'status-approved-bg' 
            : (res.status === 'rejected' || res.status === 'cancelled') ? 'status-rejected-bg' 
            : 'status-pending-bg';

        let selectAllToggleHtml = '';
        if (res.slots && res.slots.length > 1 && res.status === 'pending') {
            const allChecked = selection.length === res.slots.length;
            selectAllToggleHtml = `
                <div class="form-check form-switch ms-2 d-inline-block">
                    <input class="form-check-input select-all-slots-toggle" type="checkbox" data-res-index="${index}" ${allChecked ? 'checked' : ''}>
                    <label class="form-check-label small text-muted">${window.t('selectAll')}</label>
                </div>
            `;
        }
        
        let slotsSummaryHtml = '';
        if (res.slots && res.slots.length > 1 && res.status === 'pending') {
            const summaryText = window.t('slotsSelected') 
                ? window.t('slotsSelected').replace('{selected}', selection.length).replace('{total}', res.slots.length) 
                : `${selection.length} slot(s) selected out of ${res.slots.length}`;
            slotsSummaryHtml = `<div class="small text-primary mt-1 fw-bold slot-summary-text" data-res-index="${index}" data-total="${res.slots.length}">${summaryText}</div>`;
        }

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
        
        let studentLinksHtml = '';
        if (res.email) {
            const linksList = (res.studentLinks && res.studentLinks.length > 0) 
                ? res.studentLinks.map((l, i) => `
                    <li class="mb-1 d-flex justify-content-between align-items-center">
                        <a href="${l.url}" target="_blank" class="text-decoration-none text-truncate" style="max-width: 65%;">${l.name}</a>
                        <div class="d-flex align-items-center">
                            <button class="btn btn-link text-primary p-0 ms-2 edit-link-btn text-decoration-none" style="font-size:0.85rem;" data-email="${res.email}" data-link-index="${i}" data-link-name="${l.name}" data-link-url="${l.url}" title="Modifier"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-link text-danger p-0 ms-2 remove-link-btn text-decoration-none" style="font-size:1rem;" data-email="${res.email}" data-link-index="${i}" title="Supprimer"><i class="bi bi-trash"></i></button>
                        </div>
                    </li>
                  `).join('')
                : '<li class="text-muted small">Aucun lien</li>';
            
            studentLinksHtml = `
                <div class="mt-2 border-top pt-2" onclick="event.stopPropagation()">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong class="small text-primary">Liens de l'étudiant</strong>
                        <button class="btn btn-sm btn-outline-primary py-0 px-2 add-link-btn" style="font-size: 0.75rem;" data-email="${res.email}"><i class="bi bi-plus-lg me-1"></i> Ajouter</button>
                    </div>
                    <ul class="list-unstyled small mb-0">${linksList}</ul>
                </div>
            `;
        }
        
        const adminReplyHtml = res.adminReply ? `<div class="small p-2 border border-info rounded bg-white bg-opacity-50 mb-2"><strong><i class="bi bi-chat-left-text text-info me-1"></i> ${window.t('coachReply')}</strong> ${res.adminReply}</div>` : '';

        const isHighlightedCard = (window.activeAdminResIndex === index) ? 'highlight-card' : '';
        const allSlotsDone = res.slots && res.slots.length > 0 && res.slots.every(s => s.classDone);
        const isFullyDone = res.classDone || allSlotsDone;
        const doneBadge = isFullyDone ? `<span class="ms-2 d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle shadow-sm" style="width: 18px; height: 18px; font-size: 12px;" title="${window.t('markDone') || 'Cours effectué'}">✓</span>` : '';
        const cardHtml = `
        <div class="card mb-3 shadow-sm border-0 admin-res-card ${statusClass} ${statusBgClass} ${isHighlightedCard}" data-res-index="${index}" style="cursor: pointer;">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-1 border-bottom pb-1">
                    <h6 class="card-title mb-0 fw-bold">${res.fname} ${res.lname} <span class="badge bg-light text-secondary border ms-2 font-monospace">${res.resId || 'N/A'}</span>${doneBadge}</h6>
                </div>
                <div class="text-muted small mb-3">
                    <div><strong>Email:</strong> ${res.email || 'N/A'}</div>
                    <div><strong>${window.t('phone')}:</strong> ${res.phone || 'N/A'}</div>
                    <div><strong>${window.t('type')}:</strong> <span class="badge bg-secondary">${res.recurring === 'weekly' ? window.t('weekly') : window.t('oneTime')}</span> ${res.endDate ? `(${window.t('until')}: ${res.endDate})` : ''}</div>
                </div>
                <div class="mb-2">
                    <div class="mb-1"><strong class="small">${window.t('slots')}:</strong>${selectAllToggleHtml}</div>
                    ${slotsHtml}
                    ${slotsSummaryHtml}
                </div>
                ${res.message ? `<div class="small p-2 border rounded bg-white mb-2"><strong><i class="bi bi-journal-text text-secondary me-1"></i> ${window.t('message')}:</strong> ${res.message}</div>` : ''}
                ${res.adminNote ? `<div class="small p-2 border border-warning rounded bg-light mb-2"><strong><i class="bi bi-sticky text-warning me-1"></i> ${window.t('note')}:</strong> ${res.adminNote}</div>` : ''}
                ${adminReplyHtml}
                ${studentLinksHtml}
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
                // For approvals, allow partial slot acceptance based on persisted selection map
                let updatedSlots = target.slots;
                const resKey = target._id || `local-${idx}`;
                
                if (newStatus === 'approved' && Array.isArray(target.slots) && target.slots.length > 0) {
                    const selection = window.pendingSlotSelections[resKey] || target.slots.map((_, i) => i);
                    updatedSlots = target.slots.filter((slot, i) => selection.includes(i));
                    
                    if (updatedSlots.length === 0) {
                        window.showDialog({
                            title: window.t('error') || 'Erreur',
                            message: window.t('selectAtLeastOne') || 'Veuillez sélectionner au moins un créneau à valider.',
                            buttons: [{ text: 'OK', class: 'btn-secondary w-100' }]
                        });
                        return;
                    }
                }
                try {
                    await fetch(`/api/reservations/${target._id}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ status: newStatus, slots: updatedSlots })
                    });
                    delete window.pendingSlotSelections[resKey];
                    await window.fetchReservations();
                } catch(e) { console.error(e); }
            } else if (target) {
                const resKey = target._id || `local-${idx}`;
                
                if (newStatus === 'approved' && Array.isArray(target.slots) && target.slots.length > 0) {
                    const selection = window.pendingSlotSelections[resKey] || target.slots.map((_, i) => i);
                    target.slots = target.slots.filter((slot, i) => selection.includes(i));
                    
                    if (target.slots.length === 0) {
                        window.showDialog({
                            title: window.t('error') || 'Erreur',
                            message: window.t('selectAtLeastOne') || 'Veuillez sélectionner au moins un créneau à valider.',
                            buttons: [{ text: 'OK', class: 'btn-secondary w-100' }]
                        });
                        return;
                    }
                }
                target.status = newStatus;
                delete window.pendingSlotSelections[resKey];
                localStorage.setItem('reservations', JSON.stringify(reservations));
                window.dispatchEvent(new Event('reservationsUpdated'));
            }
        }));
    });

    // Live toggle slots within a pending reservation (delegated so it survives re-renders)
    document.addEventListener('change', async (e) => {
        const cb = e.target;

        // Handle "Select All" toggle
        if (cb.classList.contains('select-all-slots-toggle')) {
            e.stopPropagation();
            const resIndex = parseInt(cb.dataset.resIndex, 10);
            const isChecked = cb.checked;
            
            const card = cb.closest('.admin-res-card');
            const slotCheckboxes = Array.from(card.querySelectorAll('.slot-checkbox'));
            
            slotCheckboxes.forEach(box => {
                box.checked = isChecked;
                const lbl = box.closest('.slot-check-label');
                if (lbl) {
                    if (isChecked) lbl.classList.remove('slot-unchecked');
                    else lbl.classList.add('slot-unchecked');
                }
            });

            const summaryEl = card.querySelector('.slot-summary-text');
            if (summaryEl) {
                const total = parseInt(summaryEl.dataset.total, 10);
                const selCount = isChecked ? total : 0;
                summaryEl.innerText = window.t('slotsSelected') ? window.t('slotsSelected').replace('{selected}', selCount).replace('{total}', total) : `${selCount} slot(s) selected out of ${total}`;
            }

            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const target = reservations[resIndex];
            if (!target || !Array.isArray(target.slots)) return;
            const resKey = target._id || `local-${resIndex}`;
            window.pendingSlotSelections[resKey] = isChecked ? target.slots.map((_, i) => i) : [];
            if (window.adminSchedule) window.adminSchedule.refresh(document.getElementById('admin-search') ? document.getElementById('admin-search').value : '');
            return;
        }

        if (!cb.classList.contains('slot-checkbox')) return;
        e.stopPropagation();

        const resIndex = parseInt(cb.dataset.resIndex, 10);
        const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
        const target = reservations[resIndex];
        if (!target || !Array.isArray(target.slots)) return;

        const card = cb.closest('.admin-res-card');
        const related = Array.from(card.querySelectorAll('.slot-checkbox'));
        const keepIndexes = related.filter(box => box.checked).map(box => parseInt(box.dataset.slotIndex, 10));

        const resKey = target._id || `local-${resIndex}`;
        window.pendingSlotSelections[resKey] = keepIndexes;

        // Visually mark unchecked labels (but keep them so user can re-check)
        related.forEach((box) => {
            const i = parseInt(box.dataset.slotIndex, 10);
            const lbl = box.closest('.slot-check-label');
            if (!lbl) return;
            if (keepIndexes.includes(i)) lbl.classList.remove('slot-unchecked');
            else lbl.classList.add('slot-unchecked');
        });
        
        const summaryEl = card.querySelector('.slot-summary-text');
        if (summaryEl) {
            const total = parseInt(summaryEl.dataset.total, 10);
            const selCount = keepIndexes.length;
            summaryEl.innerText = window.t('slotsSelected') ? window.t('slotsSelected').replace('{selected}', selCount).replace('{total}', total) : `${selCount} slot(s) selected out of ${total}`;
        }

        // Update "Select All" toggle state if individual slots change
        const selectAllToggle = card.querySelector('.select-all-slots-toggle');
        if (selectAllToggle) {
            const allChecked = related.every(box => box.checked);
            selectAllToggle.checked = allChecked;
        }
        if (window.adminSchedule) window.adminSchedule.refresh(document.getElementById('admin-search') ? document.getElementById('admin-search').value : '');
    });

    // Handle Add Link
    document.querySelectorAll('.add-link-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = e.currentTarget.getAttribute('data-email');
        document.getElementById('link-student-email').value = email;
        document.getElementById('edit-link-index').value = '';
        document.getElementById('link-name').value = '';
        document.getElementById('link-url').value = '';
        document.getElementById('add-link-modal').style.display = 'flex';
    }));

    // Handle Edit Link
    document.querySelectorAll('.edit-link-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('link-student-email').value = e.currentTarget.getAttribute('data-email') || '';
        document.getElementById('edit-link-index').value = e.currentTarget.getAttribute('data-link-index') || '';
        document.getElementById('link-name').value = e.currentTarget.getAttribute('data-link-name') || '';
        document.getElementById('link-url').value = e.currentTarget.getAttribute('data-link-url') || '';
        document.getElementById('add-link-modal').style.display = 'flex';
    }));

    // Handle Remove Link
    document.querySelectorAll('.remove-link-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const email = e.currentTarget.getAttribute('data-email');
        const linkIndex = parseInt(e.currentTarget.getAttribute('data-link-index'), 10);
        const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
        const targetRes = reservations.find(r => r.email === email);
        if (!targetRes || !targetRes.studentLinks) return;
        const currentLinks = [...targetRes.studentLinks];
        currentLinks.splice(linkIndex, 1);
        try {
            await fetch(`/api/student-links/${encodeURIComponent(email)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ links: currentLinks }) });
            await window.fetchReservations();
        } catch(err) { console.error(err); }
    }));

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
    const isExplicitWeekly = res.recurring === 'weekly' && !res.endDate;
    document.getElementById('edit-enddate-group').style.display = (res.recurring === 'weekly' && !isExplicitWeekly) ? 'block' : 'none';
    document.getElementById('edit-enddate').value = res.endDate || '';
    document.getElementById('edit-weeks').value = '';
    document.getElementById('edit-message').value = res.message || '';
    
    if (isAdmin) {
        document.getElementById('edit-admin-note-group').style.display = 'block';
        document.getElementById('edit-admin-reply-group').style.display = 'block';
        document.getElementById('edit-adminnote').value = res.adminNote || '';
        document.getElementById('edit-adminreply').value = res.adminReply || '';
    } else {
        document.getElementById('edit-admin-note-group').style.display = 'none';
        document.getElementById('edit-admin-reply-group').style.display = 'none';
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
                const dailyStr = r.recurring === 'daily' ? ' (Daily)' : '';
                opt.innerText = `${r.startDate}${r.startTime ? ' ' + r.startTime : ''} to ${r.endDate}${r.endTime ? ' ' + r.endTime : ''}${dailyStr}${r.message ? ' (' + r.message + ')' : ''}`;
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
        
        if (res.recurring === 'daily') {
            document.getElementById('block-daily').checked = true;
        } else {
            document.getElementById('block-continuous').checked = true;
        }
        
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
        document.getElementById('block-continuous').checked = true;
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
                adminProfile: window.getSelectedProfile(),
                fname: "Vacation", lname: "Block", email: "", phone: "", status: "blocked", recurring: document.querySelector('input[name="block-type"]:checked').value,
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
        if (document.getElementById('edit-admin-note-group').style.display !== 'none') {
            updatedData.adminNote = document.getElementById('edit-adminnote').value;
            updatedData.adminReply = document.getElementById('edit-adminreply').value;
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

    const addLinkModal = document.getElementById('add-link-modal');
    if (addLinkModal) {
        document.getElementById('close-link-modal')?.addEventListener('click', () => addLinkModal.style.display = 'none');
        
        document.getElementById('add-link-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('link-student-email').value;
            const name = document.getElementById('link-name').value;
            const url = document.getElementById('link-url').value;
            const editIndex = document.getElementById('edit-link-index').value;
            
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const targetRes = reservations.find(r => r.email === email);
            const currentLinks = targetRes && targetRes.studentLinks ? [...targetRes.studentLinks] : [];
            
            let isNew = false;
            if (editIndex !== "") {
                currentLinks[parseInt(editIndex, 10)] = { name, url };
            } else {
                currentLinks.push({ name, url });
                isNew = true; // Only notify the student if it's an entirely new link
            }

            try {
                await fetch(`/api/student-links/${encodeURIComponent(email)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ links: currentLinks, notifyStudent: isNew, adminProfile: window.getSelectedProfile() })
                });
                await window.fetchReservations();
            } catch(err) { console.error(err); }
            
            addLinkModal.style.display = 'none';
        });
    }

    // Handle Right Click Context Menu
    let contextTargetId = null;
    let contextTargetSlotIndex = null;
    document.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.admin-res-card') || e.target.closest('.slot-card[data-res-index]');
        if (card && localStorage.getItem('currentUser') === 'admin') {
            e.preventDefault();
            const resIndex = parseInt(card.getAttribute('data-res-index'), 10);
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const target = reservations[resIndex];
            if (target && target._id) {
                contextTargetId = target._id;
                contextTargetSlotIndex = card.classList.contains('slot-card') ? parseInt(card.getAttribute('data-slot-index'), 10) : null;
                const menu = document.getElementById('admin-context-menu');
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
            }
        }
    });

    document.addEventListener('click', () => {
        const menu = document.getElementById('admin-context-menu');
        if (menu) menu.style.display = 'none';
    });

    document.getElementById('context-btn-done')?.addEventListener('click', async () => {
        if (!contextTargetId) return;
        try {
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const targetRes = reservations.find(r => r._id === contextTargetId);
            if (!targetRes) return;
            
            let bodyData = {};
            if (contextTargetSlotIndex !== null && !isNaN(contextTargetSlotIndex) && targetRes.slots) {
                const slots = [...targetRes.slots];
                if(slots[contextTargetSlotIndex]) {
                    slots[contextTargetSlotIndex].classDone = true;
                    bodyData = { slots };
                }
            } else {
                bodyData = { classDone: true };
                if (targetRes.slots) bodyData.slots = targetRes.slots.map(s => ({ ...s, classDone: true }));
            }
            
            await fetch(`/api/reservations/${contextTargetId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(bodyData) });
            await window.fetchReservations();
        } catch(err) { console.error(err); }
    });

    document.getElementById('context-btn-not-done')?.addEventListener('click', async () => {
        if (!contextTargetId) return;
        try {
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const targetRes = reservations.find(r => r._id === contextTargetId);
            if (!targetRes) return;
            
            let bodyData = {};
            if (contextTargetSlotIndex !== null && !isNaN(contextTargetSlotIndex) && targetRes.slots) {
                const slots = [...targetRes.slots];
                if(slots[contextTargetSlotIndex]) { slots[contextTargetSlotIndex].classDone = false; bodyData = { slots, classDone: false }; }
            } else {
                bodyData = { classDone: false };
                if (targetRes.slots) bodyData.slots = targetRes.slots.map(s => ({ ...s, classDone: false }));
            }
            
            await fetch(`/api/reservations/${contextTargetId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(bodyData) });
            await window.fetchReservations();
        } catch(err) { console.error(err); }
    });

    document.getElementById('context-btn-delete')?.addEventListener('click', () => {
        if (!contextTargetId) return;
        window.showDialog({
            title: window.t('eraseCompletely'), message: window.t('cancelResConf'),
            buttons: [
                { text: window.t('yesCancel'), class: 'btn-danger w-100', onClick: async () => {
                    try {
                        await fetch(`/api/reservations/${contextTargetId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
                        await window.fetchReservations();
                    } catch(err) { console.error(err); }
                }},
                { text: window.t('noKeep'), class: 'btn-secondary w-100' }
            ]
        });
    });

    document.getElementById('btn-client-db')?.addEventListener('click', async () => {
        const modal = document.getElementById('client-db-modal');
        const tbody = document.getElementById('client-db-tbody');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Chargement...</td></tr>`;
        modal.style.display = 'flex';

        try {
            const response = await fetch('/api/clients', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (!response.ok) throw new Error('Failed to fetch clients');
            const clients = await response.json();
            
            if (clients.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">${window.t('empty')}</td></tr>`;
                return;
            }

            tbody.innerHTML = clients.map(c => {
                const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
                const dateStr = new Date(c.lastActive).toLocaleDateString(window.currentLang === 'fr' ? 'fr-FR' : 'en-US', dateOptions);
                return `
                    <tr>
                        <td class="fw-bold">${c.fname} ${c.lname}</td>
                        <td>
                            ${c.email ? `<div><small>📧 ${c.email}</small></div>` : ''}
                            ${c.phone ? `<div><small>📞 ${c.phone}</small></div>` : ''}
                        </td>
                        <td class="text-center"><span class="badge bg-primary rounded-pill">${c.totalReservations}</span></td>
                        <td><small class="text-muted">${dateStr}</small></td>
                        <td class="text-center no-print"><button class="btn btn-sm btn-outline-info generate-summary-btn" data-email="${c.email}" data-phone="${c.phone}">${window.t('summaryBtn')}</button></td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Erreur de chargement</td></tr>`;
        }
    });

    // Handle Generate Summary Button Clicks
    document.getElementById('client-db-tbody')?.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('generate-summary-btn')) return;
        const email = e.target.getAttribute('data-email');
        const phone = e.target.getAttribute('data-phone');
        
        let allClientRes = [];
        try {
            const queryVal = email ? email : phone;
            const endpoint = email ? 'reservations-by-email' : 'reservations-by-phone';
            const resQuery = await fetch(`/api/${endpoint}/${encodeURIComponent(queryVal)}?adminProfile=${window.getSelectedProfile()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            allClientRes = await resQuery.json();
        } catch(err) { console.error(err); return; }
        
        const summaryModal = document.getElementById('monthly-summary-modal');
        const modalTitle = document.getElementById('summary-modal-title');
        if (modalTitle) modalTitle.innerText = `${window.t('monthlySummary')} - ${e.target.closest('tr').querySelector('.fw-bold').innerText}`;
        
        const emailBtn = document.getElementById('email-summary-btn');
        if (emailBtn) {
            emailBtn.style.display = email ? 'block' : 'none';
            emailBtn.setAttribute('data-email', email || '');
        }
        
        summaryModal.style.display = 'flex';
        
        const now = new Date();
        const monthPicker = document.getElementById('summary-month-picker');
        monthPicker.value = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
        
        const renderSummary = () => {
            const selectedMonthStr = monthPicker.value; // "YYYY-MM"
            if (!selectedMonthStr) return;
            const [yearStr, monthStr] = selectedMonthStr.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            
            const doneClasses = [];
            allClientRes.forEach(r => {
                if (r.slots && r.slots.length > 0) {
                    r.slots.forEach(s => {
                        const isDone = s.classDone || r.classDone;
                        if (isDone && s.fullDate) {
                            const d = new Date(s.fullDate);
                            if (d.getFullYear() === year && (d.getMonth() + 1) === month) doneClasses.push({ date: d, time: s.time, type: r.recurring, resId: r.resId, fname: r.fname, lname: r.lname });
                        }
                    });
                } else if (r.startDate) {
                    if (r.classDone) {
                        const d = new Date(r.startDate);
                        if (d.getFullYear() === year && (d.getMonth() + 1) === month) doneClasses.push({ date: d, time: r.startTime, type: r.recurring, resId: r.resId, fname: r.fname, lname: r.lname });
                    }
                }
            });
            
            doneClasses.sort((a,b) => a.date - b.date);
            window.currentSummaryCSVData = doneClasses;
            window.currentSummaryIsGlobal = false;
            const container = document.getElementById('summary-results');
            if (doneClasses.length === 0) {
                container.innerHTML = `<p class="text-muted text-center py-4">${window.t('noClassesDone')}</p>`;
            } else {
                let html = `
                    <div class="text-center mb-4 d-none d-print-block">
                        <h2 class="fw-bold text-primary mb-1">Rapport d'Activité Étudiant</h2>
                        <p class="text-muted">${month}/${year} - Étudiant: ${allClientRes[0].fname} ${allClientRes[0].lname} - Coach: ${window.getSelectedProfile()}</p>
                        <hr>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-bordered table-striped align-middle">
                            <thead class="table-light">
                                <tr><th>Date</th><th>Heure</th><th>Type</th><th>${window.t('resIdStr') || 'ID Réservation'}</th></tr>
                            </thead>
                            <tbody>
                `;
                doneClasses.forEach(c => {
                    html += `<tr>
                        <td><strong>${c.date.toLocaleDateString(window.currentLang==='fr'?'fr-FR':'en-US', {weekday: 'short', day:'2-digit', month:'short', year:'numeric'})}</strong></td>
                        <td>${c.time || ''}</td>
                        <td>${c.type === 'weekly' ? window.t('weekly') : window.t('oneTime')}</td>
                        <td><small class="text-muted font-monospace">${c.resId || 'N/A'}</small></td>
                    </tr>`;
                });
                html += `</tbody></table></div>
                    <div class="d-flex justify-content-between align-items-center mt-4 p-3 bg-light rounded border">
                        <span class="fw-bold text-dark">${window.t('totalClasses')}</span>
                        <span class="fs-4 fw-bold text-success">${doneClasses.length}</span>
                    </div>
                    <div class="text-center mt-3 small text-muted">
                        <p><em>${window.t('disclaimerBill')}</em></p>
                    </div>`;
                container.innerHTML = html;
            }
        };
        
        monthPicker.onchange = renderSummary;
        renderSummary();
    });

    // Handle Global Monthly Summary Button
    document.getElementById('btn-global-summary')?.addEventListener('click', () => {
        const summaryModal = document.getElementById('monthly-summary-modal');
        const modalTitle = document.getElementById('summary-modal-title');
        if (modalTitle) modalTitle.innerText = window.t('globalSummaryBtn') || 'Résumé Mensuel Global';
        
        const emailBtn = document.getElementById('email-summary-btn');
        if (emailBtn) emailBtn.style.display = 'none'; // Hide email button for global summary
        
        summaryModal.style.display = 'flex';
        
        const now = new Date();
        const monthPicker = document.getElementById('summary-month-picker');
        monthPicker.value = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
        
        const renderSummary = () => {
            const selectedMonthStr = monthPicker.value; // "YYYY-MM"
            if (!selectedMonthStr) return;
            const [yearStr, monthStr] = selectedMonthStr.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            
            const allRes = JSON.parse(localStorage.getItem('reservations')) || [];
            const doneClasses = [];
            
            allRes.forEach(r => {
                if (r.slots && r.slots.length > 0) {
                    r.slots.forEach(s => {
                        const isDone = s.classDone || r.classDone;
                        if (isDone && s.fullDate) {
                            const d = new Date(s.fullDate);
                            if (d.getFullYear() === year && (d.getMonth() + 1) === month) doneClasses.push({ date: d, time: s.time, type: r.recurring, fname: r.fname, lname: r.lname, resId: r.resId });
                        }
                    });
                } else if (r.startDate) {
                    if (r.classDone) {
                        const d = new Date(r.startDate);
                        if (d.getFullYear() === year && (d.getMonth() + 1) === month) doneClasses.push({ date: d, time: r.startTime, type: r.recurring, fname: r.fname, lname: r.lname, resId: r.resId });
                    }
                }
            });
            
            doneClasses.sort((a,b) => a.date - b.date);
            window.currentSummaryCSVData = doneClasses;
            window.currentSummaryIsGlobal = true;
            const container = document.getElementById('summary-results');
            if (doneClasses.length === 0) {
                container.innerHTML = `<p class="text-muted text-center py-4">${window.t('noClassesDone')}</p>`;
            } else {
                let html = `
                    <div class="text-center mb-4 d-none d-print-block">
                        <h2 class="fw-bold text-primary mb-1">Rapport de Facturation / Activity Report</h2>
                        <p class="text-muted">${month}/${year} - Coach: ${window.getSelectedProfile()}</p>
                        <hr>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-bordered table-striped align-middle">
                            <thead class="table-light">
                                <tr><th>Date</th><th>Heure</th><th>Étudiant</th><th>Type</th><th>${window.t('resIdStr') || 'ID Réservation'}</th></tr>
                            </thead>
                            <tbody>
                `;
                doneClasses.forEach(c => {
                    html += `<tr>
                        <td><strong>${c.date.toLocaleDateString(window.currentLang==='fr'?'fr-FR':'en-US', {weekday: 'short', day:'2-digit', month:'short', year:'numeric'})}</strong></td>
                        <td>${c.time || ''}</td>
                        <td>${c.fname} ${c.lname}</td>
                        <td>${c.type === 'weekly' ? window.t('weekly') : window.t('oneTime')}</td>
                        <td><small class="text-muted font-monospace">${c.resId || 'N/A'}</small></td>
                    </tr>`;
                });
                html += `</tbody></table></div>
                    <div class="d-flex justify-content-between align-items-center mt-4 p-3 bg-light rounded border">
                        <span class="fw-bold text-dark">${window.t('totalClasses')}</span>
                        <span class="fs-4 fw-bold text-success">${doneClasses.length}</span>
                    </div>
                    <div class="text-center mt-3 small text-muted">
                        <p><em>${window.t('disclaimerBill')}</em></p>
                    </div>`;
                container.innerHTML = html;
            }
        };
        monthPicker.onchange = renderSummary;
        renderSummary();
    });
    
    // Handle CSV Export
    document.getElementById('csv-summary-btn')?.addEventListener('click', () => {
        if (!window.currentSummaryCSVData || window.currentSummaryCSVData.length === 0) return;
        
        const rows = [];
        const isGlobal = window.currentSummaryIsGlobal;
        const monthVal = document.getElementById('summary-month-picker').value;
        let fileName = `rapport_${monthVal}.csv`;
        
        if (isGlobal) {
            rows.push(["Date", "Heure", "Etudiant", "Type", "ID Reservation"]);
        } else {
            rows.push(["Date", "Heure", "Type", "ID Reservation"]);
            if (window.currentSummaryCSVData[0].fname) {
                const studentName = `${window.currentSummaryCSVData[0].fname}_${window.currentSummaryCSVData[0].lname}`.replace(/\s+/g, '_');
                fileName = `rapport_${monthVal}_${studentName}.csv`;
            }
        }
        
        window.currentSummaryCSVData.forEach(c => {
            const dateStr = c.date.toLocaleDateString(window.currentLang==='fr'?'fr-FR':'en-US', {weekday: 'short', day:'2-digit', month:'short', year:'numeric'});
            const typeStr = c.type === 'weekly' ? window.t('weekly') : window.t('oneTime');
            if (isGlobal) {
                rows.push([`"${dateStr}"`, `"${c.time || ''}"`, `"${c.fname} ${c.lname}"`, `"${typeStr}"`, `"${c.resId || ''}"`]);
            } else {
                rows.push([`"${dateStr}"`, `"${c.time || ''}"`, `"${typeStr}"`, `"${c.resId || ''}"`]);
            }
        });
        
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
    
    // Handle Send Email Button
    document.getElementById('email-summary-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const email = btn.getAttribute('data-email');
        if (!email) return;

        const summaryHtml = document.getElementById('summary-results').innerHTML;
        const monthVal = document.getElementById('summary-month-picker').value;
        
        btn.disabled = true;
        
        // Safely preserve button text structure without unbinding
        const iconHtml = '<i class="bi bi-envelope-paper me-2"></i>';
        const originalLabel = btn.querySelector('span') ? btn.querySelector('span').innerText : window.t('sendEmailBtn');
        btn.innerHTML = `<i class="bi bi-hourglass-split me-2"></i> <span>Envoi...</span>`;

        try {
            await fetch('/api/send-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ 
                    targetEmail: email, 
                    month: monthVal,
                    htmlContent: summaryHtml,
                    adminProfile: window.getSelectedProfile()
                })
            });
            window.showDialog({ title: window.t('success'), message: window.t('emailSentSuccess') || 'Envoyé', buttons: [{ text: window.t('ok'), class: 'btn-success w-100' }] });
        } catch(err) {
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `${iconHtml} <span>${originalLabel}</span>`;
        }
    });

    document.getElementById('close-summary-modal')?.addEventListener('click', () => { document.getElementById('monthly-summary-modal').style.display = 'none'; });
    document.getElementById('close-client-db-modal')?.addEventListener('click', () => {
        document.getElementById('client-db-modal').style.display = 'none';
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
                    window.adminSchedule.goToDate(new Date(`${activeRes.startDate}T00:00:00`));
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
