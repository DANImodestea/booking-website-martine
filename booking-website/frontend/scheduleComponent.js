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
                const slot = document.createElement('div');
                const slotDayStr = formatDateForHeader(dayDate);

                // --- Check Database/Storage for status ---
                let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
                if (!Array.isArray(reservations)) reservations = [];
                let isPending = false;
                let isApproved = false;
                let isBlocked = false;
                let clientInfo = '';
                let isHighlighted = false;
                let isOwner = false;
                let ownerResIndex = -1;
                let slotResIndex = null;
                
                const currentUser = localStorage.getItem('currentUser');
                const isAdmin = currentUser === 'admin';
                
                const cellDate = new Date(dayDate);
                cellDate.setHours(0,0,0,0);

                reservations.forEach(res => {
                    if (res.status === 'cancelled' || res.status === 'rejected' || res.status === 'reject') return;
                    
                    if (res.status === 'blocked') {
                        const bStart = new Date(`${res.startDate}T${res.startTime || '00:00'}:00`);
                        const bEnd = new Date(`${res.endDate}T${res.endTime || '23:59'}:59`);
                        
                        const timeMatch = time.match(/(\d+):(\d+)\s(AM|PM)/);
                        let hours = parseInt(timeMatch[1], 10);
                        if (timeMatch[3] === 'PM' && hours < 12) hours += 12;
                        if (timeMatch[3] === 'AM' && hours === 12) hours = 0;
                        
                        const slotExactDate = new Date(cellDate);
                        slotExactDate.setHours(hours, parseInt(timeMatch[2], 10), 0, 0);

                        if (slotExactDate.getTime() >= bStart.getTime() && slotExactDate.getTime() <= bEnd.getTime()) {
                            isBlocked = true;
                            if (isAdmin) {
                                clientInfo = res.message ? `${window.t('blocked')}:\n${res.message}` : window.t('blocked');
                                isOwner = true;
                                ownerResIndex = reservations.indexOf(res);
                                slotResIndex = ownerResIndex;
                            } else {
                                clientInfo = window.t('unavailable');
                            }
                        }
                    }
                    
                    if (!res.slots) return;
                    res.slots.forEach(s => {
                        if (s.time === time) {
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
                            } else {
                                if (s.day === slotDayStr) isMatch = true; // Fallback
                            }

                            if (!isMatch) return;

                            slotResIndex = reservations.indexOf(res);

                            const isOwnerMatch = currentUser === res.email || currentUser === res.phone;
                            if (isOwnerMatch) {
                                isOwner = true;
                                ownerResIndex = reservations.indexOf(res);
                            }
                            
                            if (res.status === 'pending') isPending = true;
                            if (res.status === 'approved') isApproved = true;
                            
                            if (isAdmin || isOwnerMatch) {
                                const untilTxt = res.recurring === 'weekly' && res.endDate ? `(${window.t('until')} ${new Date(res.endDate).toLocaleDateString()})` : (res.recurring === 'weekly' ? `(${window.t('weekly')})` : '');
                                clientInfo = `${res.fname}\n${untilTxt}`.trim();
                            } else {
                                clientInfo = ''; // Mask name for privacy
                            }
                            
                            if (activeSearchTerm) {
                                const searchStr = `${res.fname} ${res.lname} ${res.email} ${res.phone} ${res.slots.map(sl=>sl.day).join(' ')}`.toLowerCase();
                                if (searchStr.includes(activeSearchTerm)) {
                                    isHighlighted = true;
                                }
                            }
                        }
                    });
                });

                if (slotResIndex !== null) {
                    slot.dataset.resIndex = slotResIndex;
                    if (isAdmin && window.activeAdminResIndex === slotResIndex) {
                        isHighlighted = true;
                    }
                }

                if (isBlocked) {
                    slot.classList.add('time-slot', 'blocked');
                    slot.innerText = clientInfo;
                } else if (isApproved) {
                    slot.classList.add('time-slot', 'taken');
                    slot.innerText = clientInfo ? `${window.t('booked')}:\n${clientInfo}` : window.t('booked');
                } else if (isPending) {
                    slot.classList.add('time-slot', 'processing');
                    slot.innerText = clientInfo ? `${window.t('pending')}:\n${clientInfo}` : window.t('pending');
                    slot.dataset.originalState = 'processing';
                } else {
                    slot.classList.add('time-slot', 'free');
                    slot.innerText = window.t('available');
                    slot.dataset.originalState = 'free';
                }

                slot.addEventListener('click', (e) => {
                    if (isAdmin && slot.dataset.resIndex !== undefined) {
                        const idx = parseInt(slot.dataset.resIndex);
                        window.activeAdminResIndex = (window.activeAdminResIndex === idx) ? null : idx;
                        window.dispatchEvent(new Event('adminHighlightChange'));
                    }
                    if (slot.classList.contains('free') || slot.classList.contains('selected') || slot.classList.contains('processing')) {
                        onSlotClickCallback(slot);
                    }
                });

                slot.dataset.time = time;
                slot.dataset.day = slotDayStr;
                slot.dataset.fullDate = dayDate.toISOString();

                if (isHighlighted) {
                    slot.classList.add('highlight-slot');
                }

                // Add cancellation button for the user's own reservations
                if (isOwner && !isAdmin && (isPending || isApproved)) {
                    slot.classList.add('own-slot');
                    const cancelBtn = document.createElement('div');
                    cancelBtn.innerHTML = '&times;';
                    cancelBtn.className = 'cancel-own-btn';
                    cancelBtn.title = window.t('cancelRes');
                    cancelBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const allRes = JSON.parse(localStorage.getItem('reservations')) || [];
                        const targetRes = allRes[ownerResIndex];
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
                    slot.appendChild(cancelBtn);
                }

                scheduleGrid.appendChild(slot);
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