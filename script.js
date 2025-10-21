// Global Data Variables (To be populated by API)
let promotionalSlides = [];
let categories = [];
let events = [];
let venues = [];
let userBookings = [];
let eventHighlights = [];
let galleries = []; // <-- Add this
let partners = [];
// Global variables for current context
let currentEventData = null; 
let currentVenueData = null;
let currentReservation = {};
 
// --- Story Viewer State ---
let currentHighlightIndex = 0;
let currentStoryIndex = 0;
let storyTimeout;
 
// --- Filtering State ---
let activeFilters = {
    package: [],
    tag: [],
    price: [],
    location: []
};

// Global DOM references (Initialized in DOMContentLoaded)
let profileDropdown;
let menuToggleBtn;
let geminiModal;
let geminiModalTitle;
let geminiLoading;
let geminiResponseText;
let authModal;
let authContent;
let floatingFilterBtn;

// -----------------------------------------------------------------------
// --- API INTEGRATION & DATA FETCHING ---
// -----------------------------------------------------------------------

// !!! IMPORTANT: THIS MUST POINT TO YOUR EXPRESS SERVER'S ROOT ADDRESS AND PORT !!!
const API_BASE_URL = 'http://localhost:3000/api/public';

async function fetchData(endpoint) {
    try {
        // This line MUST correctly combine the base URL and the endpoint
        const response = await fetch(`${API_BASE_URL}/${endpoint}`); // <--- Check this line
        if (!response.ok) {
            throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return [];
    }
}

async function fetchAllData() {
    console.log("Fetching all application data from API...");
    
    // Add galleries and partners to the Promise.all call
    const [
        fetchedEvents,
        fetchedVenues,
        fetchedCategories,
        fetchedPromos,
        fetchedHighlights,
        fetchedGalleries, // <-- Add this
        fetchedPartners,  // <-- Add this
        fetchedBookings   // Keep bookings (or remove if not ready)
    ] = await Promise.all([
        fetchData('events'),
        fetchData('venues'),
        fetchData('categories'),
        fetchData('promos'),
        fetchData('highlights'),
        fetchData('galleries'), // <-- Add this API call
        fetchData('partners'),  // <-- Add this API call
        fetchData('user/bookings') // Keep or remove based on readiness
    ]);

    // Assign the fetched data to the global variables
    events = fetchedEvents || [];
    venues = (fetchedVenues || []).map((v, i) => ({ ...v, id: v.id || i + 1 }));
    categories = fetchedCategories || [];
    promos = fetchedPromos || []; // Assign promos here
    highlights = fetchedHighlights || [];
    galleries = fetchedGalleries || []; // <-- Assign galleries
    partners = fetchedPartners || [];   // <-- Assign partners
    userBookings = fetchedBookings || []; 

    // Update the log message
    console.log(`Data loaded: ${events.length} events, ${venues.length} venues, ${categories.length} categories, ${promos.length} promos, ${highlights.length} highlights, ${galleries.length} galleries, ${partners.length} partners.`);
}

async function callGeminiAPI(prompt, retries = 3, delay = 1000) {
    const apiKey = ""; // Leave this empty. Canvas will inject the key.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429 && retries > 0) { // Rate limit handling
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGeminiAPI(prompt, retries - 1, delay * 2); // Exponential backoff
            }
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
            let text = candidate.content.parts[0].text;
            text = text.replace(/\*\*(.*?)\*\*/g, '<h3>$1</h3>'); 
            text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
            return text;
        } else {
            return "Sorry, I couldn't generate a response. The result was empty.";
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "Sorry, there was an error connecting to the AI service. Please try again later.";
    }
}

function showGeminiModal(title) {
    if (!geminiModal) return;
    if (geminiModalTitle) geminiModalTitle.textContent = title;
    if (geminiResponseText) geminiResponseText.innerHTML = '';
    if (geminiLoading) geminiLoading.style.display = 'flex';
    geminiModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideGeminiModal() {
    if (!geminiModal) return;
    geminiModal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function getEventVibe() {
    if (!currentEventData) return;
    
    showGeminiModal("What's the Vibe?");

    const { title, details, locationDetails } = currentEventData;
    const prompt = `As a Bangalore party expert, describe the vibe for the following event in a short, exciting, and catchy paragraph. Mention the likely crowd, the music style, and suggest a dress code. Make it sound like a local's inside tip. Event Name: "${title}" Venue: "${locationDetails.venueName}, ${locationDetails.address}" Details: "${details.description}"`;

    const response = await callGeminiAPI(prompt);
    
    if (geminiLoading) geminiLoading.style.display = 'none';
    if (geminiResponseText) geminiResponseText.innerHTML = response;
}

async function planNightOut() {
    if (!currentVenueData) return;

    showGeminiModal("Plan My Night Out");

    const { name, location, details, menu } = currentVenueData;
    const prompt = `You are a local concierge for Bengaluru. A user is going to the following venue. Create a simple, fun "Night Out Plan" for them. Suggest one specific, cool place nearby for a pre-party drink or snack. Then, suggest one specific, interesting place for a post-party late-night meal. Keep the descriptions brief and exciting. Format the response clearly with headings. Venue Name: "${name}" Location: "${location}" Venue Details: "${details.description} Serves ${menu ? menu.items : 'general cuisine'}."`;

    const response = await callGeminiAPI(prompt);

    if (geminiLoading) geminiLoading.style.display = 'none';
    if (geminiResponseText) geminiResponseText.innerHTML = response;
}
 
async function getRecommendations() {
    const pastBookings = userBookings.filter(b => b.status === 'past');
    if (pastBookings.length === 0) {
        alert("You don't have any past bookings for us to base recommendations on. Go to an event first!");
        return;
    }
    
    showGeminiModal("Your Next Night Out");
    
    const attendedEvents = pastBookings.map(b => `- ${b.eventName} at ${b.venueName}`).join('\n');
    const prompt = `As a Bangalore party expert, my friend has attended these events recently: ${attendedEvents} Based on this history, suggest 3 upcoming events in Bangalore they would absolutely love. For each event, give the name, a one-sentence reason why they'd like it, and a suggested venue. Be creative and make the recommendations sound exciting and personal.`;
    
    const response = await callGeminiAPI(prompt);
    
    if (geminiLoading) geminiLoading.style.display = 'none';
    if (geminiResponseText) geminiResponseText.innerHTML = response;
}

// -----------------------------------------------------------------------
// --- PROFILE & AUTHENTICATION LOGIC (WITH API CALLS) -------------------
// -----------------------------------------------------------------------

let currentAuthStep = 'login'; 
let currentAuthType = 'login'; 

function toggleProfileMenu() {
    if (profileDropdown) profileDropdown.classList.toggle('hidden');
}

// Close the dropdown if clicking outside of it
window.addEventListener('click', function(event) {
    if (menuToggleBtn && profileDropdown) {
        if (!menuToggleBtn.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.add('hidden');
        }
    }
});


function showAuthModal(defaultTab = 'login') {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
    switchAuthTab(defaultTab);
}

function hideAuthModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    document.body.style.overflow = '';
    switchAuthTab('login');
}

function switchAuthTab(tabName) {
    currentAuthStep = tabName;
    currentAuthType = tabName;
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const targetTab = document.getElementById(`tab-${tabName}`);

    if (tabLogin) tabLogin.classList.remove('border-[var(--color-accent)]', 'text-white');
    if (tabLogin) tabLogin.classList.add('border-transparent', 'text-gray-500');
    if (tabRegister) tabRegister.classList.remove('border-[var(--color-accent)]', 'text-white');
    if (tabRegister) tabRegister.classList.add('border-transparent', 'text-gray-500');

    if (targetTab) targetTab.classList.add('border-[var(--color-accent)]', 'text-white');
    if (targetTab) targetTab.classList.remove('border-transparent', 'text-gray-500');

    document.querySelectorAll('.auth-view').forEach(view => view.classList.add('hidden'));
    const targetForm = document.getElementById(`form-${tabName}`);
    if (targetForm) targetForm.classList.remove('hidden');
}

// Function to call your backend to request an OTP via SMS
async function requestOtp(type) {
    let phoneNumber = '';
    const name = type === 'register' ? document.getElementById('register-name').value : '';
    const email = type === 'register' ? document.getElementById('register-email').value : '';

    if (type === 'login') {
        phoneNumber = document.getElementById('login-phone').value;
    } else if (type === 'register') {
        phoneNumber = document.getElementById('register-phone').value;
    }

    if (phoneNumber.length !== 10) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }
    
    // 1. Get the button element and set loading state
    // NOTE: Assuming IDs 'login-otp-btn' and 'register-otp-btn' are now on the form submit buttons.
    const btnId = type === 'login' ? 'login-otp-btn' : 'register-otp-btn';
    // If the buttons don't have IDs, this will be null. We try to find the submit button within the form.
    let btn = document.getElementById(btnId);
    if (!btn) {
        const form = document.getElementById(`form-${type}`);
        btn = form ? form.querySelector('button[type="submit"]') : null;
        if (!btn) return; 
    }

    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
        // 2. Call your backend API
        const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: `+91${phoneNumber}`, name, email, type })
        });
        
        const result = await response.json();

        if (result.success) {
            // 3. Success: Move to OTP verification screen
            currentAuthStep = 'otp';
            currentAuthType = type;
            
            const otpTargetPhoneEl = document.getElementById('otp-target-phone');
            if (otpTargetPhoneEl) otpTargetPhoneEl.textContent = "+91 " + phoneNumber;

            document.querySelectorAll('.auth-view').forEach(view => view.classList.add('hidden'));
            const formOtpEl = document.getElementById('form-otp');
            if (formOtpEl) formOtpEl.classList.remove('hidden');
            
            const otpInputs = document.querySelectorAll('#form-otp input');
            if (otpInputs.length > 0) otpInputs[0].focus();

            alert("OTP sent successfully! Please check your phone.");

        } else {
            alert("Failed to send OTP: " + (result.message || "Unknown error."));
        }
    } catch (error) {
        console.error("Error requesting OTP:", error);
        alert("Could not connect to the authentication service. Please try again. Ensure your backend server is running.");
    } finally {
        // 4. Reset button state
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Function to call your backend to verify the OTP
async function verifyOtp() {
    const otpInputs = document.querySelectorAll('#form-otp input');
    let otp = '';
    otpInputs.forEach(input => otp += input.value);
    
    // NOTE: The HTML has 6 inputs, but the backend OTP may be 4. Adjust this based on your backend logic.
    if (otp.length !== 6) { 
        alert("Please enter the full 6-digit OTP.");
        return;
    }
    
    const otpTargetPhoneEl = document.getElementById('otp-target-phone');
    const phoneNumber = otpTargetPhoneEl ? otpTargetPhoneEl.textContent.replace('+91 ', '') : '';
    
    // 1. Show loading/feedback
    let btn = document.getElementById('verify-otp-btn');
    if (!btn) {
        const form = document.getElementById('form-otp');
        btn = form ? form.querySelector('button[type="submit"]') : null;
        if (!btn) return;
    }

    const originalText = btn.textContent;
    btn.textContent = 'Verifying...';
    btn.disabled = true;

    try {
        // 2. Call your backend API to verify the code
        const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: `+91${phoneNumber}`, otp, type: currentAuthType })
        });
        
        const result = await response.json();

        if (result.success && result.token) {
            // Success! Store the authentication token (e.g., in localStorage)
            localStorage.setItem('userToken', result.token);
            alert(`OTP Verified successfully! Welcome to Party in Bangalore!`);
            hideAuthModal(); 
            location.reload(); 
        } else {
            alert("Verification failed. The OTP is incorrect or has expired.");
            // Clear inputs on failure
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        alert("Could not connect to the verification service. Please try again.");
    } finally {
        // 3. Reset button state
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function resendOtp() {
    alert("OTP resent! Please check your phone.");
    console.log(`[AUTH SIM] OTP resent for type: ${currentAuthType}`);
}
 
// -----------------------------------------------------------------------
// --- FILTER AND UTILITY LOGIC (COMPLETED) ---
// -----------------------------------------------------------------------

// --- Filter Modal Variables are now placed here using const/let for visibility
const filterModal = document.getElementById('filter-modal');
const filterModalContent = filterModal ? filterModal.querySelector('.filter-modal-content') : null;

function showFilterModal() {
    if (!filterModal) return;
    document.querySelectorAll('.filter-option').forEach(el => {
        const type = el.dataset.filterType;
        const value = el.dataset.filterValue;
        if (activeFilters[type] && activeFilters[type].includes(value)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    filterModal.classList.remove('hidden');
    if (filterModalContent) {
        setTimeout(() => {
            filterModalContent.style.transform = 'translateY(0)';
        }, 10);
    }
    document.body.style.overflow = 'hidden'; 
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideFilterModal() {
    if (filterModalContent) filterModalContent.style.transform = 'translateY(100%)';
    setTimeout(() => {
        if (filterModal) filterModal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}
 
function clearAllFilters(updateUI = true) {
    activeFilters = { package: [], tag: [], price: [], location: [] };
    if (updateUI) {
        document.querySelectorAll('.filter-option.active').forEach(el => {
            el.classList.remove('active');
        });
        applyFilters(); 
    }
}
 
function toggleFilterOption(element) {
    element.classList.toggle('active');
    const type = element.dataset.filterType;
    const value = element.dataset.filterValue;

    if (activeFilters[type]) {
        if (element.classList.contains('active')) {
            if (!activeFilters[type].includes(value)) {
                activeFilters[type].push(value);
            }
        } else {
            activeFilters[type] = activeFilters[type].filter(v => v !== value);
        }
    }
    
    applyFilters();
}

function toggleFilterSection(button) {
    const container = button.nextElementSibling; 
    const icon = button.querySelector('i');
    
    if (!icon || !container) return; 

    if (container.classList.contains('filter-open')) {
        container.classList.remove('filter-open');
        button.setAttribute('aria-expanded', 'false');
        if (icon.classList) icon.classList.remove('rotate-180');
        container.style.maxHeight = '0';
    } else {
        container.classList.add('filter-open');
        button.setAttribute('aria-expanded', 'true');
        if (icon.classList) icon.classList.add('rotate-180');
        container.style.maxHeight = '700px'; 
    }
}

function handleCategoryClick(categoryName) {
    clearAllFilters(false); 
    let tag = '';
    switch(categoryName) {
        case 'Concerts': tag = 'Live Music'; break;
        case 'DJ Sets':
        case 'Nightclub': tag = 'DJ Party Night'; break;
        case 'Techno': tag = 'Techno'; break;
        case 'Bollywood': tag = 'Bollywood Night'; break;
        default: break;
    }
    if (tag) {
        activeFilters.tag.push(tag);
    }
    navigateTo('events');
    applyFilters();
}

function applyFilters() {
    let filteredEvents = events;
    
    const selectedTags = activeFilters.tag;
    
    if (selectedTags.length > 0) {
        filteredEvents = filteredEvents.filter(event => {
            if (!event.tags) return false;
            return selectedTags.some(selectedTag => event.tags.includes(selectedTag));
        });
    }

    const grid = document.getElementById('explore-event-grid');
    if (grid) {
        if (filteredEvents.length > 0) {
            grid.innerHTML = filteredEvents.map(renderEventCard).join('');
        } else {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400">
                <i data-lucide="frown" class="w-10 h-10 mx-auto mb-3"></i>
                <p>No events found matching your current selection. Try clearing some filters!</p>
            </div>`;
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- CAROUSEL SCROLLING LOGIC ---
function scrollCarousel(direction) {
    const carousel = document.getElementById('event-list-grid');
    if (carousel) {
        const card = carousel.querySelector('.event-card');
        if (!card) return;
        
        const cardWidth = card.offsetWidth;
        const spacing = 16; // space-x-4 in Tailwind
        const scrollDistance = (cardWidth * 2) + (spacing * 2); 
        
        carousel.scrollBy({
            left: direction * scrollDistance,
            behavior: 'smooth'
        });
    }
}

// --- PAGE NAVIGATION LOGIC ---
function navigateTo(page, subTab = 'my-tickets') {
    const views = {
        'home': document.getElementById('home-view'),
        'events': document.getElementById('events-view'),
        'venues': document.getElementById('venues-view'),
        'venue-detail': document.getElementById('venue-detail-view'),
        'event-detail': document.getElementById('event-detail-view'),
        'booking': document.getElementById('booking-view'), 
        'reservation': document.getElementById('reservation-view'),
        'profile': document.getElementById('profile-view'),
        'my-tickets': document.getElementById('my-tickets-view'),
    };
 
    const venueCtaFixed = document.getElementById('venue-cta-fixed');
    const eventCtaFixed = document.getElementById('event-cta-fixed'); 
    const bookingCtaFixed = document.getElementById('booking-cta-fixed');
    const reservationCtaFixed = document.getElementById('reservation-cta-fixed');
    const mobileNav = document.getElementById('mobile-footer-nav');
    const mainFooter = document.getElementById('main-footer');
    
    if (venueCtaFixed) [venueCtaFixed, eventCtaFixed, bookingCtaFixed, reservationCtaFixed].forEach(cta => cta && cta.classList.add('hidden'));
    
    const isDetailPage = ['venue-detail', 'event-detail', 'booking', 'reservation', 'profile', 'my-tickets'].includes(page);
    if (mobileNav) mobileNav.classList.toggle('hidden', isDetailPage);
    if (mainFooter) mainFooter.classList.toggle('hidden', isDetailPage);
    
    if (page === 'venue-detail' && venueCtaFixed) venueCtaFixed.classList.remove('hidden');
    else if (page === 'event-detail' && eventCtaFixed) eventCtaFixed.classList.remove('hidden');
    else if (page === 'booking' && bookingCtaFixed) bookingCtaFixed.classList.remove('hidden');
    else if (page === 'reservation' && reservationCtaFixed) reservationCtaFixed.classList.remove('hidden');
    
    if (page === 'my-tickets') {
        switchTicketTab(subTab); 
        calculatePartyStreak();
    }

    if (floatingFilterBtn) floatingFilterBtn.classList.toggle('hidden', page !== 'events');

    Object.keys(views).forEach(key => {
        if (views[key]) {
            views[key].classList.toggle('hidden', key !== page);
        }
    });
    
    if (!isDetailPage) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('nav-active', 'text-[var(--color-accent)]');
            link.classList.add('text-gray-400');
        });
        const activeLink = document.getElementById(`nav-${page}`);
        if (activeLink) {
            activeLink.classList.add('nav-active', 'text-[var(--color-accent)]');
            activeLink.classList.remove('text-gray-400');
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log(`Mapped to: ${page} view.`);
}

// --- EVENT DETAIL & SHARE LOGIC ---

// REPLACE your old showEventDetails function with this one

async function showEventDetails(eventId) {
    console.log(`Attempting to show details for event ID: ${eventId}`); // Debug log
    if (!eventId) {
        console.error("showEventDetails called with invalid eventId");
        return;
    }
    try {
        // Fetch fresh, full details for this specific event from the correct public endpoint
        const event = await fetchData(`events/${eventId}`);
        if (!event || !event.id) throw new Error('Event data not found or invalid.');
        currentEventData = event; // Store globally

        console.log("Fetched event data:", event); // Debug log

        // --- Populate using correct DB fields ---

        // Poster Image
        const posterImg = document.getElementById('event-poster-img');
        // ✅ Use poster_images (JSONB array), provide fallback
        if(posterImg) posterImg.src = (event.poster_images && event.poster_images[0]) ? event.poster_images[0] : 'https://placehold.co/800x800/1a1a1a/ffffff?text=No+Image';

        // Title
        const detailTitle = document.getElementById('detail-event-title');
        if(detailTitle) detailTitle.textContent = event.title || 'Event Title';

        // Date & Time
        const eventDate = event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Date TBD';
        // ✅ Use start_time and end_time
        const startTime = event.start_time ? event.start_time.substring(0, 5) : '';
        const endTime = event.end_time ? event.end_time.substring(0, 5) : '';
        const dateTimeEl = document.getElementById('detail-event-datetime');
        if(dateTimeEl) dateTimeEl.textContent = `${eventDate}${startTime ? ' ' + startTime : ''}${endTime ? ' - ' + endTime : ''}`;

        // Location (Venue Name)
        const locationEl = document.getElementById('detail-event-location');
        // ✅ Use venue_name (comes from the JOIN in the API)
        if(locationEl) locationEl.textContent = event.venue_name || 'Venue TBD';

        // Venue Name Link (potentially redundant)
        const venueNameEl = document.getElementById('detail-event-venue-name');
        if(venueNameEl) venueNameEl.textContent = event.venue_name || 'Venue Details Unavailable';
        // Optional: Update the onclick for the venue name link if needed
        // if(venueNameEl && event.venue_id) venueNameEl.onclick = () => showVenueDetails(event.venue_id);

        // Description
        const descEl = document.getElementById('detail-event-description');
        // ✅ Use event_details (text column)
        if(descEl) descEl.textContent = event.event_details || 'No details available.';

        // Price CTA
        const priceCtaEl = document.getElementById('detail-event-price-cta');
        // ✅ Use price_display
        if(priceCtaEl) priceCtaEl.textContent = event.price_display || 'Free';

        // Event Address (Needs venue details - fetching separately might be better)
        const addressEl = document.getElementById('detail-event-address');
        // For now, just use venue name as placeholder, or fetch venue details
        if(addressEl) addressEl.textContent = event.venue_name || 'Address details unavailable';

        // Render "Other Events" using the globally fetched 'events' list
        const otherEventsContainer = document.getElementById('other-events-grid');
        if (otherEventsContainer && window.renderEventCard && typeof window.renderEventCard === 'function') { // Check if renderEventCard exists
            otherEventsContainer.innerHTML = events // Use global events list
                .filter(e => e.id !== eventId) // Exclude current event
                .slice(0, 5) // Limit to 5
                .map(renderEventCard) // Use the card rendering function
                .join('');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else if (!window.renderEventCard || typeof window.renderEventCard !== 'function') {
             console.error("renderEventCard function is not defined globally.");
        }
        // --- Add this logic inside your function that shows event details ---

// 1. Get the map URL from your admin data
// (Ensure your admin panel saves the Google Maps *embed src URL*)
// --- THIS IS THE CORRECTED LINE ---
// This is the correct column name from your database
const mapUrl = currentEventData.google_map_url; // Or whatever you call it, e.g., eventData.locationLink

// 2. Find the container we just made
const mapContainer = document.getElementById('event-map-container');

// 3. Check if you have a map URL and a container
if (mapUrl && mapContainer) {
    // 4. Create a new iframe element
    const iframe = document.createElement('iframe');
    iframe.src = mapUrl;
    iframe.className = 'w-full h-full';
    iframe.style.border = '0';
    iframe.allowFullscreen = '';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';

    // 5. Clear the placeholder image and add the new map
    mapContainer.innerHTML = ''; // This removes the placeholder
    mapContainer.appendChild(iframe);
}
// --- Add this line inside showEventDetails ---

// This finds the div and injects the text from your database
document.getElementById('terms-options').innerHTML = currentEventData.terms_and_conditions;


// --- Add this logic inside showEventDetails ---

/// --- INSIDE your showEventDetails function ---
// --- THIS IS THE NEW, CORRECTED BLOCK ---

// 1. Find the gallery container and clear it
const galleryContainer = document.getElementById('detail-event-gallery');
galleryContainer.innerHTML = ''; // Clear hardcoded images

// 2. Find all gallery *rows* for this event.
//    (This uses the correct 'galleries' variable)
const galleryRows = galleries.filter(row => row.event_id === currentEventData.id);

// 3. Extract all URLs from those rows into a single flat array
//    (This correctly handles the 'image_urls' JSON array)
const allImageUrls = galleryRows.flatMap(row => row.image_urls || []);

// 4. Loop through the *correct* flat array of URLs and build the gallery
if (allImageUrls && allImageUrls.length > 0) {
    allImageUrls.forEach(imageUrl => { // 'imageUrl' is now a string (e.g., "http://.../img1.png")
        // Create a new <img> element
        const img = document.createElement('img');
        
        img.src = imageUrl; // This is now correct
        img.className = 'w-full h-auto object-cover rounded-lg';
        
        // Add the new image to the container
        galleryContainer.appendChild(img);
    });
} else {
    // Optional: Show a message if no images
    galleryContainer.innerHTML = '<p class="text-gray-400 text-sm col-span-3">No gallery images available for this event.</p>';
}


        navigateTo('event-detail');
    } catch (error) {
        console.error(`Error showing event details for ID ${eventId}:`, error);
        alert("Could not load event details at this time.");
    }
}
 
function navigateToVenueFromEvent() {
    if (currentEventData?.locationDetails?.venueId) {
        showVenueDetails(currentEventData.locationDetails.venueId);
    } else {
        alert("Venue details are not currently available for this event.");
    }
}
 
const shareModal = document.getElementById('share-modal');
const shareModalContent = shareModal ? shareModal.querySelector('.share-modal-content') : null;
 
function showShareModal() {
    if (!currentEventData || !shareModal) return;
    copyToClipboard('https://partyinbangalore.com/event/' + currentEventData.id);
    shareModal.classList.remove('hidden');
    if (shareModalContent) setTimeout(() => { shareModalContent.style.transform = 'translateY(0)'; }, 10);
    document.body.style.overflow = 'hidden'; 
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideShareModal() {
    if (shareModalContent) shareModalContent.style.transform = 'translateY(100%)';
    setTimeout(() => {
        if (shareModal) shareModal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert("Link copied to clipboard!");
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
        alert("Could not copy link automatically. Please manually select the text.");
    }
    document.body.removeChild(textarea);
}

function shareViaWhatsApp(eventTitle) {
    const shareUrl = 'https://partyinbangalore.com/event/' + currentEventData.id;
    const shareText = `Check out this awesome event in Bangalore: ${eventTitle} - Book now! ${shareUrl}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank');
    hideShareModal();
}

function shareViaInstagram(eventTitle) {
    alert(`Link copied for ${eventTitle}! Instagram sharing must be done natively. Paste the copied link into your story or post.`);
    hideShareModal();
}

function downloadPoster(eventTitle) {
    alert(`Simulating download of poster for ${eventTitle}. In a real app, this would trigger a file download.`);
    hideShareModal();
}

// --- VENUE DETAIL LOGIC (COMPLETED) ---
function showVenueDetails(venueId) {
    const venue = venues.find(v => v.id === venueId);
    if (!venue) return;
    currentVenueData = venue;

    document.getElementById('detail-venue-name').textContent = venue.name;
    document.getElementById('detail-venue-title').textContent = venue.name;
    document.getElementById('detail-venue-capacity').innerHTML = `<i data-lucide="users" class="w-4 h-4 mr-2 text-[var(--color-accent)]"></i> Capacity: ${venue.capacity} Guests`;
    document.getElementById('detail-venue-cost').innerHTML = `<i data-lucide="wallet" class="w-4 h-4 mr-2 text-[var(--color-accent)]"></i> ₹${venue.costPerSlot} per slot`;
    // --- With these safer versions ---
   // --- With these safer versions ---
    const descEl = document.getElementById('detail-venue-description');
    // ✅ Use optional chaining for JSONB properties
    if(descEl) descEl.textContent = venue.details?.description || 'No description available.';

    const addressEl = document.getElementById('detail-venue-address');
    // ✅ Use optional chaining and fallback to 'location' column
    if(addressEl) addressEl.textContent = venue.details?.address || venue.location || 'Address not available';

    const amenitiesContainer = document.getElementById('detail-venue-amenities');
    amenitiesContainer.innerHTML = (venue.amenities || []).map(amenity => `<span class="text-xs font-medium bg-gray-700 text-gray-300 px-2 py-1 rounded-full">${amenity}</span>`).join('');

    const gallery = document.getElementById('detail-image-gallery');
    const allImages = [...(venue.gallery || []), ...(venue.eventPhotos || [])];
    gallery.innerHTML = allImages.map(url => `<div class="min-w-full h-80 bg-gray-700 snap-center"><img src="${url}" onerror="this.onerror=null;this.src='https://placehold.co/800x400/374151/ffffff?text=Venue+Image';" class="w-full h-full object-cover"></div>`).join('');
    
    const slotsContainer = document.getElementById('detail-venue-slots');
    if(venue.availableSlots && venue.availableSlots.length > 0) {
        slotsContainer.innerHTML = venue.availableSlots.map(slot => `
            <div class="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                <div>
                    <p class="font-semibold text-white">${slot.day}, ${slot.date}</p>
                    <p class="text-sm text-gray-400">${slot.time}</p>
                </div>
                <button onclick='showReservationPage(${venue.id}, ${JSON.stringify(slot)})' class="px-4 py-2 bg-[var(--color-accent)] text-white text-sm font-bold rounded-lg hover:bg-[#b01637] transition">Book Slot</button>
            </div>
        `).join('');
    } else {
        slotsContainer.innerHTML = `<p class="text-gray-500 text-center">No slots available for booking currently.</p>`;
    }

    const menuSection = document.getElementById('venue-menu-section');
    if (venue.menu && venue.menu.items) {
        document.getElementById('detail-menu-items').textContent = venue.menu.items;
        document.getElementById('detail-menu-pages').textContent = `${venue.menu.pages} pages`;
        document.getElementById('detail-menu-image').src = venue.menu.image;
        menuSection.classList.remove('hidden');
    } else {
        menuSection.classList.add('hidden');
    }
    // --- Add this logic inside your function that shows venue details ---

// 1. Get the map URL from your admin data
// --- This is the corrected block ---

// 1. Get the map URL from your 'venue' object
//    (Assuming your 'venues' table also uses 'google_map_url')
const mapUrl = venue.google_map_url; 

// --- THIS IS THE NEW, CORRECTED BLOCK ---

// 1. Find the gallery container and clear it
const galleryContainer = document.getElementById('detail-event-gallery');
galleryContainer.innerHTML = ''; // Clear hardcoded images

// 2. Find all gallery *rows* for this event.
const galleryRows = galleries.filter(row => row.event_id === currentEventData.id);

// 3. Extract all URLs from those rows into a single flat array
//    (This handles multiple rows per event, and multiple URLs per row)
const allImageUrls = galleryRows.flatMap(row => row.image_urls || []);

// 4. Loop through the *correct* flat array of URLs and build the gallery
if (allImageUrls && allImageUrls.length > 0) {
    allImageUrls.forEach(imageUrl => { // 'imageUrl' is now a string (e.g., "http://.../img1.png")
        // Create a new <img> element
        const img = document.createElement('img');
        
        img.src = imageUrl; // This is now correct
        img.className = 'w-full h-auto object-cover rounded-lg';
        
        // Add the new image to the container
        galleryContainer.appendChild(img);
    });
} else {
    // Optional: Show a message if no images
    galleryContainer.innerHTML = '<p class="text-gray-400 text-sm col-span-3">No gallery images available for this event.</p>';
}
// --- End of corrected block ---
    
    navigateTo('venue-detail');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- STORY VIEWER IMPLEMENTATION ---
 
function renderEventHighlights() {
    const container = document.getElementById('event-highlights-container');
    if (!container) return;
    container.innerHTML = eventHighlights.map((highlight, hIndex) => `
        <div class="flex flex-col items-center flex-shrink-0 cursor-pointer" onclick="openStoryViewer(${hIndex})">
            <div class="highlight-hexagon relative flex items-center justify-center">
                <img src="${highlight.coverUrl}" alt="${highlight.title}" class="absolute inset-0 w-full h-full object-cover rounded-full" style="clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);">
            </div>
            <span class="text-xs mt-2 text-gray-400 font-medium text-center max-w-[80px] truncate">${highlight.title}</span>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openStoryViewer(highlightIndex, storyIndex = 0) {
    currentHighlightIndex = highlightIndex;
    currentStoryIndex = storyIndex;
    const storyViewer = document.getElementById('story-viewer');
    if (!storyViewer) return;
    
    storyViewer.classList.remove('hidden');
    storyViewer.classList.add('flex', 'flex-col');
    document.body.style.overflow = 'hidden';
    
    renderStory();
}

function closeStoryViewer() {
    clearTimeout(storyTimeout);
    const storyViewer = document.getElementById('story-viewer');
    if (!storyViewer) return;
    
    storyViewer.classList.add('hidden');
    storyViewer.classList.remove('flex', 'flex-col');
    document.body.style.overflow = '';
}

function renderStory() {
    clearTimeout(storyTimeout);
    const highlight = eventHighlights[currentHighlightIndex];
    if (!highlight || !highlight.stories[currentStoryIndex]) {
        closeStoryViewer();
        return;
    }
    const story = highlight.stories[currentStoryIndex];
    
    const storyHighlightTitleEl = document.getElementById('story-highlight-title');
    if (storyHighlightTitleEl) storyHighlightTitleEl.textContent = highlight.title;
    
    const imageEl = document.getElementById('story-image');
    if (imageEl) imageEl.src = story.url;
    
    const progressContainer = document.getElementById('story-progress-container');
    if (progressContainer) {
        progressContainer.innerHTML = highlight.stories.map((s, index) => `
            <div class="story-progress-bar">
                <div class="story-progress-fill" id="story-fill-${index}"></div>
            </div>
        `).join('');
    }
    
    for (let i = 0; i < highlight.stories.length; i++) {
        const fill = document.getElementById(`story-fill-${i}`);
        if (i < currentStoryIndex) {
            if (fill) fill.style.width = '100%';
        } else {
            if (fill) fill.style.width = '0';
        }
    }

    const currentFill = document.getElementById(`story-fill-${currentStoryIndex}`);
    if (currentFill) {
        currentFill.style.transition = 'none'; 
        currentFill.style.width = '0';
        currentFill.offsetHeight; 
        currentFill.style.transition = 'width 5s linear';
        currentFill.style.width = '100%';

        storyTimeout = setTimeout(nextStory, 5000); 
    }
}

function nextStory() {
    const highlight = eventHighlights[currentHighlightIndex];
    if (!highlight) return;

    if (currentStoryIndex < highlight.stories.length - 1) {
        openStoryViewer(currentHighlightIndex, currentStoryIndex + 1);
    } else {
        if (currentHighlightIndex < eventHighlights.length - 1) {
            openStoryViewer(currentHighlightIndex + 1, 0);
        } else {
            closeStoryViewer();
        }
    }
}

function prevStory() {
    if (currentStoryIndex > 0) {
        openStoryViewer(currentHighlightIndex, currentStoryIndex - 1);
    } else {
        if (currentHighlightIndex > 0) {
            const prevHighlightIndex = currentHighlightIndex - 1;
            const prevHighlight = eventHighlights[prevHighlightIndex];
            openStoryViewer(prevHighlightIndex, prevHighlight.stories.length - 1);
        } else {
            renderStory();
        }
    }
}

// --- UI Rendering Functions ---

function populatePromoGrid() {
    const grid = document.getElementById('promo-slider-grid');
    if (grid) grid.innerHTML = promotionalSlides.map(p => `<div class="promo-card rounded-xl shadow-xl overflow-hidden flex items-center p-6 cursor-pointer" style="background-image: url('${p.imageUrl}');"><div class="absolute inset-0 bg-black opacity-30 rounded-xl"></div><div class="relative z-10 max-w-xs"><h4 class="text-2xl font-extrabold text-white mb-1 leading-tight">${p.title}</h4><p class="text-gray-200 text-sm mb-4">${p.subtitle}</p><button class="px-4 py-2 bg-[var(--color-accent)] text-white font-semibold rounded-lg hover:bg-[#b01637] transition shadow-md">${p.buttonText}</button></div></div>`).join('');
}

function populateCategoryGrid() {
    const grid = document.getElementById('category-list-grid');
    if (grid) {
        grid.innerHTML = categories.map(c => `<div class="flex flex-col items-center min-w-[80px] p-2 cursor-pointer hover:opacity-80 transition" onclick="handleCategoryClick('${c.name}')"><div class="p-3 rounded-full bg-gray-700 shadow-lg ${c.color}"><i data-lucide="${c.icon}" class="w-6 h-6"></i></div><span class="text-xs mt-2 text-gray-300 font-medium">${c.name}</span></div>`).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons(); 
    }
}
 
// Replace your existing renderEventCard function with this corrected version
// REPLACE your old renderEventCard function with this one

// REPLACE your old renderEventCard function with this one

// REPLACE your old renderEventCard function with this one
// REPLACE your renderEventCard function with this DEBUGGING version

function renderEventCard(event) {
    // --- Checkpoint 1: Log that THIS specific function is running ---
    console.log("--- DEBUG: Running CORRECTED renderEventCard function ---");

    if (!event || !event.id) {
        console.warn("Attempted to render an invalid event card:", event);
        return '';
    }

    const imageUrl = (event.poster_images && event.poster_images[0]) ? event.poster_images[0] : 'https://placehold.co/300x400';
    let dateText = 'Date TBD';
    if (event.event_date) try { dateText = new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch (e) {}
    const startTime = event.start_time ? event.start_time.substring(0, 5) : '';
    const locationText = event.venue_name || 'Venue TBD';
    const priceText = event.price_display || 'Free';
    const showOnwards = !priceText.toLowerCase().includes('free') && priceText !== '₹0' && !priceText.toLowerCase().includes('only');

    // --- Construct the HTML string ---
    const cardHTML = `
        <div class="event-card w-full rounded-xl shadow-xl overflow-hidden flex flex-col cursor-pointer mb-4 bg-gray-800"
             onclick="showEventDetails(${event.id}); return false;">

            <div class="h-40 sm:h-64 overflow-hidden">
                <img src="${imageUrl}" alt="${event.title || 'Event'}"
                     class="w-full h-full object-cover"
                     onerror="this.onerror=null; this.src='https://placehold.co/300x400/1a1a1a/ffffff?text=No+Image';">
            </div>

            <div class="p-3 sm:p-4 flex flex-col flex-grow">
                <h4 class="text-base sm:text-lg font-bold text-white mb-1 truncate" title="${event.title || ''}">
                    ${event.title || 'Event Title'}
                </h4>
                <p class="text-gray-400 text-xs mb-3 truncate">
                    ${locationText} | ${dateText}${startTime ? ' ' + startTime : ''}
                </p>
                <div class="mt-auto pt-2 border-t border-gray-700 flex justify-start items-center">
                    <span class="text-lg sm:text-xl font-extrabold text-white">
                        ${priceText}
                    </span>
                    ${showOnwards ? '<span class="text-gray-500 text-xs ml-1">Onwards</span>' : ''}
                </div>
            </div>
        </div>`;

    // --- Checkpoint 2: Log the EXACT HTML string being generated ---
    console.log("Generated HTML for event card:", cardHTML);

    return cardHTML; // Return the generated HTML
}
function populateFeaturedEventGrid() {
    const grid = document.getElementById('event-list-grid');
    if (!grid) return;

    // --- FIX FOR TYPE ERROR: CHECKING IF EVENTS DATA IS AVAILABLE ---
    if (events.length === 0) {
        grid.innerHTML = `<div class="min-w-full text-center py-5 text-gray-500 col-span-full">No featured events available yet. Please ensure your backend is running and providing data for /api/events.</div>`;
        return;
    }
    // --- END FIX ---

    const staticAppCardHtml = `<div class="app-download-card min-w-[45%] sm:min-w-[250px] md:min-w-[300px] h-[336px] rounded-xl shadow-xl overflow-hidden flex flex-col justify-center items-center text-center p-6 border border-gray-700 relative flex-shrink-0"><div class="absolute inset-0 bg-black opacity-40"></div><div class="relative z-10"><h4 class="text-3xl font-extrabold text-white mb-2 leading-tight">List your event on Party in Bangalore!</h4><p class="text-gray-200 text-sm mb-6">Reach thousands of party-goers in Bengaluru instantly.</p><button class="px-6 py-3 bg-white text-[var(--color-accent)] font-bold rounded-lg hover:bg-gray-200 transition shadow-lg">Get Started Now</button></div></div>`;
    const eventCardsHtml = events.slice(0, 7).map(renderEventCard).join('');
    grid.innerHTML = eventCardsHtml + staticAppCardHtml;
}
 
function populateExploreEventGrid() {
    applyFilters(); 
}

function populateVenueGrid() {
    const grid = document.getElementById('venue-list-grid');
    if (!grid) return;

    // --- FIX FOR TYPE ERROR: CHECKING IF VENUES DATA IS AVAILABLE ---
    if (venues.length === 0) {
         grid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">No venues listed yet. Please ensure your backend is running and providing data for /api/venues.</p>`;
         return;
    }
    // --- END FIX ---

    if (grid) grid.innerHTML = venues.map(v => `<div class="venue-card rounded-xl overflow-hidden shadow-lg relative cursor-pointer group" onclick="showVenueDetails(${v.id})"><div class="h-56 sm:h-64 overflow-hidden"><img src="${v.imageUrl}" alt="${v.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x500/374151/ffffff?text=${v.name.replace(/\s/g, '+')}';" class="w-full h-full object-cover"></div><div class="p-3"><h4 class="text-base font-bold text-white">${v.name}</h4><p class="text-gray-400 text-xs">${v.location}</p></div></div>`).join('');
}

// --- BOOKING LOGIC (COMPLETED) ---

function showBookingPage() {
    if (!currentEventData) return;
    document.getElementById('booking-event-title').textContent = currentEventData.title;
    document.getElementById('booking-event-datetime').textContent = `${currentEventData.date} | ${currentEventData.price} Only`;
    const ticketContainer = document.getElementById('booking-ticket-options');
    ticketContainer.innerHTML = currentEventData.ticketTypes.map((ticket, index) => `<div class="flex justify-between items-center ${index > 0 ? 'mt-4' : ''}"><div><p class="font-semibold text-white">₹${ticket.price.toFixed(2)}</p><p class="text-sm text-gray-300">${ticket.name}</p><p class="text-xs text-gray-500">${ticket.description}</p></div><div class="flex items-center space-x-2"><button class="quantity-btn" onclick="updateQuantity(${index}, -1)">-</button><span id="quantity-${index}" class="quantity-display font-bold">0</span><button class="quantity-btn" onclick="updateQuantity(${index}, 1)">+</button></div></div>`).join('');
    updateOrderSummary();
    navigateTo('booking');
}

function updateQuantity(ticketIndex, change) {
    const quantityEl = document.getElementById(`quantity-${ticketIndex}`);
    let newQuantity = parseInt(quantityEl.textContent) + change;
    if (newQuantity < 0) newQuantity = 0;
    if (quantityEl) quantityEl.textContent = newQuantity;
    updateOrderSummary();
}

function updateOrderSummary() {
    let totalTicketsPrice = 0;
    let totalPeople = 0;
    const platformFee = 0.00; 
    const summaryContainer = document.getElementById('booking-order-summary');
    let hasTickets = false;

    let summaryHtml = `
        <div class="flex justify-between items-center text-gray-400 text-xs font-bold mb-2">
            <p class="flex-grow">TICKETS</p>
            <p class="w-16 text-center">QTY</p>
            <p class="w-20 text-right">SUB TOTAL</p>
        </div>
        <hr class="border-gray-600 mb-3">
    `;
    
    let ticketsContent = '';

    currentEventData.ticketTypes.forEach((ticket, index) => {
        const quantityEl = document.getElementById(`quantity-${index}`);
        const quantity = quantityEl ? parseInt(quantityEl.textContent) : 0;
        
        if (quantity > 0) {
            hasTickets = true;
            const subtotal = ticket.price * quantity;
            totalTicketsPrice += subtotal;
            totalPeople += ticket.permits * quantity;
            
            ticketsContent += `
                <div class="flex justify-between items-center mb-2">
                    <p class="flex-grow text-gray-300">${ticket.name}</p>
                    <p class="w-16 text-center text-gray-300">${quantity}</p>
                    <p class="w-20 text-right font-semibold text-white">₹${subtotal.toFixed(2)}</p>
                </div>
            `;
        }
    });

    if (hasTickets) {
        const totalPayable = totalTicketsPrice + platformFee;
        summaryHtml += ticketsContent + `
            <hr class="border-gray-600 my-3">
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <p class="text-gray-300">Total Tickets Price</p>
                    <p class="font-semibold text-white">₹${totalTicketsPrice.toFixed(2)}</p>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-gray-300 flex items-center">Platform Fee <i data-lucide="chevron-down" class="w-4 h-4 ml-1"></i></p>
                    <p class="font-semibold text-white">₹${platformFee.toFixed(2)}</p>
                </div>
                <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-600 font-bold">
                    <p class="text-white">Total Payable Amount</p>
                    <p class="text-white">₹${totalPayable.toFixed(2)}</p>
                </div>
            </div>
        `;
        const bookingTotalAmountEl = document.getElementById('booking-total-amount');
        if (bookingTotalAmountEl) bookingTotalAmountEl.textContent = `₹${totalPayable.toFixed(2)}`;
    } else {
            summaryHtml = `<p class="text-gray-500 text-center">Your order summary is empty.</p>`;
            const bookingTotalAmountEl = document.getElementById('booking-total-amount');
            if (bookingTotalAmountEl) bookingTotalAmountEl.textContent = '₹0.00';
    }
    
    if (summaryContainer) summaryContainer.innerHTML = summaryHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const bookingTotalPeopleEl = document.getElementById('booking-total-people');
    if (bookingTotalPeopleEl) bookingTotalPeopleEl.textContent = `Total People: ${totalPeople}`;
}
 
function proceedToPayment() {
    const totalAmount = parseFloat(document.getElementById('booking-total-amount').textContent.replace('₹', ''));
    const userName = document.getElementById('booking-name').value, userPhone = document.getElementById('booking-phone').value, userEmail = document.getElementById('booking-email').value;
    if (parseInt(document.getElementById('booking-total-people').textContent.replace('Total People: ','')) <= 0) {
        return alert("Please select at least one ticket.");
    }
    if (!userName || !userPhone || !userEmail) return alert("Please fill in all your details.");
    if (!document.getElementById('terms-agree').checked) return alert("Please agree to the Terms & Conditions.");
    
    // Logic to call Razorpay
    const options = {
        "key": "rzp_test_eJzEaAfpEsuNqQ", "amount": Math.round(totalAmount * 100), "currency": "INR", "name": "Party in Bangalore", "description": `Booking for ${currentEventData.title}`, "image": "https://placehold.co/100x100/df0139/ffffff?text=PB",
        "handler": (response) => { 
            alert(`Payment successful! ID: ${response.razorpay_payment_id}. Your ticket is confirmed.`); 
            // In a real app, this would send a confirmation to the backend
            userBookings.push({ 
                id: userBookings.length + 1, 
                eventName: currentEventData.title, 
                venueName: currentEventData.locationDetails.venueName, 
                date: currentEventData.date.replace('SAT ', ''), 
                status: 'upcoming', 
                imageUrl: currentEventData.imageUrl
            });
            navigateTo('my-tickets'); 
        },
        "prefill": { "name": userName, "email": userEmail, "contact": userPhone },
        "theme": { "color": "#df0139" }, "modal": { "ondismiss": () => alert('Payment was not completed.') }
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (response) => alert(`Payment failed: ${response.error.description}`));
    rzp.open();
}

// --- VENUE SLOT BOOKING LOGIC ---
function showReservationPage(venueId, slot) {
      const venue = venues.find(v => v.id === venueId);
    if (!venue || !slot) return;
    
    currentVenueData = venue;
    currentReservation = { slot: slot }; 

    const reviewVenueNameEl = document.getElementById('review-venue-name');
    if (reviewVenueNameEl) reviewVenueNameEl.textContent = venue.name;
    const reviewDetailsEl = document.getElementById('review-details');
    if (reviewDetailsEl) reviewDetailsEl.textContent = `On ${slot.day}, ${slot.date} from ${slot.time}`;
    
    const bookingFee = currentVenueData.costPerSlot || 0;
    const reviewBookingFeeEl = document.getElementById('review-booking-fee');
    if (reviewBookingFeeEl) reviewBookingFeeEl.textContent = `₹${bookingFee.toFixed(2)}`;
    const reservationTotalAmountEl = document.getElementById('reservation-total-amount');
    if (reservationTotalAmountEl) reservationTotalAmountEl.textContent = `₹${bookingFee.toFixed(2)}`;
    
    const reservationBackBtnEl = document.getElementById('reservation-back-btn');
    if (reservationBackBtnEl) reservationBackBtnEl.onclick = () => showVenueDetails(venue.id);
    const reservationCtaBtnEl = document.getElementById('reservation-cta-btn');
    if (reservationCtaBtnEl) reservationCtaBtnEl.onclick = () => confirmReservation();
    
    navigateTo('reservation');
}

function confirmReservation() {
    const name = document.getElementById('reservation-name').value;
    const phone = document.getElementById('reservation-phone').value;
    const email = document.getElementById('reservation-email').value;
    const eventType = document.getElementById('event-type').value;

    if (!name || !phone || !email) {
        alert("Please fill in all organizer details.");
        return;
    }
    if (!eventType) {
        alert("Please select an event type.");
        return;
    }
     if (!document.getElementById('reservation-terms-agree').checked) {
        alert("Please agree to the Terms & Conditions.");
        return;
    }

    const bookingFee = currentVenueData.costPerSlot || 0;

    if (bookingFee <= 0) {
        alert(`Booking Confirmed!\n\nVenue: ${currentVenueData.name}\nSlot: ${currentReservation.slot.date} at ${currentReservation.slot.time}.\nA confirmation has been sent to your email and phone. Payment: ₹${bookingFee.toFixed(2)}`);
        navigateTo('home');
        return;
    }

    const options = {
        "key": "rzp_test_eJzEaAfpEsuNqQ", 
        "amount": bookingFee * 100, 
        "currency": "INR",
        "name": "Party in Bangalore",
        "description": `Venue Slot Booking at ${currentVenueData.name}`,
        "image": "https://placehold.co/100x100/df0139/ffffff?text=PB",
        "handler": function (response) {
            alert(`Payment successful! Venue slot booked. Payment ID: ${response.razorpay_payment_id}`);
            navigateTo('home');
        },
        "prefill": { "name": name, "email": email, "contact": phone },
        "notes": {
            "venue_id": currentVenueData.id,
            "slot_details": `${currentReservation.slot.date} ${currentReservation.slot.time}`,
            "organizer_name": name,
            "event_type": eventType
        },
        "theme": { "color": "#df0139" },
        "modal": { "ondismiss": () => alert('Payment was cancelled. Your booking is not confirmed.') }
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (response) => alert(`Payment failed. Error: ${response.error.description}`));
    rzp.open();
}

// --- MY TICKETS PAGE LOGIC (COMPLETED) ---
function switchTicketTab(tabName) {
    const views = {
        'edit-profile': document.getElementById('edit-profile-view-content'),
        'my-tickets': document.getElementById('tickets-view-content'),
        'support': document.getElementById('support-view-content')
    };

    const buttons = document.querySelectorAll('.tickets-nav-btn');
    buttons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('onclick') && button.getAttribute('onclick').includes(tabName)) {
            button.classList.add('active');
        }
    });

    Object.keys(views).forEach(key => {
        if (views[key]) views[key].classList.toggle('hidden', key !== tabName);
    });
    
    if (tabName === 'my-tickets') {
        renderMyTickets('upcoming');
    }
}
 
function renderMyTickets(filter) {
    const container = document.getElementById('ticket-list-container');
    const upcomingBtn = document.getElementById('upcoming-btn');
    const previousBtn = document.getElementById('previous-btn');

    if (upcomingBtn) upcomingBtn.classList.toggle('active', filter === 'upcoming');
    if (previousBtn) previousBtn.classList.toggle('active', filter === 'past');

    const filteredBookings = userBookings.filter(b => b.status === filter);

    if (!container) return;

    if (filteredBookings.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center py-8">No ${filter} bookings found. Go book a party!</p>`;
        return;
    }

    container.innerHTML = filteredBookings.map(booking => `
        <div class="bg-[var(--color-component-dark)] rounded-lg p-4 flex items-center space-x-4">
            <img src="${booking.imageUrl}" class="w-16 h-20 object-cover rounded-md" />
            <div>
                <h4 class="font-bold text-white">${booking.eventName}</h4>
                <p class="text-sm text-gray-400">${booking.venueName}</p>
                <p class="text-xs text-gray-500">${new Date(booking.date).toDateString()}</p>
            </div>
        </div>
    `).join('');
}
 
function calculatePartyStreak() {
    const streakCountEl = document.getElementById('party-streak-count');
    if (!streakCountEl) return;

    const sortedBookings = userBookings
        .filter(b => b.status === 'past')
        .sort((a, b) => new Date(b.date) - new Date(a.date)); 

    let streak = 0;
    if (sortedBookings.length === 0) {
        streakCountEl.textContent = '0';
        return;
    }

    const uniqueMonths = [];
    sortedBookings.forEach(booking => {
        const date = new Date(booking.date);
        const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
        if (!uniqueMonths.includes(monthYear)) {
            uniqueMonths.push(monthYear);
        }
    });

    if (uniqueMonths.length === 0) {
        streakCountEl.textContent = '0';
        return;
    }

    let checkDate = new Date(); 
    while (true) {
        const checkMonthYear = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
        
        let found = uniqueMonths.includes(checkMonthYear);

        if (found) {
            streak++;
            checkDate.setMonth(checkDate.getMonth() - 1);
            if (streak > uniqueMonths.length + 1) break;
        } else {
            if (streak === 0) {
                const tempDate = new Date(checkDate);
                tempDate.setMonth(tempDate.getMonth() - 1);
                const prevMonthYear = `${tempDate.getFullYear()}-${tempDate.getMonth()}`;
                if (uniqueMonths.includes(prevMonthYear)) {
                    break;
                }
            }
            break;
        }
    }
    
    streakCountEl.textContent = streak;
}


// --- Main Initialization Logic (The Core Fix) ---

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 0. Initialize Synchronous DOM Variables ---
    authModal = document.getElementById('auth-modal');
    menuToggleBtn = document.getElementById('mobile-menu-toggle');
    profileDropdown = document.getElementById('profile-dropdown');
    floatingFilterBtn = document.getElementById('floating-filter-btn');

    geminiModal = document.getElementById('gemini-modal');
    geminiModalTitle = document.getElementById('gemini-modal-title');
    if (geminiModalTitle) geminiModalTitle = geminiModalTitle.querySelector('span');
    geminiLoading = document.getElementById('gemini-loading');
    geminiResponseText = document.getElementById('gemini-response-text');

    // Initialize Lucide Icons (must run AFTER all HTML is loaded)
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // 1. Fetch all data from the admin backend
    await fetchAllData();

    // 2. Initialize UI components using the fetched data
    populateFeaturedEventGrid();
    populateExploreEventGrid();
    populateCategoryGrid();
    populatePromoGrid();
    populateVenueGrid();
    renderEventHighlights();

    // 3. Set initial view
    navigateTo('home');
// --- Setup Your Other Event Listeners ---
    console.log("Setting up event listeners..."); // Checkpoint 1
    const loginBtn = document.getElementById('login-register-btn'); 

    // Checkpoint 2: Did we find the button?
    console.log("Found login button element:", loginBtn);
    // 4. Attach Event Listeners (Fixing the button linkage)
    
    // Login/Register Button Fix
    if (loginBtn) {
        // Checkpoint 3: Attaching the listener
        console.log("Attaching click listener to login button..."); 
        loginBtn.addEventListener('click', () => {
            // Checkpoint 4: Listener was successfully triggered!
            console.log("✅ Login/Register button CLICKED!"); 
            showAuthModal('login'); 
        });
    } else {
        console.error("❌ FAILURE: Button with ID 'login-register-btn' not found in HTML!"); 
    }
    
    // Mobile Menu Toggle Fix
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', toggleProfileMenu);
    } 

    // Auto-focus logic for OTP inputs
    const otpInputs = document.querySelectorAll('#form-otp input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value.length === 1 && index < otpInputs.length - 1) otpInputs[index + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && input.value.length === 0 && index > 0) otpInputs[index - 1].focus();
        });
    });
});
