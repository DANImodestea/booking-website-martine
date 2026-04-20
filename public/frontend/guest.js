// Global Guest Highlight Tracker
window.activeGuestResIndex = null;

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

    const allLinks = [];
    const seenUrls = new Set();
    mappedRes.forEach(res => {
        if (res.studentLinks && res.studentLinks.length > 0) {
            res.studentLinks.forEach(link => {
                if (!seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    allLinks.push(link);
                }
            });
        }
    });

    const linksSection = document.getElementById('guest-links-section');
    const linksContainer = document.getElementById('guest-links-container');

    if (mappedRes.length > 0 || allLinks.length > 0) {
        guestDashboard.style.display = 'block';
        
        if (linksSection && linksContainer) {
            if (allLinks.length > 0) {
                linksContainer.innerHTML = allLinks.map(l => 
                    `<a href="${l.url}" target="_blank" class="btn btn-outline-primary btn-sm fw-bold rounded-pill shadow-sm mb-1">🔗 ${l.name}</a>`
                ).join('');
                linksSection.style.display = 'block';
            } else {
                linksSection.style.display = 'none';
            }
        }
        
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

        if (mappedRes.length > 0) {
        listContainer.innerHTML = mappedRes.reverse().map(res => {
            const slotsHtml = res.slots && res.slots.length > 0 ? res.slots.map(s => {
                const sDoneMark = (s.classDone || res.classDone) ? ' <span class="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle ms-1" style="width: 14px; height: 14px; font-size: 10px; line-height: 1;">✓</span>' : '';
                return `<span class="badge bg-light text-dark border me-1 mb-1">${getDisplayDate(s.fullDate, s.day)} @ ${getDisplayTime(s.time)}${sDoneMark}</span>`;
            }).join(' ') : '';
            let statusBadge = 'bg-warning text-dark';
            if (res.status === 'approved' || res.status === 'accept') statusBadge = 'bg-success';
            if (res.status === 'rejected' || res.status === 'reject' || res.status === 'cancelled') statusBadge = 'bg-danger text-white';
            let cancelBtn = (res.status === 'pending' || res.status === 'approved') 
                ? `<button class="btn btn-sm btn-outline-danger mt-2 w-100 guest-cancel-btn" data-index="${res.originalIndex}">${window.t('cancelRes')}</button>` : '';
            
            let editBtn = (res.status !== 'rejected' && res.status !== 'cancelled') ? `<button class="btn btn-sm btn-outline-primary mt-2 w-100 guest-edit-toggle-btn fw-bold" data-index="${res.originalIndex}">${window.t('editDetails')}</button>` : '';
            
            const statusBgClass = res.status === 'approved' ? 'status-approved-bg' 
                : (res.status === 'rejected' || res.status === 'cancelled') ? 'status-rejected-bg' 
                : 'status-pending-bg';

            const linksHtml = (res.studentLinks && res.studentLinks.length > 0) ? `
                <div class="mt-2 pt-2 border-top">
                    <strong class="small text-primary">Mes Liens:</strong>
                    <ul class="list-unstyled small mb-0">
                        ${res.studentLinks.map(l => `<li><a href="${l.url}" target="_blank" class="text-decoration-none fw-bold" onclick="event.stopPropagation()"><i class="bi bi-link-45deg"></i> ${l.name}</a></li>`).join('')}
                    </ul>
                </div>
            ` : '';
            
            let adminReplyHtml = '';
            if (res.adminReply) {
                const hasRead = localStorage.getItem(`read_msg_${res.resId}`) === 'true';
                const badgeHtml = !hasRead ? `<span class="position-absolute top-0 start-100 translate-middle d-flex align-items-center justify-content-center bg-danger text-white border border-light rounded-circle shadow-sm" id="badge-msg-${res.originalIndex}" style="width: 22px; height: 22px; font-size: 11px;" title="Nouveau message"><i class="bi bi-envelope-fill"></i></span>` : '';
                adminReplyHtml = `
                    <div class="mt-3 border-top pt-2">
                        <button class="btn btn-sm btn-outline-info w-100 position-relative fw-bold guest-msg-toggle-btn" data-index="${res.originalIndex}" data-resid="${res.resId}">
                            <i class="bi bi-envelope me-1"></i> ${window.t('viewMessage')}
                            ${badgeHtml}
                        </button>
                        <div id="msg-box-${res.originalIndex}" class="mt-2 p-2 bg-info bg-opacity-10 border border-info rounded" style="display: none;">
                            <strong class="small text-info"><i class="bi bi-chat-left-text text-info me-1"></i> ${window.t('coachReply')}</strong>
                            <p class="small mb-0 mt-1 fw-bold">${res.adminReply}</p>
                        </div>
                    </div>
                `;
            }
            const allSlotsDone = res.slots && res.slots.length > 0 && res.slots.every(s => s.classDone);
            const isFullyDone = res.classDone || allSlotsDone;
            const doneBadge = isFullyDone ? `<span class="ms-2 d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle shadow-sm" style="width: 18px; height: 18px; font-size: 12px;" title="Cours effectué">✓</span>` : '';

            return `<div class="col-12"><div class="card shadow-sm border-0 h-100 guest-res-card ${statusBgClass}" data-res-index="${res.originalIndex}" style="cursor:pointer; transition: all 0.2s;"><div class="card-body">
                <div class="d-flex justify-content-between mb-2"><strong class="text-success">${res.fname} ${res.lname} <span class="badge bg-light text-secondary border ms-2 font-monospace">${res.resId || ''}</span>${doneBadge}</strong><span class="badge ${statusBadge}">${res.status.toUpperCase()}</span></div>
                <div class="small mb-2"><strong>${window.t('type')}:</strong> ${res.recurring === 'weekly' ? window.t('weekly') : window.t('oneTime')} ${res.endDate ? `(${window.t('until')} ${res.endDate})` : ''}</div>
                <div class="small"><strong>${window.t('slots')}:</strong><br>${slotsHtml}</div>
                ${adminReplyHtml}
                ${linksHtml}
                ${editBtn}
                ${cancelBtn}
            </div></div></div>`;
        }).join('');
        } else {
            listContainer.innerHTML = `<div class="text-muted small">${window.t('empty') || 'Vide'}</div>`;
        }

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
            e.stopPropagation();
            window.openEditModal(e.target.getAttribute('data-index'), false);
        }));

        document.querySelectorAll('.guest-res-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a')) return;
                const idx = parseInt(card.getAttribute('data-res-index'));
                window.activeGuestResIndex = (window.activeGuestResIndex === idx) ? null : idx;
                window.dispatchEvent(new Event('guestHighlightChange'));
            });
        });

        document.querySelectorAll('.guest-msg-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = e.currentTarget.getAttribute('data-index');
            const resId = e.currentTarget.getAttribute('data-resid');
            const box = document.getElementById(`msg-box-${idx}`);
            const badge = document.getElementById(`badge-msg-${idx}`);
            
            if (box.style.display === 'none') {
                box.style.display = 'block';
                if (badge) badge.style.display = 'none';
                localStorage.setItem(`read_msg_${resId}`, 'true');
            } else {
                box.style.display = 'none';
            }
        }));
    } else {
        guestDashboard.style.display = 'none';
        listContainer.innerHTML = '';
    }
};

window.addEventListener('guestHighlightChange', () => {
    document.querySelectorAll('.guest-res-card').forEach(card => {
        if (parseInt(card.getAttribute('data-res-index')) === window.activeGuestResIndex) {
            card.classList.add('border-success', 'shadow');
            card.style.transform = 'scale(1.02)';
        } else {
            card.classList.remove('border-success', 'shadow');
            card.style.transform = 'none';
        }
    });
    
    if (window.guestSchedule && document.getElementById('guest-view').style.display === 'block') {
        window.guestSchedule.refresh();
        setTimeout(() => {
            const highlightedSlot = document.querySelector('#schedule-grid .highlight-slot');
            if (highlightedSlot) highlightedSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 50);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    let selectedSlots = [];

    window.modalController = initModal(async (clientData, slotsToBook) => {
        const selectedProfile = window.getSelectedProfile();
        
        let expandedSlots = [];
        const baseSlot = slotsToBook[0];
        if (baseSlot) {
            const baseDate = new Date(baseSlot.dataset.fullDate);
            const numWeeks = clientData.numWeeks || 1;
            
            for (let i = 0; i < numWeeks; i++) {
                const nextDate = new Date(baseDate);
                nextDate.setDate(baseDate.getDate() + (i * 7));
                
                const lang = window.currentLang === 'fr' ? 'fr-FR' : 'en-US';
                const dayOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' };
                const dayStr = nextDate.toLocaleDateString(lang, dayOptions).replace(/\b\w/g, c => c.toUpperCase());
                
                expandedSlots.push({
                    day: dayStr,
                    time: baseSlot.dataset.time,
                    fullDate: nextDate.toISOString()
                });
            }
        }
        
        delete clientData.numWeeks; // Remove temporary field before sending

        const newRes = { 
            ...clientData, 
            adminProfile: selectedProfile, // 👈 NEW: Add selected admin profile
            status: 'pending', 
            slots: expandedSlots
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