/**
 * Frontend Security Utilities
 * 
 * Provides defense-in-depth for the yield farming dashboard:
 * 1. XSS Protection (sanitization)
 * 2. CSRF Mitigation (nonce generation)
 * 3. Wallet Connection Safety
 * 4. Secure Transaction Validation
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Sanitize user input to prevent XSS attacks
 * Use this before rendering any user-provided strings (like wallet names or notes)
 */
export function sanitizeString(str: string): string {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Validate a Solana address string to prevent injection or malformed data
 */
export function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate a cryptographically secure random nonce for CSRF mitigation
 */
export function generateNonce(length: number = 32): string {
    const array = new Uint32Array(length / 4);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

/**
 * Check if the current environment is secure (HTTPS or Localhost)
 */
export function isSecureEnvironment(): boolean {
    return (
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    );
}

/**
 * Rate limiting helper for frontend actions (prevent UI spamming)
 */
const rateLimitMap = new Map<string, number>();

export function isRateLimited(actionId: string, limitMs: number = 1000): boolean {
    const lastAction = rateLimitMap.get(actionId) || 0;
    const now = Date.now();

    if (now - lastAction < limitMs) {
        return true;
    }

    rateLimitMap.set(actionId, now);
    return false;
}

/**
 * Log a security-related event locally (audit trail)
 */
export function logSecurityEvent(type: string, details: any) {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        details,
        userAgent: navigator.userAgent
    };

    // In production, this would be sent to a secure logging endpoint
    console.warn('[SecurityAudit]', event);

    // Optional: store in sessionStorage for current session audit
}
