function initSchedule(gridElementId, navIds, onSlotClickCallback, onWeekChangeCallback = () => {}) {
    const scheduleGrid = document.getElementById(gridElementId);
    const prevBtn = document.getElementById(navIds.prev);
    const nextBtn = document.getElementById(navIds.next);
    const weekDisplay = document.getElementById(navIds.display);
    const todayBtn = navIds.today ? document.getElementById(navIds.today) : null;
    
    let activeSearchTerm = '';
    let currentWeekStart = getMonday(new Date());
    const todayWeekStart = getMonday(new Date());
    let currentViewDays = [];

    function getMonday(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(date.setDate(diff));
        mon.setHours(0, 0, 0, 0); // Force strictly to midnight local time
        return mon;
    }

    function formatDateForHeader(date) {
        const lang = window.currentLang === 'fr' ? 'fr-FR' : 'en-US';
        const str = date.toLocaleDateString(lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' });
        return str.replace(/\b\w/g, c => c.toUpperCase());
    }

    function triggerFlashAnimation() {
        scheduleGrid.classList.remove('flash-animation');
        void scheduleGrid.offsetWidth; // trigger reflow
        scheduleGrid.classList.add('flash-animation');
    }

    function goToDate(d) {
        const targetMonday = getMonday(d);
        if (currentWeekStart.getTime() !== targetMonday.getTime()) {
            currentWeekStart = targetMonday;
            renderGrid(activeSearchTerm);
            triggerFlashAnimation();
            if (onWeekChangeCallback) onWeekChangeCallback();
        } else {
            renderGrid(activeSearchTerm);
        }
    }

    const hours = [
        "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
        "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", 
        "06:00 PM", "07:00 PM", "08:00 PM"
    ];
    
    function updateCurrentTimeLine() {
        const oldLine = scheduleGrid.querySelector('.current-time-line');
        if (oldLine) oldLine.remove();

        if (currentWeekStart.getTime() !== todayWeekStart.getTime()) return;

        const now = new Date();
        const currentHour = now.getHours();
        if (currentHour >= 8 && currentHour <= 20) {
            const hourIndex = currentHour - 8;
            const timeLabels = scheduleGrid.querySelectorAll('.time-label');
            if (timeLabels.length > hourIndex + 1) {
                const labelElement = timeLabels[hourIndex + 1];
                
                requestAnimationFrame(() => {
                    const topPos = labelElement.offsetTop;
                    const rowHeight = labelElement.offsetHeight;
                    const minFraction = now.getMinutes() / 60;
                    const exactY = topPos + (rowHeight * minFraction);

                    const line = document.createElement('div');
                    line.className = 'current-time-line';
                    line.style.position = 'absolute';
                    line.style.top = exactY + 'px';
                    line.style.left = '80px'; 
                    line.style.right = '0';
                    line.style.height = '0';
                    line.style.borderTop = '2px dashed rgba(220, 53, 69, 0.6)';
                    line.style.zIndex = '5';
                    line.style.pointerEvents = 'none'; 
                    
                    const tooltipArea = document.createElement('div');
                    tooltipArea.style.position = 'absolute';
                    tooltipArea.style.right = '10px';
                    tooltipArea.style.top = '-11px';
                    tooltipArea.style.padding = '2px 6px';
                    tooltipArea.style.background = 'rgba(220, 53, 69, 0.9)';
                    tooltipArea.style.color = '#fff';
                    tooltipArea.style.fontSize = '11px';
                    tooltipArea.style.borderRadius = '4px';
                    tooltipArea.style.pointerEvents = 'auto';
                    tooltipArea.style.cursor = 'help';
                    tooltipArea.style.fontWeight = 'bold';
                    tooltipArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    
                    const timeStr = window.currentLang === 'fr' ? 
                        `${currentHour.toString().padStart(2, '0')}h${now.getMinutes().toString().padStart(2, '0')}` : 
                        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    
                    tooltipArea.innerText = timeStr;
                    tooltipArea.title = window.currentLang === 'fr' ? 'Heure actuelle' : 'Current time';
                    
                    line.appendChild(tooltipArea);
                    scheduleGrid.style.position = 'relative';
                    scheduleGrid.appendChild(line);
                });
            }
        }
    }

    function renderGrid(searchTerm) {
        if (typeof searchTerm === 'string') {
            activeSearchTerm = searchTerm.toLowerCase();
        }

        scheduleGrid.innerHTML = '';
        
        const currentUser = localStorage.getItem('currentUser');
        const isAdmin = currentUser === 'admin';

        // Calculate days for the current week
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        
        currentViewDays = days;

        // Update Week Display Title
        if (weekDisplay) {
            const lang = window.currentLang === 'fr' ? 'fr-FR' : 'en-US';
            const dateOptions = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Europe/Paris' };
            weekDisplay.innerText = `${days[0].toLocaleDateString(lang, dateOptions)} - ${days[6].toLocaleDateString(lang, dateOptions)}`;
        }

        if (nextBtn) {
            const weeksDiff = Math.round((currentWeekStart.getTime() - todayWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
            if (!isAdmin && weeksDiff >= 4) {
                nextBtn.style.visibility = 'hidden';
            } else {
                nextBtn.style.visibility = 'visible';
            }
        }

        if (todayBtn) {
            todayBtn.style.display = (currentWeekStart.getTime() === todayWeekStart.getTime()) ? 'none' : 'block';
        }

        // 1. Create top-left empty corner cell
        const corner = document.createElement('div');
        corner.classList.add('grid-header', 'time-label');
        scheduleGrid.appendChild(corner);

        function getDisplayTime(timeStr) {
            if (window.currentLang !== 'fr') return timeStr;
            const [time, modifier] = timeStr.split(' ');
            let [h, m] = time.split(':');
            h = parseInt(h, 10);
            if (modifier === 'PM' && h < 12) h += 12;
            if (modifier === 'AM' && h === 12) h = 0;
            return `${h.toString().padStart(2, '0')}h${m}`;
        }

        // 2. Create Day Headers
        days.forEach(dayDate => {
            const header = document.createElement('div');
            header.classList.add('grid-header');
            header.innerText = formatDateForHeader(dayDate);
            
            const isToday = (dayDate.toDateString() === new Date().toDateString());
            if (isToday) {
                header.style.setProperty('background-color', '#e8f5e9', 'important');
                header.style.setProperty('color', '#198754', 'important');
                header.style.setProperty('border-bottom', '3px solid #198754', 'important');
            }
            
            scheduleGrid.appendChild(header);
        });

        // 3. Create Time Rows
        hours.forEach(time => {
            const timeLabel = document.createElement('div');
            timeLabel.classList.add('time-label');
            timeLabel.innerText = getDisplayTime(time);
            scheduleGrid.appendChild(timeLabel);

            // Add clickable slots for each day in this row
            days.forEach(dayDate => {
                const slotContainer = document.createElement('div');
                slotContainer.classList.add('slot-cell');
                const slotStack = document.createElement('div');
                slotStack.classList.add('slot-stack');
                slotContainer.appendChild(slotStack);

                const slotDayStr = formatDateForHeader(dayDate);

                // --- Check Database/Storage for status ---
                let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
                if (!Array.isArray(reservations)) reservations = [];

                const cellDate = new Date(dayDate);
                cellDate.setHours(0,0,0,0);

                const slotMatches = [];

                const buildSlotDate = () => {
                    const timeMatch = time.match(/(\d+):(\d+)\s(AM|PM)/);
                    let hour24 = parseInt(timeMatch[1], 10);
                    if (timeMatch[3] === 'PM' && hour24 < 12) hour24 += 12;
                    if (timeMatch[3] === 'AM' && hour24 === 12) hour24 = 0;
                    return { hour: hour24, minute: parseInt(timeMatch[2], 10) };
                };
                const { hour: slotHour, minute: slotMinute } = buildSlotDate();

                const slotExactMs = cellDate.getTime() + (slotHour * 60 + slotMinute) * 60 * 1000;
                const isPast = slotExactMs < Date.now();

                reservations.forEach((res, resIdx) => {
                    if (res.status === 'cancelled' || res.status === 'rejected' || res.status === 'reject') return;

                    const createdTs = res.createdAt ? new Date(res.createdAt).getTime() : resIdx;

                    // Blocked ranges
                    if (res.status === 'blocked') {
                        const bStartDay = new Date(`${res.startDate}T00:00:00`);
                        const bEndDay = new Date(`${res.endDate}T23:59:59`);
                        
                        if (cellDate.getTime() >= bStartDay.getTime() && cellDate.getTime() <= bEndDay.getTime()) {
                            let isBlocked = false;
                            
                            if (res.recurring === 'daily') {
                                const bStartTime = new Date(cellDate);
                                if (res.startTime) { const [h, m] = res.startTime.split(':'); bStartTime.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0); }
                                else bStartTime.setHours(0, 0, 0, 0);

                                const bEndTime = new Date(cellDate);
                                if (res.endTime) { const [h, m] = res.endTime.split(':'); bEndTime.setHours(parseInt(h, 10), parseInt(m, 10), 59, 999); }
                                else bEndTime.setHours(23, 59, 59, 999);

                                const slotExactDate = new Date(cellDate);
                                slotExactDate.setHours(slotHour, slotMinute, 0, 0);

                                if (slotExactDate.getTime() >= bStartTime.getTime() && slotExactDate.getTime() <= bEndTime.getTime()) isBlocked = true;
                            } else {
                                const bStart = new Date(`${res.startDate}T${res.startTime || '00:00'}:00`);
                                const bEnd = new Date(`${res.endDate}T${res.endTime || '23:59'}:59`);
                                const slotExactDate = new Date(cellDate);
                                slotExactDate.setHours(slotHour, slotMinute, 0, 0);
                                if (slotExactDate.getTime() >= bStart.getTime() && slotExactDate.getTime() <= bEnd.getTime()) isBlocked = true;
                            }

                        if (isBlocked) {
                            const displayText = isAdmin 
                                ? (res.message ? `${window.t('blocked')}:\n${res.message}` : window.t('blocked'))
                                : window.t('unavailable');
                            const isHighlighted = isAdmin && window.activeAdminResIndex === resIdx;
                            slotMatches.push({
                                res,
                                resIdx,
                                status: 'blocked',
                                cardState: 'blocked',
                                text: displayText,
                                isOwner: isAdmin,
                                highlight: isHighlighted,
                                createdTs
                            });
                        }
                        }
                        return;
                    }

                    if (!res.slots) return;

                    res.slots.forEach((s, slotIdx) => {
                        if (s.time !== time) return;

                        let isMatch = false;
                        if (s.fullDate) {
                            const slotDate = new Date(s.fullDate);
                            slotDate.setHours(0,0,0,0);
                            
                            if (res.recurring === 'weekly') {
                                if (res.endDate) {
                                    // Fallback for legacy multi-week behavior
                                    const endDate = new Date(`${res.endDate}T23:59:59`);
                                    if (cellDate.getTime() >= slotDate.getTime() && cellDate.getTime() <= endDate.getTime() && cellDate.getDay() === slotDate.getDay()) {
                                        isMatch = true;
                                    }
                                } else {
                                    // New exact match for explicitly generated slots
                                    if (cellDate.getTime() === slotDate.getTime()) isMatch = true;
                                }
                            } else {
                                if (cellDate.getTime() === slotDate.getTime()) isMatch = true;
                            }
                        } else if (s.day === slotDayStr) {
                            isMatch = true; // Fallback
                        }

                        if (!isMatch) return;

                        const isOwnerMatch = currentUser === res.email || currentUser === res.phone;
                        const untilTxt = res.recurring === 'weekly' && res.endDate ? `(${window.t('until')} ${new Date(res.endDate).toLocaleDateString()})` : (res.recurring === 'weekly' ? `(${window.t('weekly')})` : '');
                        const nameStr = (isAdmin || isOwnerMatch) ? `${res.fname}${untilTxt ? `\n${untilTxt}` : ''}` : '';
                        const searchStr = `${res.fname} ${res.lname} ${res.email} ${res.phone} ${res.resId || ''} ${(res.slots || []).map(sl=>sl.day).join(' ')}`.toLowerCase();
                        const searchHighlight = activeSearchTerm && searchStr.includes(activeSearchTerm);
                        const isGuestHighlighted = !isAdmin && window.activeGuestResIndex === resIdx;
                        const highlight = (isAdmin && window.activeAdminResIndex === resIdx) || searchHighlight || isGuestHighlighted;

                        const resKey = res._id || `local-${resIdx}`;
                        const isUnchecked = isAdmin && res.status === 'pending' && window.pendingSlotSelections && window.pendingSlotSelections[resKey] && !window.pendingSlotSelections[resKey].includes(slotIdx);

                        const cardState = res.status === 'approved' ? 'taken' : res.status === 'pending' ? 'processing' : 'free';

                        slotMatches.push({
                            res,
                            resIdx,
                            slotIdx,
                            status: res.status,
                            cardState,
                            text: nameStr,
                            isOwner: isOwnerMatch,
                            highlight,
                            isUnchecked,
                            createdTs
                        });
                    });
                });

                // Sort oldest first (stable order, no longer jumping to top on highlight)
                slotMatches.sort((a, b) => {
                    return a.createdTs - b.createdTs;
                });

                const hasMatches = slotMatches.length > 0;
                const hasApproved = slotMatches.some(m => m.status === 'approved');
                const hasPendingOnly = slotMatches.some(m => m.status === 'pending') && !hasApproved;

                const createCard = (state, text = '', options = {}) => {
                    const card = document.createElement('div');
                    card.classList.add('time-slot', 'slot-card', state);
                    if (options.resIdx !== undefined) {
                        card.dataset.resIndex = options.resIdx;
                    }
                    if (options.slotIdx !== undefined) {
                        card.dataset.slotIndex = options.slotIdx;
                    }
                    card.dataset.time = time;
                    card.dataset.day = slotDayStr;
                    card.dataset.fullDate = dayDate.toISOString();
                    if (state === 'free') card.dataset.originalState = 'free';
                    if (state === 'processing') card.dataset.originalState = 'processing';
                    const label = text || (state === 'free' ? window.t('available') : window.t(state === 'processing' ? 'pending' : state === 'taken' ? 'booked' : 'blocked'));
                    const orderBadge = options.orderNumber ? `#${options.orderNumber} ` : '';
                    const isSlotDone = (options.res && options.res.slots && options.slotIdx !== undefined && options.res.slots[options.slotIdx].classDone) || (options.res && options.res.classDone);
                    const doneMark = isSlotDone ? ' <span class="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle ms-1" style="width: 14px; height: 14px; font-size: 10px; line-height: 1;">✓</span>' : '';
                    const escapedLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                    card.innerHTML = `${orderBadge}${escapedLabel}${doneMark}`;
                    
                    if (options.res && (options.isOwner || isAdmin)) {
                        const r = options.res;
                        let tooltipText = `${r.fname} ${r.lname} (ID: ${r.resId || 'N/A'})\n`;
                        tooltipText += `Coach: ${r.adminProfile}\n`;
                        tooltipText += `Statut: ${window.t(state).toUpperCase()}\n`;
                        tooltipText += `Type: ${r.recurring === 'weekly' ? window.t('weekly') : window.t('oneTime')}`;
                        if (r.adminReply) tooltipText += `\n\n- ${window.t('coachReply')} ${r.adminReply}`;
                        else if (r.message) tooltipText += `\n\n- ${window.t('message')}: ${r.message}`;
                        card.title = tooltipText;
                    }

                    if (options.highlight) {
                        card.classList.add('highlight-slot');
                    }
                    
                    if (options.isUnchecked) {
                        card.style.setProperty('opacity', '0.5', 'important');
                        card.style.setProperty('background-color', '#e9ecef', 'important');
                        card.style.setProperty('color', '#6c757d', 'important');
                        card.style.setProperty('text-decoration', 'line-through', 'important');
                    }
                    
                    if (options.isPast) {
                        if (isAdmin) {
                            card.style.setProperty('opacity', '0.8', 'important');
                            card.style.setProperty('filter', 'grayscale(30%)', 'important');
                        } else {
                            card.style.setProperty('opacity', '0.5', 'important');
                            card.style.setProperty('filter', 'grayscale(80%)', 'important');
                            card.style.setProperty('pointer-events', 'none', 'important');
                            card.style.setProperty('cursor', 'not-allowed', 'important');
                        }
                    }

                    card.addEventListener('click', () => {
                        if (isAdmin && card.dataset.resIndex !== undefined) {
                            const idx = parseInt(card.dataset.resIndex, 10);
                            window.activeAdminResIndex = (window.activeAdminResIndex === idx) ? null : idx;
                            window.dispatchEvent(new Event('adminHighlightChange'));
                        }
                        if (!isAdmin && options.isOwner && card.dataset.resIndex !== undefined) {
                            const idx = parseInt(card.dataset.resIndex, 10);
                            window.activeGuestResIndex = (window.activeGuestResIndex === idx) ? null : idx;
                            window.dispatchEvent(new Event('guestHighlightChange'));
                        }
                        if (card.classList.contains('free') || card.classList.contains('selected') || card.classList.contains('processing')) {
                            onSlotClickCallback(card);
                        }
                    });

                    // Add cancellation button for user's own reservations (non-admin only)
                    if (options.isOwner && !isAdmin && (state === 'processing' || state === 'taken')) {
                        card.classList.add('own-slot');
                        const cancelBtn = document.createElement('div');
                        cancelBtn.innerHTML = '&times;';
                        cancelBtn.className = 'cancel-own-btn';
                        cancelBtn.title = window.t('cancelRes');
                        cancelBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const allRes = JSON.parse(localStorage.getItem('reservations')) || [];
                            const targetRes = allRes[options.resIdx];
                            if (!targetRes) return;

                            const executeCancel = async (cancelFull) => {
                                if (cancelFull) {
                                    targetRes.status = 'cancelled';
                                } else {
                                    targetRes.slots = targetRes.slots.filter(s => !(s.time === time && s.day === slotDayStr));
                                    if (targetRes.slots.length === 0) targetRes.status = 'cancelled';
                                }
                                if (targetRes._id) {
                                    try {
                                        await fetch(`/api/reservations/${targetRes._id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: targetRes.status, slots: targetRes.slots })
                                        });
                                        await window.fetchReservations();
                                    } catch(e) { console.error(e); }
                                } else {
                                    localStorage.setItem('reservations', JSON.stringify(allRes));
                                    window.dispatchEvent(new Event('reservationsUpdated'));
                                }
                            };

                            if (targetRes.slots.length > 1) {
                                window.showDialog({
                                    title: window.t('modifyRes'),
                                    message: window.t('modResMsg'),
                                    buttons: [
                                        { text: window.t('cancelEntire'), class: 'btn-danger w-100', onClick: () => executeCancel(true) },
                                        { text: window.t('removeHour'), class: 'btn-warning w-100', onClick: () => executeCancel(false) },
                                        { text: window.t('goBack'), class: 'btn-secondary w-100' }
                                    ]
                                });
                            } else {
                                window.showDialog({
                                    title: window.t('cancelRes'),
                                    message: window.t('cancelResConf'),
                                    buttons: [
                                        { text: window.t('yesCancel'), class: 'btn-danger w-100', onClick: () => executeCancel(true) },
                                        { text: window.t('noKeep'), class: 'btn-secondary w-100' }
                                    ]
                                });
                            }
                        });
                        card.appendChild(cancelBtn);
                    }

                    slotStack.appendChild(card);
                };

                if (!hasMatches) {
                    createCard('free', '', { isPast });
                } else {
                    slotMatches.forEach((match, idxOrder) => {
                        let label = '';
                        if (match.cardState === 'taken') label = match.text ? `${window.t('booked')}:\n${match.text}` : window.t('booked');
                        else if (match.cardState === 'processing') label = match.text ? `${window.t('pending')}:\n${match.text}` : window.t('pending');
                        else if (match.cardState === 'blocked') label = match.text || window.t('blocked');
                        else label = match.text || window.t('available');

                        createCard(match.cardState, label, { 
                            res: match.res,
                            resIdx: match.resIdx, 
                            slotIdx: match.slotIdx,
                            isOwner: match.isOwner, 
                            highlight: match.highlight,
                            isUnchecked: match.isUnchecked,
                            orderNumber: idxOrder + 1,
                            isPast
                        });
                    });

                    // If only pending reservations are present (no approved), keep the slot tappable for waitlist/selection
                    if (hasPendingOnly && !isAdmin) {
                        slotStack.querySelectorAll('.slot-card.processing').forEach(card => {
                            card.dataset.originalState = 'processing';
                        });
                    }
                }

                scheduleGrid.appendChild(slotContainer);
            });
        });

        updateCurrentTimeLine();
    }

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => { 
            // Allow going backward indefinitely for both guests and admins
            currentWeekStart.setDate(currentWeekStart.getDate() - 7); 
            renderGrid(); 
            triggerFlashAnimation();
            onWeekChangeCallback(); 
        });
        nextBtn.addEventListener('click', () => { 
            const weeksDiff = Math.round((currentWeekStart.getTime() - todayWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
            const currentUser = localStorage.getItem('currentUser');
            const isAdmin = currentUser === 'admin';
            if (!isAdmin && weeksDiff >= 4) return;

            currentWeekStart.setDate(currentWeekStart.getDate() + 7); 
            renderGrid(); 
            triggerFlashAnimation();
            onWeekChangeCallback(); 
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            goToDate(new Date());
        });
    }

    renderGrid();

    window.addEventListener('languageChanged', () => {
        triggerFlashAnimation();
        renderGrid(activeSearchTerm);
    });

    setInterval(() => {
        if (document.getElementById(gridElementId)) {
            updateCurrentTimeLine();
        }
    }, 60000);

    return { refresh: renderGrid, getVisibleDays: () => currentViewDays, goToDate: goToDate };
}
