// routes/auth.js

// --- DEPENDENCIES ---
const express = require('express');
const router = express.Router(); // Use Express's router
const twilio = require('twilio');
const jwt = require('jsonwebtoken');
// You might need your database connection pool here as well
// const pool = require('../db-connection'); // Example

// --- CONFIGURATION ---
function authRouter(pool) {
    console.log('[AUTH ROUTER] authRouter function called.');

    // --- CONFIGURATION ---
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const JWT_SECRET = process.env.JWT_SECRET;

    // --- VALIDATION & DEBUG LOG ---
    console.log('[AUTH ROUTER] Checking environment variables:');
    console.log(`  TWILIO_ACCOUNT_SID: ${accountSid ? 'Found' : 'MISSING!'}`);
    console.log(`  TWILIO_AUTH_TOKEN: ${authToken ? 'Found' : 'MISSING!'}`);
    console.log(`  TWILIO_PHONE_NUMBER: ${twilioPhoneNumber || 'MISSING!'}`);
    console.log(`  JWT_SECRET: ${JWT_SECRET ? 'Found' : 'MISSING!'}`);

    // CRITICAL CHECK: Stop if credentials are bad
    if (!accountSid || !authToken || !twilioPhoneNumber || !JWT_SECRET) {
        console.error("[AUTH ROUTER] FATAL ERROR: Required environment variables are missing. Cannot create router.");
        // Return null or throw an error to signal failure to server.js
        return null; 
    }

    let twilioClient;
    try {
        twilioClient = twilio(accountSid, authToken);
        console.log('[AUTH ROUTER] Twilio client initialized successfully.');
    } catch (error) {
        console.error("[AUTH ROUTER] FATAL ERROR: Could not initialize Twilio client.", error.message);
        return null; // Signal failure
    }
// In-memory store for OTPs. In production, use a database like Redis.
const otpStore = {};

/**
 * Endpoint to request an OTP.
 * Path: POST /request-otp (will be mounted at /api/public/auth/request-otp in server.js)
 */
router.post('/request-otp', async (req, res) => {
    const { phone, type, name, email } = req.body;

    if (!phone || !phone.startsWith('+91') || phone.length !== 13) {
        return res.status(400).json({ success: false, message: "A valid Indian phone number (+91XXXXXXXXXX) is required." });
    }
    
    // In a real app, you would check if the user exists if type is 'login'
    // or if they already exist if type is 'register'

    // 1. Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // 2. Store the OTP and its expiry
    otpStore[phone] = { otp, expiryTime };
    console.log(`[AUTH] Generated OTP for ${phone}: ${otp}`);

    try {
        // 3. Send the OTP via Twilio SMS
        await twilioClient.messages.create({
            body: `Your Party in Bangalore verification code is: ${otp}`,
            from: twilioPhoneNumber,
            to: phone
        });

        console.log(`[AUTH] Twilio message sent successfully to ${phone}.`);
        res.json({ success: true, message: "OTP sent successfully." });

    } catch (error) {
        console.error("[AUTH] Twilio SMS error:", error.message);
        delete otpStore[phone]; // Clean up stored OTP if sending failed
        res.status(500).json({ success: false, message: "Failed to send OTP. The phone number may be invalid." });
    }
});

/**
 * Endpoint to verify the received OTP.
 * Path: POST /verify-otp (will be mounted at /api/public/auth/verify-otp in server.js)
 */
router.post('/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ success: false, message: "Phone number and OTP are required." });
    }

    const storedData = otpStore[phone];

    if (!storedData) {
        return res.status(400).json({ success: false, message: "No OTP was requested for this number, or it has expired." });
    }

    if (Date.now() > storedData.expiryTime) {
        delete otpStore[phone]; // Clean up expired OTP
        return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (storedData.otp !== otp) {
        return res.status(400).json({ success: false, message: "Incorrect OTP." });
    }

    // --- OTP is Correct ---
    delete otpStore[phone]; // Clean up the used OTP

    try {
        // In a real app, find or create the user in your PostgreSQL database here.
        // let user = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        // if (!user.rows[0]) {
        //   user = await pool.query('INSERT INTO users (phone, name, email) VALUES ($1, $2, $3) RETURNING *', [phone, name, email]);
        // }
        // const userId = user.rows[0].id;

        // For now, we'll use the phone number as the user identifier
        const userId = phone;

        // 5. Generate a JWT token
        const token = jwt.sign({ userId: userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: "Verification successful!",
            token: token
        });
    } catch (dbError) {
        console.error("[AUTH] Database error during user lookup/creation:", dbError);
        res.status(500).json({ success: false, message: "A server error occurred." });
    }
});
return router;
}

module.exports = authRouter;
