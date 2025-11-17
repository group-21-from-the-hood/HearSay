/**
 * Sanitizes user input to prevent XSS and code injection
 * @param {string} input - The user input to sanitize
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove HTML tags and encode special characters
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .trim()
    .slice(0, 5000); // Limit length to prevent DoS
};

/**
 * Sanitizes search queries
 * @param {string} query - The search query to sanitize
 * @returns {string} - Sanitized query
 */
export const sanitizeSearchQuery = (query) => {
  if (typeof query !== 'string') return '';
  
  return query
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, 200); // Limit search query length
};

/**
 * Validates and sanitizes rating values
 * @param {number} rating - The rating value
 * @returns {number} - Valid rating between 0 and 5
 */
export const sanitizeRating = (rating) => {
  const numRating = Number(rating);
  if (isNaN(numRating)) return 0;
  
  // Ensure rating is between 0 and 5, in increments of 0.5
  const clamped = Math.max(0, Math.min(5, numRating));
  return Math.round(clamped * 2) / 2;
};
