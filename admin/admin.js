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
            // --- ADD LOGS HERE ---
            console.log("DEBUG: renderPreviews called.");
            console.log("DEBUG: dataStore.files:", dataStore.files);
            
            const htmlString = (dataStore.files || []).map((src, index) =>
                `<div class="preview-image-container"><img src="${src}" class="w-full h-24 object-cover rounded-md"><button data-index="${index}" class="remove-preview-btn p-0.5"><i data-lucide="x" class="w-4 h-4 text-red-500"></i></button></div>`
            ).join('');
            
            console.log("DEBUG: Generated HTML:", htmlString);
            console.log("DEBUG: Target previewsContainer:", previewsContainer);
            // --- END LOGS ---

            previewsContainer.innerHTML = htmlString; // Set the HTML
            
            try { // Add error handling for Lucide
                 lucide.createIcons();
            } catch (e) {
                 console.error("Lucide error:", e);
            }
        };
        // ... rest of setupUploader ...
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
    // REPLACE your entire old setupForm function with this new one:

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
    
    if (type === 'promo') {
        const linkTypeSelect = form.querySelector('[name="linkType"]');
        const eventContainer = form.querySelector('#promo-event-link-container');
        const urlContainer = form.querySelector('#promo-custom-url-container');
        const eventSelect = form.querySelector('[name="eventId"]');

        const togglePromoLinkFields = () => {
            if (linkTypeSelect.value === 'event') {
                eventContainer.classList.remove('hidden');
                urlContainer.classList.add('hidden');
            } else { // 'url'
                eventContainer.classList.add('hidden');
                urlContainer.classList.remove('hidden');
            }
        };

        apiFetch('events').then(events => {
            if (eventSelect && events) {
                eventSelect.innerHTML = events.map(e => 
                    `<option value="${e.id}" ${data && data.event_id == e.id ? 'selected' : ''}>${e.title}</option>`
                ).join('');
            }
        });

        linkTypeSelect.addEventListener('change', togglePromoLinkFields);

        if (data && data.link_type) {
            linkTypeSelect.value = data.link_type;
        }
        togglePromoLinkFields();
    }

    if (type === 'category') {
        form.querySelector('[name="icon"]').innerHTML = ICONS.map(icon => `<option value="${icon}">${capitalize(icon)}</option>`).join('');
    }

    if (type === 'venue') {
        const slotsContainer = form.querySelector('#venue-slots-container');
        const addSlotBtn = form.querySelector('#add-venue-slot-btn');
        if (addSlotBtn && slotsContainer) {
            addSlotBtn.addEventListener('click', () => {
                addVenueSlot(slotsContainer);
            });
        }
    }

    // --- START FIX 1: DATA LOADING ---
    // This new block correctly maps your DB data to your HTML form names
    if (data) {
        // 1. Loop and fill all simple, matching fields (name, capacity, id)
        for (const key in data) {
            const input = form.querySelector(`[name="${key}"]`);
            if (input && data[key] !== null) {
                if (key === 'amenities' && Array.isArray(data[key])) {
                    input.value = data[key].join(', '); // Convert amenities array to string
                } else if (typeof data[key] !== 'object' && !Array.isArray(data[key])) {
                    input.value = data[key]; // Handles name, capacity, id
                }
            }
        }

        // 2. Manually map all mismatched fields
        if (type === 'venue') {
            // Map DB 'location' to HTML 'address'
            if (data.location) {
                const addressInput = form.querySelector('[name="address"]');
                if (addressInput) addressInput.value = data.location;
            }
            // Map DB 'cost_per_slot' to HTML 'costPerSlot'
            if (data.cost_per_slot) {
                const costInput = form.querySelector('[name="costPerSlot"]');
                if (costInput) costInput.value = data.cost_per_slot;
            }
            
            // Map DB 'details' object to HTML fields
            if (data.details) {
                // Map DB 'details.google_maps_url' to HTML 'mapUrl'
                if (data.details.google_maps_url) {
                    const mapInput = form.querySelector('[name="mapUrl"]');
                    if (mapInput) mapInput.value = data.details.google_maps_url;
                }
                // Map DB 'details.available_equipment' to HTML 'equipment'
                if (data.details.available_equipment) {
                    const equipInput = form.querySelector('[name="equipment"]');
                    if (equipInput) equipInput.value = data.details.available_equipment;
                }
            }
        }
    }

    // // --- START FIX for Promo Button Text ---
            if (type === 'promo') { // <--- Check if this block is entered
                console.log("DEBUG: Handling Promo Button Text. Data:", data); 
                if (data.button_text) {
                    const buttonTextInput = form.querySelector('[name="buttonText"]');
                    console.log("DEBUG: Found button text input:", buttonTextInput); // <--- Check if input is found
                    if (buttonTextInput) {
                        console.log("DEBUG: Setting button text value to:", data.button_text); // <--- Check the value
                        buttonTextInput.value = data.button_text;
                    }
                } else {
                     console.log("DEBUG: data.button_text is missing or empty.");
                }
            }
            // --- END FIX ---

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
    
    // --- START FIX 2: UPLOADER LOADING ---
    // This block correctly maps your DB photo arrays to your HTML data-dropzone names
   // REPLACE the old [data-dropzone] loop with this one
        form.querySelectorAll('[data-dropzone]').forEach(dz => {
            const key = dz.dataset.dropzone; // e.g., "backgroundUrl"
            const input = dz.nextElementSibling; // The <input type="file">
            const previews = input.nextElementSibling; // The previews container
            let dbKey = null; // Will store the matching database key (e.g., "background_url")
            let files = []; // Will store the files/URLs for the uploader state

            // --- Determine the correct DB key ---
            switch (key) {
                case 'venueGallery':     dbKey = 'gallery'; break;
                case 'eventSetupImages': dbKey = 'event_photos'; break;
                case 'menuImages':       dbKey = 'menu'; break;
                case 'imageUrls':        dbKey = 'image_urls'; break; // For gallery form
                case 'posterImages':     dbKey = 'poster_images'; break; // For event form
                case 'mediaUrl':         dbKey = 'media_url'; break; // For highlight form
                
              // --- FIX: Specific handling for Promo background ---
              // --- FIX: Specific handling for Promo background ---
                case 'backgroundUrl':    
                    dbKey = 'background_url'; 
                    console.log("DEBUG: Handling Promo Background. Data:", data); 
                    
                    let urlToLoad = null;
                    if (data && data[dbKey]) {
                        // Try to handle existing bad format {"..."}
                        if (typeof data[dbKey] === 'string' && data[dbKey].startsWith('{"') && data[dbKey].endsWith('"}')) {
                            try {
                                // Extract the URL from inside {"..."}
                                urlToLoad = data[dbKey].substring(2, data[dbKey].length - 2); 
                                console.log("DEBUG: Extracted URL from bad format:", urlToLoad);
                            } catch (e) { console.error("Error parsing bad background URL format", e); }
                        } 
                        // Handle correct string format
                        else if (typeof data[dbKey] === 'string') {
                            urlToLoad = data[dbKey];
                            console.log("DEBUG: Found background URL (correct format):", urlToLoad); 
                        }
                    }

                    if (urlToLoad) {
                        files = [urlToLoad]; // Put the single URL into an array
                    } else {
                        console.log("DEBUG: data.background_url is missing or invalid.");
                        files = [];
                    }
                    break;
                 // --- END FIX ---

                 // --- FIX: Specific handling for Partner logo ---
                 case 'logoUrl':
                     dbKey = 'logo_url';
                     if (data && data[dbKey] && typeof data[dbKey] === 'string') {
                         files = [data[dbKey]];
                     } else {
                         files = [];
                     }
                     break;
                 // --- END FIX ---

                default:
                    // Fallback (might work for simple cases)
                    dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
                    if (data && data[dbKey] && Array.isArray(data[dbKey])) {
                         files = [...data[dbKey]];
                    } else if (data && data[dbKey] && typeof data[dbKey] === 'string') {
                        // Handle potential single string fallback? Risky.
                         files = [data[dbKey]];
                    } else {
                         files = [];
                    }
                    console.warn(`Uploader mapping fallback used for key: ${key} -> ${dbKey}`);
            }

            // --- Setup uploader state ---
            // 'isMulti' is true if the file input allows multiple files
            activeFormUploaderData[key] = { files: files, isMulti: input.multiple }; 
            setupUploader(dz, input, previews, activeFormUploaderData[key]);
        });
    // --- END FIX 2 ---
    
   // --- START: Assign submit handler using .onsubmit ---
        form.onsubmit = async (e) => {
            e.preventDefault(); // Prevent default form submission
            
            // 'data' object (for edits) is available here directly from setupForm's scope
            const originalData = data || null; 
            
            console.log(`onsubmit handler running for type: ${type}`);

            // --- Gather Form Data ---
            const formData = new FormData(form);
            const itemData = Object.fromEntries(formData.entries());
            // --- ADD THIS LOG ---
            console.log("DEBUG: Event ID selected in form:", itemData.eventId); 
            // --- END LOG ---

            // --- Process Uploaded Images ---
            for (const uploaderKey in activeFormUploaderData) {
                let targetDbKey = null;
                 if (type === 'gallery' && uploaderKey === 'imageUrls') { targetDbKey = 'image_urls'; } 
                 else if (type === 'event' && uploaderKey === 'posterImages') { targetDbKey = 'poster_images'; }
                 // *** Add your venue mappings here if needed ***
                 // else if (type === 'venue' && uploaderKey === 'images') { targetDbKey = 'gallery'; } 
                 // else if (type === 'venue' && uploaderKey === 'eventSetupImages') { targetDbKey = 'event_photos'; }
                 // else if (type === 'venue' && uploaderKey === 'menuImages') { targetDbKey = 'menu'; }
                 else { targetDbKey = uploaderKey.replace(/([A-Z])/g, "_$1").toLowerCase(); }

                 if (targetDbKey) {
                    itemData[targetDbKey] = activeFormUploaderData[uploaderKey].files || [];
                 }
            }

            // --- Process Time Pickers ---
            form.querySelectorAll('[data-time-group]').forEach(group => {
                 if (!group.closest('.relative.border')) { 
                    const selects = group.querySelectorAll('select');
                    let hour = parseInt(selects[0].value, 10);
                    if (selects[2].value === 'PM' && hour !== 12) hour += 12;
                    if (selects[2].value === 'AM' && hour === 12) hour = 0;
                    itemData[group.dataset.timeGroup] = `${hour.toString().padStart(2, '0')}:${selects[1].value}`;
                 }
            });
            
            // --- Process Venue-Specific Data ---
             if (type === 'venue') {
                 // (Ensure all your venue-specific logic is correctly placed here)
                 itemData.available_slots = [];
                 form.querySelectorAll('#venue-slots-container > div').forEach(slotEl => { /* ... get slot data ... */ 
                    const slotId = slotEl.querySelector('[name^="slot_day_"]').name.split('_')[2];
                     const startGroup = slotEl.querySelector(`[data-time-group="slot_start_${slotId}"]`);
                     const endGroup = slotEl.querySelector(`[data-time-group="slot_end_${slotId}"]`);
                     const getTime = (group) => { /* ... (your getTime logic) ... */ 
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
                 if (itemData.amenities && typeof itemData.amenities === 'string') { /* ... amenities logic ... */ 
                    itemData.amenities = itemData.amenities.split(',').map(s => s.trim()).filter(Boolean);
                 } else if (!Array.isArray(itemData.amenities)) { itemData.amenities = []; }
                 itemData.location = itemData.address; itemData.cost_per_slot = itemData.costPerSlot;
                 itemData.gallery = itemData.images; itemData.event_photos = itemData.eventSetupImages; itemData.menu = itemData.menuImages;
                 itemData.details = {};
                 if (itemData.mapUrl) { itemData.details.google_maps_url = itemData.mapUrl; }
                 if (itemData.equipment) { itemData.details.available_equipment = itemData.equipment; }
                 delete itemData.address; delete itemData.costPerSlot; delete itemData.images;
                 delete itemData.eventSetupImages; delete itemData.menuImages; delete itemData.mapUrl; delete itemData.equipment;
                 if (!itemData.gallery) itemData.gallery = []; if (!itemData.event_photos) itemData.event_photos = [];
                 if (!itemData.menu) itemData.menu = []; if (!itemData.available_slots) itemData.available_slots = [];
             }
             
             // --- Handle ID for Edit vs. Create ---
             if (itemData.id) {
                itemData.id = parseInt(itemData.id, 10);
                if (isNaN(itemData.id)) { delete itemData.id; }
             }
             // Use 'originalData' which comes from the setupForm scope
             if (originalData && originalData.id && !itemData.id) {
                itemData.id = originalData.id; 
             }
             
             console.log("--- FINAL PAYLOAD (.onsubmit) ---");
             console.log("Type:", type);
             console.log("Data:", itemData); 

             await saveItem(type, itemData);
        };
        // --- END: Assign submit handler using .onsubmit ---

        openModal();
        lucide.createIcons();
    }; // End of setupForm function



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
   window.renderVenues = createRenderFn('venue', 'admin-venue-list', v => `<div class="list-item flex items-center justify-between p-4 rounded-lg"><div class="flex items-center"><img src="${v.image_url || 'https://placehold.co/48x48/1a1a1a/ffffff?text=Img'}" class="w-12 h-12 object-cover rounded-md"><p class="font-semibold text-header ml-4">${v.name}</p></div><div class="flex items-center space-x-3"><button class="action-btn" data-type="venue" data-id="${v.id}" data-action="edit"><i data-lucide="edit"></i></button><button class="action-btn" data-type="venue" data-id="${v.id}" data-action="delete"><i data-lucide="trash-2"></i></button></div></div>`);
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
                
                // --- START DEBUG ---
                console.log(`Attempting to fetch item for edit: type=${type}, id=${numericId}, endpoint=/${dbKey}/${numericId}`);
                
                apiFetch(`${dbKey}/${numericId}`).then(itemData => {
                    console.log('--- SERVER RESPONSE (itemData) ---');
                    console.log(itemData);
                    console.log('---------------------------------');
                    
                    if (itemData) {
                        console.log('Data found. Calling setupForm...');
                        setupForm(type, itemData);
                    } else {
                        console.error('Fetch was successful but NO data was returned. Form will be blank.');
                    }
                }).catch(e => {
                    console.error('--- FETCH FAILED ---');
                    console.error(e);
                    alert(`Failed to fetch item for editing: ${e.message}`);
                });
                // --- END DEBUG ---
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