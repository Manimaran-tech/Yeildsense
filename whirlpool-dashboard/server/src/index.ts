import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import validator from "validator";
import dotenv from "dotenv";
import { createServer } from "http";
import { getPositionsLegacy, getPositionDetails } from "./handlers/getPositions.js";
import { getPositionsNew } from "./handlers/getPositionsNew.js";
import { createOrDeposit } from "./handlers/createOrDeposit.js";
import { withdraw } from "./handlers/withdraw.js";
import { closePosition } from "./handlers/closePosition.js";
import { getPool } from "./handlers/getPool.js";
import { getPools } from "./handlers/getPools.js";
import { collectFees } from "./handlers/collectFees.js";
import { getMarketHistory } from "./handlers/getMarketHistory.js";
import { getLiquidityDistribution } from "./handlers/getLiquidityDistribution.js";
import { getYieldHistory } from "./handlers/getYieldHistory.js";
import { createVaultPosition, withdrawVaultPosition, collectVaultProfits } from "./handlers/vaultHandler.js";
import { initWebSocket, broadcast, broadcastToWallet, getConnectedClientsCount } from "./websocket.js";

dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3001;

// --- Security Middleware ---

// Use Helmet to set security headers (XSS, Clickjacking, CSP, etc.)
app.use(helmet());

// Logging with Morgan (Audit Trail)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// CORS configuration (Restrict to trusted domains in production)
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting (Prevent Brute Force / DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes"
});

// Apply rate limiter to all API routes
app.use("/api/", apiLimiter);

app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// --- Business Logic Validation Middleware ---

const validateWallet = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { wallet } = req.params;
    if (wallet && (!validator.isAlphanumeric(wallet) || wallet.length < 32 || wallet.length > 44)) {
        return res.status(400).json({ error: "Invalid Solana wallet address" });
    }
    next();
};

const validateMint = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { mint } = req.params;
    if (mint && (!validator.isAlphanumeric(mint) || mint.length < 32 || mint.length > 44)) {
        return res.status(400).json({ error: "Invalid NFT mint address" });
    }
    next();
};

// --- Routes ---

/**
 * Health check
 */
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "whirlpool-position-manager",
        websocket: {
            enabled: true,
            clients: getConnectedClientsCount()
        }
    });
});

app.get("/debug-config", (req, res) => {
    res.json({
        rpcUrl: process.env.RPC_URL,
        programId: process.env.WHIRLPOOLS_PROGRAM_ID,
        nodeEnv: process.env.NODE_ENV
    });
});

/**
 * Fetch market history (price)
 */
app.get("/api/market/history", getMarketHistory);

/**
 * Fetch liquidity distribution for a pool
 */
app.get("/api/pool/:address/liquidity", getLiquidityDistribution);

/**
 * Fetch yield history for a pool
 */
app.get("/api/pool/:address/yield", getYieldHistory);

/**
 * Fetch all Whirlpool positions for a wallet
 * Query param ?sdk=new for New SDK, otherwise uses Legacy SDK
 */
app.get("/api/positions/:wallet", validateWallet, async (req, res) => {
    try {
        const { wallet } = req.params;
        const { sdk } = req.query;

        if (sdk === "new") {
            const positions = await getPositionsNew(wallet);
            res.json(positions);
        } else {
            const positions = await getPositionsLegacy(wallet);
            res.json(positions);
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fetch detailed position info
 */
app.get("/api/position/:mint", validateMint, async (req, res) => {
    try {
        const { mint } = req.params;
        const details = await getPositionDetails(mint);
        if (!details) {
            return res.status(404).json({ error: "Position not found" });
        }
        res.json(details);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fetch pool info
 */
app.get("/api/pool/:address", async (req, res) => {
    try {
        const { address } = req.params;
        if (!validator.isAlphanumeric(address)) {
            return res.status(400).json({ error: "Invalid pool address" });
        }
        const info = await getPool(address);
        if (!info) {
            return res.status(404).json({ error: "Pool not found" });
        }
        res.json(info);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fetch multiple pools info (batch)
 */
app.post("/api/pools", async (req, res) => {
    try {
        const { addresses } = req.body;
        if (!Array.isArray(addresses)) {
            return res.status(400).json({ error: "addresses must be an array" });
        }
        const info = await getPools(addresses);
        res.json(info);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create a new position or deposit into existing one
 * Returns an unsigned transaction for client-side signing
 */
app.post("/api/position/create-or-deposit", async (req, res) => {
    try {
        const result = await createOrDeposit(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Withdraw liquidity from a position
 * Returns an unsigned transaction
 */
app.post("/api/position/withdraw", async (req, res) => {
    try {
        const result = await withdraw(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Close an empty position (collects fees & closes)
 * Returns an unsigned transaction
 */
app.post("/api/position/close", async (req, res) => {
    try {
        const result = await closePosition(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Collect fees
 */
app.post("/api/position/collect-fees", async (req, res) => {
    try {
        const result = await collectFees(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Vault Operations
 */
app.post("/api/vault/create-position", createVaultPosition);
app.post("/api/vault/withdraw", withdrawVaultPosition);
app.post("/api/vault/collect-profits", collectVaultProfits);

// --- Server Start ---

// Initialize WebSocket server on the same HTTP server
initWebSocket(server);

server.listen(port, () => {
    console.log(`🚀 Whirlpool Position Manager listening at http://localhost:${port}`);
    console.log(`📡 WebSocket server ready on ws://localhost:${port}`);
    console.log(`📡 RPC URL: ${process.env.RPC_URL || 'default'}`);
});