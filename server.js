// --- 1. LOAD ENVIRONMENT VARIABLES (MUST BE ABSOLUTELY FIRST) ---
require('dotenv').config();

// --- 2. DEPENDENCIES ---
const express = require('express');
const cors = require('cors');
const path = require('path'); // <-- Import the 'path' module
const { Pool } = require('pg');

// --- 3. IMPORT CUSTOM MODULES (ROUTES & MIDDLEWARE) ---
// Ensure these files exist in the correct folders
const authenticateToken = require('./middleware/auth'); // For potential secure routes
const authRouter = require('./routes/auth'); // Import the function that returns the router

// --- 4. CONFIGURATION & EXPRESS APP SETUP ---
const app = express();
const port = process.env.PORT || 3000;

// --- 5. MIDDLEWARE SETUP ---
// Use CORS once with desired options or default
app.use(cors());
// Use Express's built-in JSON parser (replaces body-parser)
app.use(express.json());

// --- 6. DATABASE CONNECTION ---
// Uses environment variables from your .env file
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err) => {
    if (err) {
        console.error('FATAL: Database connection failed. Check .env credentials.', err.stack);
        process.exit(1);
    } else {
        console.log('✅ Successfully connected to the database.');
    }
});

// --- 7. STATIC FILE SERVING ---
app.use(express.static(path.join(__dirname))); // Serve root files (index.html, script.js)
app.use('/admin', express.static(path.join(__dirname, 'admin'))); // Serve admin files
// ENHANCED CORS CONFIGURATION
const corsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    preflightContinue: false,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));



// --- HELPER FUNCTIONS FOR TYPE SAFETY ---

// Helper to safely convert incoming data to a PostgreSQL array type (TEXT[])
function safeArray(field) {
    if (Array.isArray(field)) return field.filter(Boolean);
    if (typeof field === 'string') {
        return field.split(',').map(s => s.trim()).filter(Boolean);
    }
    return null; // Return NULL if data is invalid/empty
}

// Helper to safely convert incoming data to JSONB (returns object/array or NULL)
function safeJSONB(field) {
    if (!field) return null;
    if (typeof field === 'object') {
        if (Array.isArray(field) && field.length === 0) return null;
        if (Object.keys(field).length === 0) return null;
        return field;
    }
    if (field === "") return null;

    try {
        const parsed = JSON.parse(field);
        return parsed || null;
    } catch {
        return null;
    }
}


// --- UTILITY FUNCTION FOR FRONTEND COMPATIBILITY ---
const formatEventRow = (row) => ({
    id: row.id,
    title: row.title,
    date: row.event_date ? new Date(row.event_date).toDateString().toUpperCase().replace(/ \d{4}/, (m) => ` ${m.slice(-4)}`) : null,
    starttime: row.time ? row.time.substring(0, 5) : '00:00',
    endTime: row.end_time ? row.end_time.substring(0, 5) : '00:00',
    price: row.price_display,
    priceValue: parseFloat(row.price_value),
    ticketTypes: row.ticket_types,
    imageUrl: row.image_url,
    posterUrl: row.poster_url,
    locationDetails: row.location_details,
    details: row.details
});


// ===============================================
//  PAGE LOADING ROUTES
// ===============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});


// ===============================================
//  API ENDPOINTS (PUBLIC + ADMIN CRUD)
// ===============================================
// 
// -----------------------------------------------
// 1. EVENTS CRUD Admin
// -----------------------------------------------

// GET all events with organizer and venue names (for list views)
// GET all events
app.get('/api/events', async (req, res) => {
    try {
        // UPDATED: Selects the correct, existing columns
        const query = `
            SELECT 
                id, title, event_date, category, start_time, 
                price_display, poster_images, venue_id, organizer_id 
            FROM events 
            ORDER BY event_date ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Get all events Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET a single event by ID
// GET a single event by its ID with full details
app.get('/api/events/:id', async (req, res) => {
    // ▼ ADD THIS LINE ▼
    console.log("✅ SERVER: The NEW get-event-by-id route is running!"); 
    
    const { id } = req.params;
    try {
        // CORRECTED: Use SELECT * to get ALL columns for the specific event.
        const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Send the full, raw event object to the frontend.
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Get event ${id} Error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST a new event
// POST a new event
app.post('/api/events', async (req, res) => {
    const { 
        title, category, event_date, start_time, end_time, venue_id, 
        organizer_id, price_display, price_value, poster_images, 
        event_details, terms_and_conditions, google_map_url 
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO events (
                title, category, event_date, start_time, end_time, venue_id, 
                organizer_id, price_display, price_value, poster_images, 
                event_details, terms_and_conditions, google_map_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [
                title, category, event_date, start_time, end_time, venue_id, 
                organizer_id, price_display, price_value, 
                // ▼▼▼ THE FIX IS HERE ▼▼▼
                JSON.stringify(poster_images || []), // Stringify the array, use empty array as default
                event_details, terms_and_conditions, google_map_url
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Event POST Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// PUT (update) an existing event
// PUT (update) an existing event
app.put('/api/events/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        title, category, event_date, start_time, end_time, venue_id, 
        organizer_id, price_display, price_value, poster_images, 
        event_details, terms_and_conditions, google_map_url 
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE events SET 
                title = $1, category = $2, event_date = $3, start_time = $4, end_time = $5, 
                venue_id = $6, organizer_id = $7, price_display = $8, price_value = $9, 
                poster_images = $10, event_details = $11, terms_and_conditions = $12, 
                google_map_url = $13, updated_at = NOW()
            WHERE id = $14 RETURNING *`,
            [
                title, category, event_date, start_time, end_time, venue_id, 
                organizer_id, price_display, price_value, 
                // ▼▼▼ THE FIX IS HERE ▼▼▼
                JSON.stringify(poster_images || []), // Stringify the array
                event_details, terms_and_conditions, google_map_url, id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Event PUT Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// DELETE an event
app.delete('/api/events/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM events WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Event not found to delete." });
        }
        res.status(204).send();
    } catch (err) {
        console.error("Event DELETE Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// GET all venues (for dropdowns)
app.get('/api/venues', async (req, res) => {
    try {
        // We only need the ID and name for the dropdown
        const result = await pool.query('SELECT id, name FROM venues ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Get venues error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET all users/organizers (for dropdowns)
app.get('/api/users', async (req, res) => {
    try {
        // Select all users who are not super-admins
        const result = await pool.query("SELECT id, name FROM users WHERE role != 'super-admin' ORDER BY name ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Get users error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET all categories (for dropdowns)
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Get categories error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// -----------------------------------------------
// 2. VENUES CRUD
// -----------------------------------------------

app.get('/api/venues', async (req, res) => {
    try {
        const query = 'SELECT * FROM venues ORDER BY id ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/venues/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).send();
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// This is the FIXED code
app.post('/api/venues', async (req, res) => {
    let { name, location, image_url, capacity, cost_per_slot, amenities, details, menu, gallery, event_photos, available_slots } = req.body;

    try {
        // 🧹 Clean & normalize inputs (copied from your PUT route)
        const safeCapacity = capacity ? parseInt(capacity, 10) : null;
        const safeCostPerSlot = cost_per_slot ? parseFloat(cost_per_slot) : null;
        const safeAmenities = Array.isArray(amenities) ? amenities : [];
        const safeGallery = Array.isArray(gallery) ? gallery : [];
        const safeEventPhotos = Array.isArray(event_photos) ? event_photos : [];
        const safeDetails = typeof details === 'object' ? details : {};
        const safeMenu = Array.isArray(menu) ? menu : []; // Use Array for menu
        const safeAvailableSlots = Array.isArray(available_slots) ? available_slots : [];

        const result = await pool.query(
            `INSERT INTO venues (
                name, location, image_url, capacity, cost_per_slot, amenities, 
                details, menu, gallery, event_photos, available_slots
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb) RETURNING *`,
            [
                name, location, image_url, safeCapacity, safeCostPerSlot, 
                safeAmenities, 
                JSON.stringify(safeDetails),      // <-- FIX: Stringify JSON object
                JSON.stringify(safeMenu),        // <-- FIX: Stringify JSON array
                safeGallery, 
                safeEventPhotos, 
                JSON.stringify(safeAvailableSlots) // <-- FIX: Stringify JSON array
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Venue POST Error:", err.message);
        res.status(500).json({ error: `Failed to insert venue: ${err.message}` });
    }
});

app.put('/api/venues/:id', async (req, res) => {
  const { id } = req.params;
  let {
    name,
    location,
    image_url,
    capacity,
    cost_per_slot,
    amenities,
    details,
    menu,
    gallery,
    event_photos,
    available_slots
  } = req.body;

  try {
    // 🧹 Clean & normalize inputs
    const safeCapacity = capacity ? parseInt(capacity, 10) : null;
    const safeCostPerSlot = cost_per_slot ? parseFloat(cost_per_slot) : null;
    const safeAmenities = Array.isArray(amenities) ? amenities : [];
    const safeGallery = Array.isArray(gallery) ? gallery : [];
    const safeEventPhotos = Array.isArray(event_photos) ? event_photos : [];
    const safeDetails = typeof details === 'object' ? details : {};
    const safeMenu = typeof menu === 'object' ? menu : [];
    const safeAvailableSlots = Array.isArray(available_slots) ? available_slots : [];

    // 🧩 Convert all JSONB objects to JSON strings for Postgres
    const result = await pool.query(
      `UPDATE venues SET
          name = $1,
          location = $2,
          image_url = $3,
          capacity = $4,
          cost_per_slot = $5,
          amenities = $6,
          details = $7::jsonb,
          menu = $8::jsonb,
          gallery = $9,
          event_photos = $10,
          available_slots = $11::jsonb
       WHERE id = $12
       RETURNING *`,
      [
        name,
        location,
        image_url,
        safeCapacity,
        safeCostPerSlot,
        safeAmenities,
        JSON.stringify(safeDetails),
        JSON.stringify(safeMenu),
        safeGallery,
        safeEventPhotos,
        JSON.stringify(safeAvailableSlots),
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error updating venue:', err);
    res.status(500).json({ error: 'Failed to update venue: ' + err.message });
  }
});

app.delete('/api/venues/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM venues WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// -----------------------------------------------
// 3. CATEGORIES CRUD
// -----------------------------------------------

app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET a single category by its ID
app.get('/api/categories/:id', async (req, res) => {
    const { id } = req.params; // Get the ID from the URL (e.g., '3')
    try {
        const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json(result.rows[0]); // Send back the single category object
    } catch (err) {
        console.error(`Get category ${id} Error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name, icon } = req.body;
    try {
        const result = await pool.query('INSERT INTO categories (name, icon) VALUES ($1, $2) RETURNING *', [name, icon]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name, icon } = req.body;
    try {
        const result = await pool.query('UPDATE categories SET name = $1, icon = $2 WHERE id = $3 RETURNING *', [name, icon, id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM categories WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// -----------------------------------------------
// 4. USERS/ORGANIZERS CRUD (Basic)
// -----------------------------------------------

app.get('/api/users', async (req, res) => {
    try {
        // Safe query for listing users (no password)
        const result = await pool.query('SELECT id, name, username, role FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { name, username, password, role = 'organizer' } = req.body;
    try {
        const result = await pool.query('INSERT INTO users (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, username, role', [name, username, password, role]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role } = req.body;
    
    // Construct query and parameters dynamically to handle optional password update
    let query;
    let params;

    if (password) {
        query = `UPDATE users SET name = $1, username = $2, role = $3, password = $4 WHERE id = $5 RETURNING id, name, username, role`;
        params = [name, username, role, password, id];
    } else {
        query = `UPDATE users SET name = $1, username = $2, role = $3 WHERE id = $4 RETURNING id, name, username, role`;
        params = [name, username, role, id];
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// -----------------------------------------------
// 5. PROMOS CRUD (Basic)
// -----------------------------------------------

// GET all promos
app.get('/api/promos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM promos ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET a single promo by ID (FIXED to include button_text)
app.get('/api/promos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // --- FIX: Added button_text to the SELECT ---
        const result = await pool.query(
            'SELECT id, title, subtitle, background_url, event_id, link_type, button_link, button_text FROM promos WHERE id = $1', 
            [id]
        );
        // --- END FIX ---
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Promo not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a promo
app.delete('/api/promos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM promos WHERE id = $1', [id]);
        res.status(204).send(); // 204 No Content is a standard response for successful deletion
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/promos', async (req, res) => {
    // --- FIX: Extract single URL for background_url ---
    let { title, subtitle, background_url, event_id, button_text, link_type, button_link } = req.body;
    const bgUrlValue = Array.isArray(background_url) && background_url.length > 0 
                     ? background_url[0] // Take the first URL if it's an array
                     : (typeof background_url === 'string' ? background_url : null); // Otherwise, use if it's already a string
    // --- END FIX ---
    try {
        const result = await pool.query(
            'INSERT INTO promos (title, subtitle, background_url, event_id, button_text, link_type, button_link) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
             // --- FIX: Use bgUrlValue ---
            [title, subtitle, bgUrlValue, event_id, button_text, link_type, button_link]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update a promo
// REPLACE your old app.put('/api/promos/:id', ...) with this one
// REPLACE your old app.put('/api/promos/:id', ...) with this one
// REPLACE your app.put('/api/promos/:id', ...) with this FINAL version
app.put('/api/promos/:id', async (req, res) => {
    const { id } = req.params;
    // 1. Destructure using the camelCase names sent by the frontend form
    let {
        title,
        subtitle,
        background_url, // Comes as an array
        eventId,       // camelCase from frontend
        buttonText,    // camelCase from frontend
        linkType,      // camelCase from frontend
        buttonLink     // camelCase from frontend
    } = req.body;

    // 2. Process background_url (extract single URL)
    const bgUrlValue = Array.isArray(background_url) && background_url.length > 0
                     ? background_url[0]
                     : (typeof background_url === 'string' ? background_url : null);

    // 3. Process eventId (convert to integer or null)
    const eventIdValue = parseInt(eventId, 10);
    const finalEventId = !isNaN(eventIdValue) ? eventIdValue : null;

    console.log(`--- DEBUG PUT /api/promos/${id} ---`);
    console.log("Received req.body:", req.body);
    console.log("Processing with finalEventId:", finalEventId); // Should be number or null
    console.log("Processing with buttonText:", buttonText);     // Should be the text
    console.log("Processing with linkType:", linkType);         // Should be 'event' or 'url'
    console.log("Processing with buttonLink:", buttonLink);     // Should be URL or empty

    try {
        const result = await pool.query(
            // 4. Use correct snake_case column names in the SET clause
            `UPDATE promos
             SET title = $1, subtitle = $2, background_url = $3, event_id = $4,
                 button_text = $5, link_type = $6, button_link = $7
             WHERE id = $8 RETURNING *`,
            // 5. Pass the CORRECT, processed variables in the correct order
            [title, subtitle, bgUrlValue, finalEventId, buttonText, linkType, buttonLink, id]
        );

        if (result.rows.length === 0) {
             console.log(`Promo ID ${id} not found for update.`);
             return res.status(404).json({ error: 'Promo not found' });
        }
        console.log("Update successful. Sending back:", result.rows[0]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error(`Error updating promo ${id}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/partners', async (req, res) => {
    const { name, logo_url, website_url } = req.body;
    // Safety check for logo_url which is an array from the uploader
    const logoUrlValue = Array.isArray(logo_url) && logo_url.length > 0 ? logo_url[0] : logo_url;
    
    try {
        const result = await pool.query(
            'INSERT INTO partners (name, logo_url, website_url) VALUES ($1, $2, $3) RETURNING *',
            [name, logoUrlValue, website_url]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Partner POST Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/partners/:id', async (req, res) => {
    const { id } = req.params;
    const { name, logo_url, website_url } = req.body;
    
    // Safety check for logo_url which comes as an array from the frontend uploader
    const logoUrlValue = Array.isArray(logo_url) && logo_url.length > 0 ? logo_url[0] : logo_url;

    try {
        const result = await pool.query(
            'UPDATE partners SET name = $1, logo_url = $2, website_url = $3 WHERE id = $4 RETURNING *',
            [name, logoUrlValue, website_url, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Partner not found.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Partner PUT Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/partners/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM partners WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET one partner by ID (ADMIN EDIT FETCH)
app.get('/api/partners/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM partners WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).send();
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GALLERY ROUTES ---

// Create a new gallery item
app.post('/api/galleries', async (req, res) => {
    const { event_id, image_urls, caption } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO galleries (event_id, image_urls, caption) VALUES ($1, $2, $3) RETURNING *',
            [event_id, JSON.stringify(image_urls || []), caption]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update a gallery item (WITH DEBUG LOGGING)
// Update a gallery item (WITH TYPE CONVERSION & DEBUG LOGGING)
app.put('/api/galleries/:id', async (req, res) => {
    // 1. Explicitly convert ID from params to an integer
    const id = parseInt(req.params.id, 10); 
    let { event_id, image_urls, caption } = req.body;

    // --- START DEBUG LOGS ---
    console.log(`--- PUT /api/galleries/${id} ---`);
    console.log("Received ID (as integer):", id);
    if (isNaN(id)) {
        console.error("!!! Invalid ID received in URL !!!");
        return res.status(400).json({ error: "Invalid gallery ID format." });
    }
    // --- END DEBUG LOGS ---

    // 2. Explicitly convert event_id to an integer (or null if empty/invalid)
    event_id = parseInt(event_id, 10);
    if (isNaN(event_id)) {
        event_id = null; // Default to null if not a valid number
    }

    // Ensure image_urls is always an array before stringifying
    if (!Array.isArray(image_urls)) {
        image_urls = [];
    }
    const image_urls_json = JSON.stringify(image_urls);

    // --- MORE DEBUG LOGS ---
    console.log("Processing with event_id (as integer/null):", event_id);
    console.log("Processing with image_urls (as JSON string):", image_urls_json);
    console.log("Processing with caption:", caption);
    // --- END DEBUG LOGS ---

    try {
        const result = await pool.query(
            'UPDATE galleries SET event_id = $1, image_urls = $2, caption = $3 WHERE id = $4 RETURNING *',
            // Use the converted variables here
            [event_id, image_urls_json, caption, id] 
        );
        
        // --- MORE DEBUG LOGS ---
        console.log("Database Update Result - rowCount:", result.rowCount);
        
        if (result.rowCount === 0) {
            console.error(`!!! UPDATE FAILED: No gallery item found with id = ${id} !!!`);
            return res.status(404).json({ error: `Gallery item with id ${id} not found.` });
        } else {
             console.log(`Successfully updated gallery item id = ${id}. Rows affected: ${result.rowCount}`);
             console.log("Sending back updated data:", result.rows[0]);
        }
        console.log(`--- END PUT /api/galleries/${id} ---`);
        // --- END DEBUG LOGS ---

        res.json(result.rows[0]); 

    } catch (err) {
        // --- MORE DEBUG LOGS ---
        console.error(`!!! DATABASE ERROR on PUT /api/galleries/${id} !!!`);
        console.error("Error Message:", err.message);
        console.error("Query Parameters Sent:", [event_id, image_urls_json, caption, id]);
        console.log(`--- END PUT /api/galleries/${id} (with error) ---`);
        // --- END DEBUG LOGS ---
        
        res.status(500).json({ error: err.message });
    }
});

// GET all gallery items
app.get('/api/galleries', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM galleries ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET a single gallery item by ID
app.get('/api/galleries/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM galleries WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gallery item not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a gallery item
app.delete('/api/galleries/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM galleries WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- HIGHLIGHT ROUTES ---

// Create a new highlight
app.post('/api/highlights', async (req, res) => {
    const { event_id, media_url, caption } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO highlights (event_id, media_url, caption) VALUES ($1, $2, $3) RETURNING *',
            [event_id, JSON.stringify(media_url || []), caption]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a highlight
app.put('/api/highlights/:id', async (req, res) => {
    const { id } = req.params;
    const { event_id, media_url, caption } = req.body;
    try {
        const result = await pool.query(
            'UPDATE highlights SET event_id = $1, media_url = $2, caption = $3 WHERE id = $4 RETURNING *',
            [event_id, JSON.stringify(media_url || []), caption, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all highlights
app.get('/api/highlights', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM highlights ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET a single highlight by ID
app.get('/api/highlights/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM highlights WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Highlight not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a highlight
app.delete('/api/highlights/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM highlights WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LOGIN ENDPOINT (CRITICAL FOR ADMIN AUTH) ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Query must select 'password' for the client to retrieve and store
        const result = await pool.query(
            'SELECT id, name, username, password, role FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );
        if (result.rows.length > 0) {
            // Return safe data without password for session storage
            const { password, ...userSafeData } = result.rows[0]; 
            res.json(userSafeData);
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error("Login Query Error:", err.message);
        res.status(500).json({ error: 'Database error during authentication.' });
    }
});
//  ✅ PUBLIC API ROUTES (for your public website)
// =================================================================
// Add this route to server.js in your PUBLIC API ROUTES section

// GET endpoint to fetch all categories for the public page
app.get('/api/public/categories', async (req, res) => {
    try {
        // Select only the name and icon needed for display
        const query = `SELECT name, icon FROM categories ORDER BY name ASC;`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching public categories:", err.message);
        res.status(500).json({ error: "Failed to load categories." });
    }
});
// Add this route to server.js in your PUBLIC API ROUTES section

// GET endpoint to fetch all promos for the public page
// GET endpoint to fetch all promos for the public page (UPDATED)
app.get('/api/public/promos', async (req, res) => {
    try {
        const query = `
            SELECT
                id,
                title,
                subtitle,
                background_url,
                event_id,    -- Needed if link_type is 'event'
                link_type,   -- Tells frontend if it links to 'event' or 'url'
                button_link, -- Contains the URL or the Event ID (as text)
                button_text
            FROM promos
            ORDER BY id ASC;`; // Or maybe ORDER BY created_at DESC for newest first?
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching public promos:", err.message);
        res.status(500).json({ error: "Failed to load promos." });
    }
});

// --- Public Event Routes ---
// REPLACE your '/api/public/events' route with this final, complete version
// --- Mount the PUBLIC Authentication Routes ---
// This passes the database pool to the auth router function
try {
     const authRoutesInstance = authRouter(pool); // Call the function to get the router
     app.use('/api/public/auth', authRoutesInstance);
     console.log("✅ Authentication routes mounted successfully at /api/public/auth"); // <-- Corrected line
    } catch(error) {
    console.error("❌ FATAL: Could not mount authentication routes.", error);
    process.exit(1);
    }
// GET endpoint to fetch all events with ALL details for the public page
app.get('/api/public/events', async (req, res) => {
    try {
        // This query now selects ALL columns from 'events' and joins for names.
        const query = `
            SELECT 
                events.*, -- Selects all columns from the events table
                venues.name AS venue_name,
                users.name AS organizer_name
            FROM 
                events
            LEFT JOIN 
                venues ON events.venue_id = venues.id
            LEFT JOIN 
                users ON events.organizer_id = users.id
            ORDER BY 
                events.event_date ASC, events.start_time ASC;
        `;
        
        const result = await pool.query(query);
        
        // Send the complete list of events back as JSON
        res.json(result.rows);

    } catch (err) {
        console.error("Error fetching public events:", err.message);
        res.status(500).json({ error: `Failed to load events. Database error: ${err.message}` });
    }
});

// GET a single event by ID (Public)
// GET a single event by ID (Public)
app.get('/api/public/events/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`SERVER: Received request for public event ID: ${id}`); // Debug log

    try {
        const query = `
            SELECT 
                events.*, 
                venues.name AS venue_name,
                users.name AS organizer_name 
            FROM events 
            LEFT JOIN venues ON events.venue_id = venues.id
            LEFT JOIN users ON events.organizer_id = users.id
            WHERE events.id = $1;
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            console.log(`SERVER: Event ID ${id} not found.`); // Debug log
            return res.status(404).json({ error: 'Event not found' });
        }

        console.log(`SERVER: Found event ID ${id}, sending data.`); // Debug log
        res.json(result.rows[0]); 

    } catch (err) {
        console.error(`SERVER Error fetching public event ${id}:`, err.message);
        res.status(500).json({ error: `Failed to load event details. DB error: ${err.message}` });
    }
});


// GET endpoint to fetch all venues for the public page
// REPLACE your existing '/api/public/venues' route with this

// GET endpoint to fetch all venues with more details for the public page
// =====================================================
// 🌐 GET all venues for the public page
// =====================================================
app.get('/api/public/venues', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        location,
        image_url,
        capacity,
        cost_per_slot,
        amenities,
        details,
        menu,
        gallery,
        event_photos,
        available_slots
      FROM venues
      ORDER BY name ASC;
    `;

    const result = await pool.query(query);
    console.log(`SERVER: Sent ${result.rows.length} venues to public page.`);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching public venues:", err.message);
    res.status(500).json({ error: `Failed to load venues. Database error: ${err.message}` });
  }
});

// =====================================================
// 🌐 GET a single venue by ID for the public page
// =====================================================
app.get('/api/public/venues/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`SERVER: Received request for public venue ID: ${id}`);

  try {
    const query = `
      SELECT 
        id,
        name,
        location,
        image_url,
        capacity,
        cost_per_slot,
        amenities,
        details,
        menu,
        gallery,
        event_photos,
        available_slots
      FROM venues
      WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      console.log(`SERVER: Venue ID ${id} not found.`);
      return res.status(404).json({ error: 'Venue not found' });
    }

    console.log(`SERVER: Found venue ID ${id}, sending data.`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`❌ SERVER Error fetching public venue ${id}:`, err.message);
    res.status(500).json({ error: `Failed to load venue details. DB error: ${err.message}` });
  }
});


// Add this route to server.js in your PUBLIC API ROUTES section

// GET endpoint to fetch all highlights for the public page
app.get('/api/public/highlights', async (req, res) => {
    try {
        // Select relevant highlight details and potentially join with events for title
        const query = `
            SELECT 
                h.id, 
                h.media_url, 
                h.caption, 
                e.title AS event_title 
            FROM highlights h
            LEFT JOIN events e ON h.event_id = e.id
            ORDER BY h.id DESC;`; // Often shown newest first
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching public highlights:", err.message);
        res.status(500).json({ error: "Failed to load highlights." });
    }
});

// Add this route to server.js in your PUBLIC API ROUTES section

// GET endpoint to fetch all partners for the public page
app.get('/api/public/partners', async (req, res) => {
    try {
        const query = `
            SELECT 
                id, 
                name, 
                logo_url, 
                website_url 
            FROM partners 
            ORDER BY id ASC;`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching public partners:", err.message);
        res.status(500).json({ error: "Failed to load partners." });
    }
});

// Add this route to server.js in your PUBLIC API ROUTES section

// GET endpoint to fetch all gallery items for the public page
app.get('/api/public/galleries', async (req, res) => {
    try {
        // This query joins with events to get the event title
        const query = `
            SELECT 
                g.id, 
                g.image_urls, 
                g.caption, 
                e.title AS event_title 
            FROM galleries g
            LEFT JOIN events e ON g.event_id = e.id
            ORDER BY g.id DESC;`;
            
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching public galleries:", err.message);
        res.status(500).json({ error: "Failed to load gallery." });
    }
});
// Add this route to server.js in your PUBLIC API ROUTES section

// GET endpoint to fetch bookings (Placeholder - Needs Authentication)
app.get('/api/public/user/bookings', async (req, res) => {
    // !!! WARNING: This is insecure. In a real app, you need to identify the user !!!
    // For now, it returns an empty array as a placeholder.
    console.warn("Accessed insecure /api/public/user/bookings endpoint. Needs authentication.");
    res.json([]); // Return empty array for now
});

// Add this POST route to server.js

// Add this POST route to server.js for requesting OTP

app.post('/api/public/auth/request-otp', async (req, res) => {
    const { phone, name, email, type } = req.body; // e.g., phone is '+911234567890'

    if (!phone || !phone.startsWith('+91') || phone.length !== 13) {
        return res.status(400).json({ success: false, message: "Valid Indian phone number (+91xxxxxxxxxx) is required." });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes

    console.log(`SERVER: Generated OTP ${otp} for ${phone}`);

    // Store the OTP and expiry (replace with secure storage later)
    otpStore[phone] = { otp, expiry };

    try {
        // Use Twilio to send the SMS
        const message = await client.messages.create({
            body: `Your Party in Bangalore verification code is: ${otp}`,
            from: twilioPhoneNumber,
            to: phone // Should be in E.164 format e.g., +919876543210
        });

        console.log(`SERVER: Twilio message sent successfully to ${phone}. SID: ${message.sid}`);
        res.json({ success: true, message: "OTP sent successfully!" });

    } catch (error) {
        console.error(`SERVER: Failed to send Twilio SMS to ${phone}:`, error);
        // Remove OTP from store if sending failed
        delete otpStore[phone];
        res.status(500).json({ success: false, message: `Failed to send OTP. Error: ${error.message}` });
    }
});
// Add this POST route to server.js for OTP verification

app.post('/api/public/auth/verify-otp', async (req, res) => {
    const { phone, otp, type } = req.body;
    console.log(`SERVER: OTP verification attempt for type '${type}' on phone: ${phone} with OTP: ${otp}`);

    // Retrieve stored OTP data
    const storedData = otpStore[phone];

    if (!storedData) {
        return res.status(400).json({ success: false, message: "OTP not requested or expired." });
    }

    // Check expiry
    if (Date.now() > storedData.expiry) {
        delete otpStore[phone]; // Clean up expired OTP
        return res.status(400).json({ success: false, message: "OTP has expired." });
    }

    // Check OTP match
    if (storedData.otp === otp) {
        console.log(`SERVER: OTP ${otp} verified successfully for ${phone}.`);
        delete otpStore[phone]; // Clean up used OTP

        // --- User Handling & Token Generation (Placeholder) ---
        // In a real app:
        // 1. Find user by phone number.
        // 2. If 'register' and user doesn't exist, create user.
        // 3. Generate JWT token.
        const mockToken = `real-jwt-token-for-${phone}-${Date.now()}`; // Replace with actual JWT generation
        // --- End Placeholder ---

        res.json({
            success: true,
            message: "OTP Verified Successfully",
            token: mockToken
        });
    } else {
        console.log(`SERVER: OTP ${otp} verification failed for ${phone}. Stored OTP was ${storedData.otp}`);
        res.status(400).json({ success: false, message: "Invalid OTP." });
    }
});


//===============================================
//  PAGE LOADING ROUTES (Serve HTML files)
// ===============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// Catch-all for undefined routes (Optional but good practice)
app.use((req, res) => {
    res.status(404).send("Sorry, can't find that!");
});





/// --- START THE SERVER ---
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log("Twilio routes mounted at /api/auth");
});