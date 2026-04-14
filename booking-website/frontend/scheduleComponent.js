function initSchedule(gridElementId, navIds, onSlotClickCallback, onWeekChangeCallback = () => {}) {
    const scheduleGrid = document.getElementById(gridElementId);
    const prevBtn = document.getElementById(navIds.prev);
    const nextBtn = document.getElementById(navIds.next);
    const weekDisplay = document.getElementById(navIds.display);
    
    let activeSearchTerm = '';
    let currentWeekStart = getMonday(new Date());
    const todayWeekStart = getMonday(new Date());
    let currentViewDays = [];

    function getMonday(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }

    function formatDateForHeader(date) {
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
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
            if (onWeekChangeCallback) onWeekChangeCallback();
            triggerFlashAnimation();
        }
        renderGrid(activeSearchTerm);
    }

    const hours = [
        "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
        "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", 
        "06:00 PM", "07:00 PM", "08:00 PM"
    ];
    
    function renderGrid(searchTerm) {
        if (typeof searchTerm === 'string') {
            activeSearchTerm = searchTerm.toLowerCase();
        }

        scheduleGrid.innerHTML = '';
        
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
            const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
            weekDisplay.innerText = `${days[0].toLocaleDateString(undefined, dateOptions)} - ${days[6].toLocaleDateString(undefined, dateOptions)}`;
        }

        // Hide the "Previous Week" button if we are looking at the current week
        if (prevBtn) {
            prevBtn.style.visibility = currentWeekStart.getTime() <= todayWeekStart.getTime() ? 'hidden' : 'visible';
        }

        // 1. Create top-left empty corner cell
        const corner = document.createElement('div');
        corner.classList.add('grid-header', 'time-label');
        scheduleGrid.appendChild(corner);

        // 2. Create Day Headers
        days.forEach(dayDate => {
            const header = document.createElement('div');
            header.classList.add('grid-header');
            header.innerText = formatDateForHeader(dayDate);
            scheduleGrid.appendChild(header);
        });

        // 3. Create Time Rows
        hours.forEach(time => {
            const timeLabel = document.createElement('div');
            timeLabel.classList.add('time-label');
            timeLabel.innerText = time;
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

                const currentUser = localStorage.getItem('currentUser');
                const isAdmin = currentUser === 'admin';
                
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

                reservations.forEach((res, resIdx) => {
                    if (res.status === 'cancelled' || res.status === 'rejected' || res.status === 'reject') return;

                    const createdTs = res.createdAt ? new Date(res.createdAt).getTime() : resIdx;

                    // Blocked ranges
                    if (res.status === 'blocked') {
                        const bStart = new Date(`${res.startDate}T${res.startTime || '00:00'}:00`);
                        const bEnd = new Date(`${res.endDate}T${res.endTime || '23:59'}:59`);
                        const slotExactDate = new Date(cellDate);
                        slotExactDate.setHours(slotHour, slotMinute, 0, 0);

                        if (slotExactDate.getTime() >= bStart.getTime() && slotExactDate.getTime() <= bEnd.getTime()) {
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
                        return;
                    }

                    if (!res.slots) return;

                    res.slots.forEach(s => {
                        if (s.time !== time) return;

                        let isMatch = false;
                        if (s.fullDate) {
                            const slotDate = new Date(s.fullDate);
                            slotDate.setHours(0,0,0,0);
                            
                            if (res.recurring === 'weekly') {
                                const endDate = res.endDate ? new Date(res.endDate) : new Date(8640000000000000);
                                endDate.setHours(23,59,59,999);
                                if (cellDate.getTime() >= slotDate.getTime() && cellDate.getTime() <= endDate.getTime() && cellDate.getDay() === slotDate.getDay()) {
                                    isMatch = true;
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
                        const searchStr = `${res.fname} ${res.lname} ${res.email} ${res.phone} ${(res.slots || []).map(sl=>sl.day).join(' ')}`.toLowerCase();
                        const searchHighlight = activeSearchTerm && searchStr.includes(activeSearchTerm);
                        const highlight = (isAdmin && window.activeAdminResIndex === resIdx) || searchHighlight;

                        const cardState = res.status === 'approved' ? 'taken' : res.status === 'pending' ? 'processing' : 'free';

                        slotMatches.push({
                            res,
                            resIdx,
                            status: res.status,
                            cardState,
                            text: nameStr,
                            isOwner: isOwnerMatch,
                            highlight,
                            createdTs
                        });
                    });
                });

                // Sort oldest first, but keep the highlighted one on top
                slotMatches.sort((a, b) => {
                    const activeIdx = window.activeAdminResIndex;
                    if (activeIdx !== null) {
                        if (a.resIdx === activeIdx && b.resIdx !== activeIdx) return -1;
                        if (b.resIdx === activeIdx && a.resIdx !== activeIdx) return 1;
                    }
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
                    card.dataset.time = time;
                    card.dataset.day = slotDayStr;
                    card.dataset.fullDate = dayDate.toISOString();
                    if (state === 'free') card.dataset.originalState = 'free';
                    if (state === 'processing') card.dataset.originalState = 'processing';
                    const label = text || (state === 'free' ? window.t('available') : window.t(state === 'processing' ? 'pending' : state === 'taken' ? 'booked' : 'blocked'));
                    const orderBadge = options.orderNumber ? `#${options.orderNumber} ` : '';
                    card.innerText = `${orderBadge}${label}`;

                    if (options.highlight) {
                        card.classList.add('highlight-slot');
                    }

                    card.addEventListener('click', () => {
                        if (isAdmin && card.dataset.resIndex !== undefined) {
                            const idx = parseInt(card.dataset.resIndex, 10);
                            window.activeAdminResIndex = (window.activeAdminResIndex === idx) ? null : idx;
                            window.dispatchEvent(new Event('adminHighlightChange'));
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
                    createCard('free');
                } else {
                    slotMatches.forEach((match, idxOrder) => {
                        let label = '';
                        if (match.cardState === 'taken') label = match.text ? `${window.t('booked')}:\n${match.text}` : window.t('booked');
                        else if (match.cardState === 'processing') label = match.text ? `${window.t('pending')}:\n${match.text}` : window.t('pending');
                        else if (match.cardState === 'blocked') label = match.text || window.t('blocked');
                        else label = match.text || window.t('available');

                        createCard(match.cardState, label, { 
                            resIdx: match.resIdx, 
                            isOwner: match.isOwner, 
                            highlight: match.highlight,
                            orderNumber: idxOrder + 1
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
    }

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => { 
            if (currentWeekStart.getTime() > todayWeekStart.getTime()) {
                currentWeekStart.setDate(currentWeekStart.getDate() - 7); 
                onWeekChangeCallback(); 
                triggerFlashAnimation();
                renderGrid(); 
            }
        });
        nextBtn.addEventListener('click', () => { 
            currentWeekStart.setDate(currentWeekStart.getDate() + 7); 
            onWeekChangeCallback(); 
            triggerFlashAnimation();
            renderGrid(); 
        });
    }

    renderGrid();

    return { refresh: renderGrid, getVisibleDays: () => currentViewDays, goToDate: goToDate };
}
