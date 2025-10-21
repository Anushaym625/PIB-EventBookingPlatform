const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
// middleware/auth.js
console.log('[Middleware File] Reading this file.');

const authenticateToken = (req, res, next) => {
    // Get token from the 'Authorization' header (e.g., "Bearer TOKEN_STRING")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('[Middleware Function] The middleware function was called!');
  next();

    if (token == null) {
        // 401 Unauthorized: No token was provided
        return res.sendStatus(401);
    }

    // Verify the token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // 403 Forbidden: The token is invalid or expired
            return res.sendStatus(403);
        }

        // If the token is valid, attach the user's data to the request object
        req.user = user;
        
        // Proceed to the next function (the main route handler)
        next();
    });
};

module.exports = authenticateToken;
