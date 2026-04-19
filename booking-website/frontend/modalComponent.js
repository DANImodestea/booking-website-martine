// Frontend Modal Component Logic
function initModal(onSubmitCallback) {
    const modal = document.getElementById('booking-modal');
    const closeBtn = document.getElementById('close-modal');
    const form = document.getElementById('booking-form');
    const timeDisplay = document.getElementById('selected-time-display');
    
    let currentSlots = [];
    const recurringRadios = document.querySelectorAll('input[name="recurring"]');
    const weeksGroup = document.getElementById('weeks-group');

    // Fonction pour ouvrir la modale (sera appelée depuis main.js)
    const openModal = (slotElements) => {
        currentSlots = slotElements;
        
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

        const slotsText = slotElements.map(s => `${s.dataset.day} ${window.currentLang === 'fr' ? 'à' : 'at'} ${getDisplayTime(s.dataset.time)}`).join('<br>');
        timeDisplay.innerHTML = `${window.t('youAreReq')}<br><strong>${slotsText}</strong>`;
        
        // Clear previous entries
        document.getElementById('fname').value = "";
        document.getElementById('lname').value = "";
        document.getElementById('email').value = "";
        document.getElementById('phone').value = "";
        if (document.getElementById('message')) document.getElementById('message').value = "";

        // Auto-fill their logged in ID
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser && currentUser !== 'admin') {
            if (currentUser.includes('@')) document.getElementById('email').value = currentUser;
            else document.getElementById('phone').value = currentUser;
            
            // Load saved profiles linked to this login
            let savedProfiles = JSON.parse(localStorage.getItem('savedGuestProfiles')) || [];
            savedProfiles = savedProfiles.filter(p => p.currentUser === currentUser);
            const savedProfilesGroup = document.getElementById('saved-profiles-group');
            const savedProfilesSelect = document.getElementById('saved-profiles-select');
            
            if (savedProfilesGroup && savedProfilesSelect) {
                if (savedProfiles.length > 0) {
                    savedProfilesSelect.innerHTML = `<option value="">${window.t('selectProfileOpt') || '-- Sélectionner un profil récent --'}</option>` +
                        savedProfiles.map((p, i) => `<option value="${i}">${p.fname} ${p.lname}</option>`).join('');
                    savedProfilesGroup.style.display = 'block';
                    savedProfilesSelect.onchange = (e) => {
                        if(e.target.value !== "") {
                            const sel = savedProfiles[e.target.value];
                            document.getElementById('fname').value = sel.fname || '';
                            document.getElementById('lname').value = sel.lname || '';
                            document.getElementById('phone').value = sel.phone || '';
                        } else {
                            document.getElementById('fname').value = '';
                            document.getElementById('lname').value = '';
                        }
                    };
                } else {
                    savedProfilesGroup.style.display = 'none';
                }
            }
        }

        if (weeksGroup) {
            weeksGroup.style.display = document.querySelector('input[name="recurring"]:checked').value === 'weekly' ? 'block' : 'none';
        }
        modal.style.display = 'flex';
    };

    // Fermer la modale
    const closeModal = () => {
        modal.style.display = 'none';
    };

    closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    recurringRadios.forEach(radio => radio.addEventListener('change', (e) => {
        if (weeksGroup) weeksGroup.style.display = e.target.value === 'weekly' ? 'block' : 'none';
    }));

    // Gérer la soumission du formulaire
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const recurringOption = document.querySelector('input[name="recurring"]:checked').value;
        
        let numWeeks = 1;
        if (recurringOption === 'weekly' && currentSlots.length > 0) {
            numWeeks = parseInt(document.getElementById('num-weeks').value, 10) || 4;
        }

        const clientData = {
            fname: document.getElementById('fname').value,
            lname: document.getElementById('lname').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            message: document.getElementById('message').value,
            recurring: recurringOption,
            numWeeks: numWeeks
        };
        
        // Save profile to memory for future auto-fill
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser && currentUser !== 'admin') {
            const profileToSave = { currentUser, fname: clientData.fname, lname: clientData.lname, email: clientData.email, phone: clientData.phone };
            let allProfiles = JSON.parse(localStorage.getItem('savedGuestProfiles')) || [];
            const exists = allProfiles.find(p => p.currentUser === currentUser && p.fname === profileToSave.fname && p.lname === profileToSave.lname);
            if (!exists) {
                allProfiles.push(profileToSave);
                localStorage.setItem('savedGuestProfiles', JSON.stringify(allProfiles));
            }
        }

        // Transmet les données et le slot sélectionné au chef d'orchestre
        onSubmitCallback(clientData, currentSlots);
        
        closeModal();
        form.reset();
    });

    return { openModal }; // Expose seulement la fonction d'ouverture
}

// Global Dialog Utility to replace alerts and confirms
window.showDialog = function({ title, message, buttons }) {
    const dialog = document.getElementById('custom-dialog-modal');
    document.getElementById('dialog-title').innerText = title || 'Notification';
    document.getElementById('dialog-message').innerHTML = (message || '').replace(/\n/g, '<br>');
    
    const btnContainer = document.getElementById('dialog-buttons');
    btnContainer.innerHTML = '';
    
    buttons.forEach(btn => {
        const buttonEl = document.createElement('button');
        buttonEl.className = `btn ${btn.class || 'btn-primary'} py-2 fw-bold`;
        buttonEl.innerText = btn.text;
        buttonEl.onclick = () => {
            dialog.style.display = 'none';
            if (btn.onClick) btn.onClick();
        };
        btnContainer.appendChild(buttonEl);
    });
    
    dialog.style.display = 'flex';
};