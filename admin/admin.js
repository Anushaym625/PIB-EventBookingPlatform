// admin.js

document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIG & STATE ---
    const ICONS = ['music', 'glass-water', 'disc', 'headphones', 'plug-zap', 'party-popper', 'rocket', 'beer', 'star', 'award', 'camera'];
    const API_BASE = 'http://localhost:3000/api';
    let activeFormUploaderData = {};
    let currentUser = null;
    
    // --- DOM ELEMENTS ---
    const modalBackdrop = document.getElementById('edit-modal-backdrop');
    const modalTitle = document.getElementById('modal-title');
    const modalFormContainer = document.getElementById('edit-form-container');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const loginSection = document.getElementById('login-section');
    const adminContainer = document.getElementById('admin-container');
    const superAdminLoginPage = document.getElementById('super-admin-login-page');
    const organizerLoginPage = document.getElementById('organizer-login-page');

    // ===============================================
    // API & UTILITY FUNCTIONS
    // ===============================================
    const apiFetch = async (endpoint, method = 'GET', data = null) => {
        const url = `${API_BASE}/${endpoint}`;
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (data) options.body = JSON.stringify(data);

        try {
            const response = await fetch(url, options);
            if (response.status === 204) return null;
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error on ${endpoint}: ${response.status} - ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Fetch error on ${url}:`, error);
            throw error;
        }
    };
    
    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
    const openModal = () => modalBackdrop.classList.remove('hidden');
    const closeModal = () => modalBackdrop.classList.add('hidden');

    const showToast = (message, type = 'success') => {
        const toastContainer = document.getElementById('toast-container');
        const toastMessage = document.getElementById('toast-message');

        if (!toastContainer || !toastMessage) return;

        // Set the message
        toastMessage.textContent = message;

        // Set the style (success or error)
        toastContainer.classList.remove('toast-error'); // Reset first
        if (type === 'error') {
            toastContainer.classList.add('toast-error');
        }

        // Show the toast
        toastContainer.classList.add('show');

        // Hide it after 3 seconds
        setTimeout(() => {
            toastContainer.classList.remove('show');
        }, 3000);
    };
    
    const showPage = (pageId) => {
        document.querySelectorAll('.admin-page-section').forEach(p => p.style.display = 'none');
        const page = document.getElementById(pageId);
        if(page) {
            page.style.display = 'block';
            const type = pageId.split('-')[1];
            document.getElementById('admin-header-title').textContent = capitalize(type);
        }
    };
    
    const createTimePicker = (container, time24) => { 
        const [h, m] = time24 ? time24.split(':') : ['12', '00']; 
        const currentHour = parseInt(h, 10); 
        const currentPeriod = currentHour >= 12 ? 'PM' : 'AM'; 
        const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12; 
        container.innerHTML = `<select name="hour" class="time-select">${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1 === displayHour ? 'selected' : ''}>${i+1}</option>`).join('')}</select><select name="minute" class="time-select">${Array.from({length: 60}, (_, i) => `<option value="${i.toString().padStart(2,'0')}" ${i === parseInt(m) ? 'selected' : ''}>${i.toString().padStart(2,'0')}</option>`).join('')}</select><select name="period" class="time-select"><option ${currentPeriod==='AM'?'selected':''}>AM</option><option ${currentPeriod==='PM'?'selected':''}>PM</option></select>`; 
    };

    const setupUploader = (dropzone, input, previewsContainer, dataStore) => { 
        const renderPreviews = () => { 
            previewsContainer.innerHTML = (dataStore.files || []).map((src, index) => 
                `<div class="preview-image-container"><img src="${src}" class="w-full h-24 object-cover rounded-md"><button data-index="${index}" class="remove-preview-btn p-0.5"><i data-lucide="x" class="w-4 h-4 text-red-500"></i></button></div>`
            ).join(''); 
            lucide.createIcons(); 
        }; 
        const handleFiles = async (files) => { 
            for (const file of files) { 
                if (!file.type.startsWith('image/')) continue; 
                const url = 'https://api.cloudinary.com/v1_1/dhwwwuzdc/upload';
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', 'unsigned_preset'); 
                formData.append('folder', 'uploader'); 
                try {
                    const res = await fetch(url, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.secure_url) {
                        if (dataStore.isMulti) dataStore.files.push(data.secure_url); else dataStore.files = [data.secure_url];
                        renderPreviews();
                    } else { alert('Image upload failed: ' + (data.error?.message || 'Unknown error')); }
                } catch (err) { alert('Image upload error: ' + err.message); }
            } 
        }; 
        dropzone.addEventListener('click', () => input.click()); 
        input.addEventListener('change', () => handleFiles(input.files)); 
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {e.preventDefault(); e.stopPropagation()})); 
        ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.add('drag-over'))); 
        ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.remove('drag-over'))); 
        dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files)); 
        previewsContainer.addEventListener('click', e => { 
            const btn = e.target.closest('.remove-preview-btn'); 
            if (btn) { dataStore.files.splice(parseInt(btn.dataset.index), 1); renderPreviews(); } 
        }); 
        renderPreviews(); 
    };

    const addVenueSlot = (container, slotData = {}) => {
        const slotId = Date.now() + Math.random();
        const slotEl = document.createElement('div');
        slotEl.className = 'relative border border-gray-700 p-4 rounded-lg';
        slotEl.innerHTML = `<button type="button" class="remove-slot-btn absolute top-2 right-2 action-btn"><i data-lucide="trash-2" class="w-5 h-5"></i></button><div class="grid grid-cols-2 gap-4 mb-3"><div><label class="text-xs text-subheader">Day</label><select name="slot_day_${slotId}" class="form-input mt-1">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<option ${slotData.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div><label class="text-xs text-subheader">Slot Name</label><input type="text" name="slot_name_${slotId}" class="form-input mt-1" placeholder="e.g. Evening Slot" value="${slotData.name || ''}"></div></div><div class="space-y-3"><div><label class="text-xs text-subheader">Start Time</label><div class="grid grid-cols-3 gap-1 mt-1" data-time-group="slot_start_${slotId}"></div></div><div><label class="text-xs text-subheader">End Time</label><div class="grid grid-cols-3 gap-1 mt-1" data-time-group="slot_end_${slotId}"></div></div></div>`;
        container.appendChild(slotEl);
        createTimePicker(slotEl.querySelector(`[data-time-group="slot_start_${slotId}"]`), slotData.start || '20:00');
        createTimePicker(slotEl.querySelector(`[data-time-group="slot_end_${slotId}"]`), slotData.end || '23:59');
        slotEl.querySelector('.remove-slot-btn').addEventListener('click', () => slotEl.remove());
        lucide.createIcons();
    };

    const saveItem = async (type, itemData) => {
        const { key: dbKey } = mapRenderKeys(type);
        let method = 'POST';
        let endpoint = dbKey;
        
        const isDbId = itemData.id && Number.isInteger(itemData.id) && itemData.id < 1000000;
        
        if (itemData.id && isDbId) {
            method = 'PUT';
            endpoint = `${dbKey}/${itemData.id}`;
        } else {
            if (itemData.id) delete itemData.id; 
        }
        
        try {
            await apiFetch(endpoint, method, itemData);
           showToast(`${capitalize(type)} saved successfully.`);
            closeModal();
            // Call the correct render function to refresh the list
            if (window[`render${capitalize(dbKey)}`]) {
                window[`render${capitalize(dbKey)}`]();
            }
        } catch (error) {
            showToast(`Failed to save ${type}: ${error.message}`, 'error');
        }
    };

    const deleteItem = async (type, id) => {
        if (confirm('Are you sure you want to delete this item?')) {
            const { key: dbKey } = mapRenderKeys(type);
            try {
                await apiFetch(`${dbKey}/${id}`, 'DELETE');
               showToast(`${capitalize(type)} deleted successfully.`);
                if (window[`render${capitalize(dbKey)}`]) {
                    window[`render${capitalize(dbKey)}`]();
                }
            } catch (error) {
               showToast(`Failed to delete ${type}: ${error.message}`, 'error');
            }
        }
    };
    
    // ===============================================
    // FORM SETUP & SUBMISSION LOGIC
    // ===============================================
    const setupForm = async (type, data) => {
        modalTitle.textContent = data ? `Edit ${capitalize(type)}` : `Add New ${capitalize(type)}`;
        const template = document.getElementById(`${type}-form-template`);
        const form = template.cloneNode(true);
        form.id = `active-${type}-form`;
        modalFormContainer.innerHTML = '';
        modalFormContainer.appendChild(form);
        activeFormUploaderData = {};

        if (type === 'event') {
            const [venues, organizers, categories] = await Promise.all([
                apiFetch('venues'),
                apiFetch('users'),
                apiFetch('categories')
            ]);
            const venueSelect = form.querySelector('[name="venue_id"]');
            const organizerSelect = form.querySelector('[name="organizer_id"]');
            const categorySelect = form.querySelector('[name="category"]');
            if (venueSelect) venueSelect.innerHTML = venues.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
            if (organizerSelect) organizerSelect.innerHTML = organizers.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
            if (categorySelect) categorySelect.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
      
        if (type === 'gallery' || type === 'highlight' || type === 'promo') {
            const events = await apiFetch('events');
            const eventSelect = form.querySelector('[name="eventId"]');

            if (eventSelect && events) {
                eventSelect.innerHTML = events.map(e => 
                    `<option value="${e.id}" ${data && data.event_id == e.id ? 'selected' : ''}>${e.title}</option>`
                ).join('');
            }
        }
        

// ... (your existing 'if' blocks for 'event', 'gallery', etc.) ...


  


        if (type === 'promo') {
            const linkTypeSelect = form.querySelector('[name="linkType"]');
            const eventContainer = form.querySelector('#promo-event-link-container');
            const urlContainer = form.querySelector('#promo-custom-url-container');
            const eventSelect = form.querySelector('[name="eventId"]');

            // 1. Function to show/hide the fields based on selection
            const togglePromoLinkFields = () => {
                if (linkTypeSelect.value === 'event') {
                    eventContainer.classList.remove('hidden');
                    urlContainer.classList.add('hidden');
                } else { // 'url'
                    eventContainer.classList.add('hidden');
                    urlContainer.classList.remove('hidden');
                }
            };

            // 2. Fetch events and populate the event dropdown
            apiFetch('events').then(events => {
                if (eventSelect && events) {
                    eventSelect.innerHTML = events.map(e => 
                        `<option value="${e.id}" ${data && data.event_id == e.id ? 'selected' : ''}>${e.title}</option>`
                    ).join('');
                }
            });

            // 3. Listen for changes on the main dropdown
            linkTypeSelect.addEventListener('change', togglePromoLinkFields);

            // 4. Set the initial state correctly when editing an existing promo
            if (data && data.link_type) {
                linkTypeSelect.value = data.link_type;
            }
            togglePromoLinkFields(); // Call once to set the initial view
        }

        if (type === 'category') {
            form.querySelector('[name="icon"]').innerHTML = ICONS.map(icon => `<option value="${icon}">${capitalize(icon)}</option>`).join('');
        }

        // ✅ FIX: Attach listener for "Add Booking Slot" button
        if (type === 'venue') {
            const slotsContainer = form.querySelector('#venue-slots-container');
            const addSlotBtn = form.querySelector('#add-venue-slot-btn');
            if (addSlotBtn && slotsContainer) {
                addSlotBtn.addEventListener('click', () => {
                    addVenueSlot(slotsContainer);
                });
            }
        }

        if (data) {
            for (const key in data) {
                const input = form.querySelector(`[name="${key}"]`);
                if (input && data[key] !== null) {
                    if (input.type === 'date' && data[key]) {
                        input.value = new Date(data[key]).toISOString().split('T')[0];
                    } else {
                        input.value = data[key];
                    }
                }
            }
        }

        if (type === 'event') {
            form.querySelectorAll('[data-time-group]').forEach(group => {
                const timeKey = group.dataset.timeGroup;
                createTimePicker(group, data ? data[timeKey] : null);
            });
        }
        
        if (type === 'venue' && data && data.available_slots) {
            const slotsContainer = form.querySelector('#venue-slots-container');
            data.available_slots.forEach(slot => addVenueSlot(slotsContainer, slot));
        }

        form.querySelectorAll('[data-dropzone]').forEach(dz => {
            const key = dz.dataset.dropzone;
            const input = dz.nextElementSibling;
            const previews = input.nextElementSibling;
            const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            const files = (data && data[dbKey]) ? [...data[dbKey]] : [];
            activeFormUploaderData[key] = { files: files, isMulti: input.multiple };
            setupUploader(dz, input, previews, activeFormUploaderData[key]);
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const itemData = Object.fromEntries(formData.entries());

            for (const key in activeFormUploaderData) {
                const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
                itemData[dbKey] = activeFormUploaderData[key].files;
            }

            form.querySelectorAll('[data-time-group]').forEach(group => {
                if (!group.closest('.relative.border')) { // Exclude slot time pickers
                    const selects = group.querySelectorAll('select');
                    let hour = parseInt(selects[0].value, 10);
                    if (selects[2].value === 'PM' && hour !== 12) hour += 12;
                    if (selects[2].value === 'AM' && hour === 12) hour = 0;
                    itemData[group.dataset.timeGroup] = `${hour.toString().padStart(2, '0')}:${selects[1].value}`;
                }
            });

            if (type === 'venue') {
                itemData.available_slots = [];
                form.querySelectorAll('#venue-slots-container > div').forEach(slotEl => {
                    const slotId = slotEl.querySelector('[name^="slot_day_"]').name.split('_')[2];
                    const startGroup = slotEl.querySelector(`[data-time-group="slot_start_${slotId}"]`);
                    const endGroup = slotEl.querySelector(`[data-time-group="slot_end_${slotId}"]`);
                    const getTime = (group) => {
                        if (!group) return null;
                        const selects = group.querySelectorAll('select');
                        let hour = parseInt(selects[0].value, 10);
                        if (selects[2].value === 'PM' && hour !== 12) hour += 12;
                        if (selects[2].value === 'AM' && hour === 12) hour = 0;
                        return `${hour.toString().padStart(2, '0')}:${selects[1].value}`;
                    };
                    itemData.available_slots.push({
                        day: slotEl.querySelector(`[name="slot_day_${slotId}"]`).value,
                        name: slotEl.querySelector(`[name="slot_name_${slotId}"]`).value,
                        start: getTime(startGroup),
                        end: getTime(endGroup)
                    });
                });
                
                if (itemData.amenities && typeof itemData.amenities === 'string') {
                    itemData.amenities = itemData.amenities.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    itemData.amenities = [];
                }
            }

            if (itemData.id) {
                itemData.id = parseInt(itemData.id, 10);
            }

            await saveItem(type, itemData);
        });
        
        openModal();
        lucide.createIcons();
    };

    // ===============================================
    // USER AUTHENTICATION & INITIALIZATION
    // ===============================================
    const handleLogin = async (e) => {
        e.preventDefault();
        const { username, password } = e.target;
        const errorEl = e.target.querySelector('[id$="-login-error"]');
        errorEl.textContent = '';
        try {
            const user = await apiFetch('login', 'POST', { username: username.value, password: password.value });
            if (user && user.id) {
                sessionStorage.setItem('loggedInUser', JSON.stringify(user));
                initAdminPanel(user);
            } else {
                errorEl.textContent = 'Invalid credentials.';
            }
        } catch (e) {
            errorEl.textContent = 'Failed to connect to the authentication service.';
        }
    };

    const initAdminPanel = (user) => {
        currentUser = user;
        loginSection.style.display = 'none';
        adminContainer.classList.remove('hidden');
        document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = user.role === 'super-admin' ? 'grid' : 'none');
        showPage('admin-hub-page');
    };

    // ===============================================
    // RENDER FUNCTIONS
    // ===============================================
    const mapRenderKeys = (type) => {
        switch (type) {
            case 'event': return { key: 'events' };
            case 'venue': return { key: 'venues' };
            case 'promo': return { key: 'promos' };
            case 'partner': return { key: 'partners' };
            case 'organizer':  // If the type is 'organizer'...
            case 'organizers': // ...OR if the type is 'organizers'...
            return { key: 'users' };
            case 'category': return { key: 'categories' }; 
            case 'gallery': return { key: 'galleries' };
            case 'highlight': return { key: 'highlights' };
            default: return { key: `${type}` };
        }
    };

    const createRenderFn = (type, listElId, template) => async () => {
        const { key: dbKey } = mapRenderKeys(type);
        try {
            const items = await apiFetch(dbKey);
            const filter = (currentUser && currentUser.role !== 'super-admin') ? item => item.organizerId === currentUser.id : null;
            const filteredItems = filter ? items.filter(filter) : items;
            document.getElementById(listElId).innerHTML = filteredItems.map(template).join('') || `<p class="text-center text-subheader py-4">No ${dbKey.replace(/_/g, ' ')} added.</p>`;
            lucide.createIcons();
        } catch (e) {
            console.error(`Could not fetch ${dbKey}:`, e);
        }
    };
    
    // ✅ FIX: Using poster_images array and a fallback image
    window.renderEvents = createRenderFn('event', 'admin-event-list', e => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${(e.poster_images && e.poster_images.length > 0) ? e.poster_images[0] : 'https://placehold.co/48x48/1a1a1a/ffffff?text=Img'}" class="w-12 h-12 object-cover rounded-md"><p class="font-semibold text-header ml-4">${e.title}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="event" data-id="${e.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="event" data-id="${e.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
    window.renderVenues = createRenderFn('venue', 'admin-venue-list', v => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${(v.images && v.images.length > 0) ? v.images[0] : 'https://placehold.co/48x48/1a1a1a/ffffff?text=Img'}" class="w-12 h-12 object-cover rounded-md"><p class="font-semibold text-header ml-4">${v.name}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="venue" data-id="${v.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="venue" data-id="${v.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
    window.renderCategories = createRenderFn('category', 'admin-category-list', c => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><i data-lucide="${c.icon}" class="w-6 h-6 icon-color"></i><p class="font-semibold text-header ml-4">${c.name}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="category" data-id="${c.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="category" data-id="${c.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
    window.renderPromos = createRenderFn('promo', 'admin-promo-list', p => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${p.background_url}" class="w-12 h-12 object-cover rounded-md"><p class="font-semibold text-header ml-4">${p.title}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="promo" data-id="${p.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="promo" data-id="${p.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
    window.renderPartners = createRenderFn('partner', 'admin-partner-list', p => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${p.logo_url}" class="w-12 h-12 object-contain bg-white rounded-md p-1"><p class="font-semibold text-header ml-4">${p.name}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="partner" data-id="${p.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="partner" data-id="${p.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
    window.renderUsers = createRenderFn('organizer', 'admin-organizer-list', u => u.role !== 'super-admin' ? `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><i data-lucide="user-circle" class="w-6 h-6 text-subheader"></i><p class="font-semibold text-header ml-4">${u.name} <span class="text-xs text-subheader">(${u.username})</span></p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="organizer" data-id="${u.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="organizer" data-id="${u.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>` : '');
    // Add these two lines with your other render function definitions

    window.renderGalleries = createRenderFn('gallery', 'admin-gallery-list', g => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${(g.image_urls && g.image_urls.length > 0) ? g.image_urls[0] : 'https://placehold.co/48x48/1a1a1a/ffffff?text=Img'}" class="w-12 h-12 object-cover rounded-md"><p class="font-semibold text-header ml-4">${g.caption || 'Gallery Item'}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="gallery" data-id="${g.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="gallery" data-id="${g.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);

    window.renderHighlights = createRenderFn('highlight', 'admin-highlight-list', h => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${(h.media_url && h.media_url.length > 0) ? h.media_url[0] : 'https://placehold.co/48x48/1a1a1a/ffffff?text=Img'}" class="w-12 h-12 object-cover rounded-md"><p class="font-semibold text-header ml-4">${h.caption || 'Highlight'}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="highlight" data-id="${h.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="highlight" data-id="${h.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
        // ===============================================
        // INITIALIZATION & EVENT LISTENERS
    // ===============================================
    document.getElementById('admin-login-form').addEventListener('submit', handleLogin);
    document.getElementById('organizer-login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-button').addEventListener('click', () => { sessionStorage.removeItem('loggedInUser'); window.location.reload(); });
    closeModalBtn.addEventListener('click', closeModal);
    
    document.getElementById('show-organizer-login-btn').addEventListener('click', () => { superAdminLoginPage.style.display = 'none'; organizerLoginPage.style.display = 'block'; });
    document.getElementById('show-admin-login-btn').addEventListener('click', () => { superAdminLoginPage.style.display = 'block'; organizerLoginPage.style.display = 'none'; });

    document.querySelectorAll('.back-to-hub-btn').forEach(b => b.addEventListener('click', () => showPage('admin-hub-page')));
    
    // Find and REPLACE your existing '.admin-nav-button' listener with this block



// Make sure this is your current navigation listener
document.querySelectorAll('.admin-nav-button').forEach(b => b.addEventListener('click', (e) => {
    console.clear();
    console.log("--- 🕵️‍♂️ DEBUGGING NAVIGATION ---");
    const target = e.currentTarget.dataset.target;
    console.log(`🎯 Checkpoint 1: Clicked button for target page -> "${target}"`);

    showPage(target);

    const type = target.split('-')[1];
    console.log(`✂️ Checkpoint 2: Extracted type from page ID -> "${type}"`);

    const { key: dbKey } = mapRenderKeys(type);
    console.log(`🔑 Checkpoint 3: Mapped to dbKey -> "${dbKey}"`);

    const renderFnName = `render${capitalize(dbKey)}`;
    console.log(`🚀 Checkpoint 4: Final render function name -> "${renderFnName}"`);

    if (window[renderFnName]) {
        console.log(`✅ SUCCESS: Function "${renderFnName}" exists. Calling it now.`);
        window[renderFnName]();
    } else {
        console.error(`❌ FAILURE: The function named "${renderFnName}" does NOT exist.`);
    }
    console.log("------------------------------------");
}));
    
    ['event', 'venue', 'category', 'promo', 'gallery', 'highlight', 'partner', 'organizer'].forEach(type => {
        const btn = document.getElementById(`add-new-${type}-btn`);
        if (btn) btn.addEventListener('click', () => setupForm(type));
    });
    
    document.body.addEventListener('click', e => {
        const btn = e.target.closest('.action-btn');
        if(btn) {
            const {type, id, action} = btn.dataset;
            const numericId = parseInt(id, 10);
            if (action === 'delete') {
                deleteItem(type, numericId);
            } else if (action === 'edit') {
                const { key: dbKey } = mapRenderKeys(type);
                apiFetch(`${dbKey}/${numericId}`).then(itemData => {
                    if (itemData) setupForm(type, itemData);
                }).catch(e => alert(`Failed to fetch item for editing: ${e.message}`));
            }
        }
    });


    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (loggedInUser) {
        initAdminPanel(JSON.parse(loggedInUser));
    } else {
        loginSection.style.display = 'block';
        superAdminLoginPage.style.display = 'block';
    }
    lucide.createIcons();
});