
import { PublicKey, Transaction, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, Idl, BN } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { getConnection } from "../utils/connection.js";
import { Request, Response } from "express";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    increaseLiquidityQuoteByInputToken,
    decreaseLiquidityQuoteByLiquidity,
    TickUtil,
    TokenExtensionUtil,
    IGNORE_CACHE,
    PriceMath,
    PDAUtil
} from "@orca-so/whirlpools-sdk";
import { Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";

// Hardcoded program ID from lib.rs
const INCO_VAULT_PROGRAM_ID = new PublicKey("incoBncSVFXQx8LWWND6rrZMsNpYzXJ8jSKSfLHFSE3");
// Whirlpool program ID
const WHIRLPOOL_PROGRAM_ID = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
// Inco Lightning program ID
const INCO_LIGHTNING_ID = new PublicKey("IncoLightning1111111111111111111111111111");

// Minimal IDL definition based on the Rust program
const VAULT_IDL: any = {
    "version": "0.1.0",
    "name": "inco_vault",
    "metadata": {
        "address": "incoBncSVFXQx8LWWND6rrZMsNpYzXJ8jSKSfLHFSE3"
    },
    "instructions": [
        {
            "name": "createPosition",
            "accounts": [
                { "name": "authority", "isMut": true, "isSigner": true },
                { "name": "vaultConfig", "isMut": false, "isSigner": false },
                { "name": "vaultPda", "isMut": true, "isSigner": false },
                { "name": "positionTracker", "isMut": true, "isSigner": false },
                { "name": "positionMint", "isMut": true, "isSigner": true },
                { "name": "whirlpool", "isMut": true, "isSigner": false },
                { "name": "positionTokenAccount", "isMut": true, "isSigner": false },
                { "name": "tokenAccountA", "isMut": true, "isSigner": false },
                { "name": "tokenAccountB", "isMut": true, "isSigner": false },
                { "name": "tokenVaultA", "isMut": true, "isSigner": false },
                { "name": "tokenVaultB", "isMut": true, "isSigner": false },
                { "name": "tickArrayLower", "isMut": false, "isSigner": false },
                { "name": "tickArrayUpper", "isMut": false, "isSigner": false },
                { "name": "incoLightningProgram", "isMut": false, "isSigner": false },
                { "name": "whirlpoolProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false },
                { "name": "rent", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "encryptedAmountA", "type": "bytes" },
                { "name": "encryptedAmountB", "type": "bytes" },
                { "name": "amountType", "type": "u8" },
                { "name": "tickLowerIndex", "type": "i32" },
                { "name": "tickUpperIndex", "type": "i32" },
                { "name": "liquidityAmount", "type": "u128" },
                { "name": "tokenMaxA", "type": "u64" },
                { "name": "tokenMaxB", "type": "u64" },
                { "name": "maxSlippageBps", "type": { "option": "u16" } }
            ]
        },
        {
            "name": "withdrawPosition",
            "accounts": [
                { "name": "authority", "isMut": true, "isSigner": true },
                { "name": "vaultConfig", "isMut": false, "isSigner": false },
                { "name": "vaultPda", "isMut": true, "isSigner": false },
                { "name": "positionTracker", "isMut": true, "isSigner": false },
                { "name": "whirlpool", "isMut": true, "isSigner": false },
                { "name": "whirlpoolPosition", "isMut": true, "isSigner": false },
                { "name": "positionTokenAccount", "isMut": true, "isSigner": false },
                { "name": "positionMint", "isMut": true, "isSigner": false },
                { "name": "tokenAccountA", "isMut": true, "isSigner": false },
                { "name": "tokenAccountB", "isMut": true, "isSigner": false },
                { "name": "tokenVaultA", "isMut": true, "isSigner": false },
                { "name": "tokenVaultB", "isMut": true, "isSigner": false },
                { "name": "tickArrayLower", "isMut": false, "isSigner": false },
                { "name": "tickArrayUpper", "isMut": false, "isSigner": false },
                { "name": "whirlpoolProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "associatedTokenProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "liquidityAmount", "type": "u128" },
                { "name": "minAmountA", "type": "u64" },
                { "name": "minAmountB", "type": "u64" },
                { "name": "closePosition", "type": "bool" }
            ]
        },
        {
            "name": "collectAllProfits",
            "accounts": [
                { "name": "authority", "isMut": true, "isSigner": true },
                { "name": "vaultConfig", "isMut": false, "isSigner": false },
                { "name": "vaultPda", "isMut": true, "isSigner": false },
                { "name": "positionTracker", "isMut": true, "isSigner": false },
                { "name": "whirlpool", "isMut": false, "isSigner": false },
                { "name": "whirlpoolPosition", "isMut": true, "isSigner": false },
                { "name": "positionTokenAccount", "isMut": false, "isSigner": false },
                { "name": "tokenVaultA", "isMut": true, "isSigner": false },
                { "name": "tokenVaultB", "isMut": true, "isSigner": false },
                { "name": "feeAccountA", "isMut": true, "isSigner": false },
                { "name": "feeAccountB", "isMut": true, "isSigner": false },
                { "name": "rewardAccount0", "isMut": true, "isOptional": true, "isSigner": false },
                { "name": "rewardAccount1", "isMut": true, "isOptional": true, "isSigner": false },
                { "name": "rewardAccount2", "isMut": true, "isOptional": true, "isSigner": false },
                { "name": "incoLightningProgram", "isMut": false, "isSigner": false },
                { "name": "whirlpoolProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false }
            ],
            "args": []
        }
    ]
};

export async function createVaultPosition(req: Request, res: Response) {
    try {
        const {
            wallet,
            whirlpool,
            tickLower: reqTickLower,
            tickUpper: reqTickUpper,
            priceLower,
            priceUpper,
            encryptedAmountA, // base64 string
            encryptedAmountB, // base64 string
            amountA, // cleartext amount for liquidity calc
            amountType,
            slippageBps
        } = req.body;

        if (!wallet || !whirlpool || !encryptedAmountA || !encryptedAmountB || !amountA) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const connection = getConnection();
        const walletPubkey = new PublicKey(wallet);
        const whirlpoolPubkey = new PublicKey(whirlpool);

        // Setup Provider & Client
        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        const program = new Program(VAULT_IDL, provider);

        const ctx = WhirlpoolContext.from(connection, dummyWallet);
        const client = buildWhirlpoolClient(ctx);
        const pool = await client.getPool(whirlpoolPubkey);
        const poolData = pool.getData();
        const tokenAInfo = pool.getTokenAInfo();
        const tokenBInfo = pool.getTokenBInfo();

        // 1. Calculate Ticks
        let tickLower: number;
        let tickUpper: number;

        if (priceLower && priceUpper) {
            const rawTickLower = PriceMath.priceToTickIndex(new Decimal(priceLower), tokenAInfo.decimals, tokenBInfo.decimals);
            const rawTickUpper = PriceMath.priceToTickIndex(new Decimal(priceUpper), tokenAInfo.decimals, tokenBInfo.decimals);
            tickLower = TickUtil.getInitializableTickIndex(rawTickLower, poolData.tickSpacing);
            tickUpper = TickUtil.getInitializableTickIndex(rawTickUpper, poolData.tickSpacing);
        } else if (reqTickLower !== undefined && reqTickUpper !== undefined) {
            tickLower = TickUtil.getInitializableTickIndex(reqTickLower, poolData.tickSpacing);
            tickUpper = TickUtil.getInitializableTickIndex(reqTickUpper, poolData.tickSpacing);
        } else {
            return res.status(400).json({ error: "Must provide either tick indices or prices" });
        }

        if (tickLower >= tickUpper) {
            return res.status(400).json({ error: "Invalid tick range" });
        }

        // 2. Calculate Liquidity Quote
        // We use amountA as the input token to determine liquidity
        // Should handle cases where price is out of range (one-sided deposit)?
        // For simplicity, we assume user is creating new position with amountA input logic

        let inputMint = tokenAInfo.mint;
        let inputAmount = new Decimal(amountA);

        const currentTick = poolData.tickCurrentIndex;
        if (currentTick >= tickUpper) {
            // Price above range, only Token B needed. 
            // If user only provided amountA logic, we might need to convert?
            // But for now let's assume amountA is what they WANT to deposit value-wise.
            // If out of range, this might be tricky if we don't have amountB.
            // Let's stick to the simpler logic: checks if we can quote from A.

            // If range is completely B-side (current tick > upper), inputting A gives 0 liquidity?
            // Not necessarily, if we simulate a swap? No, standard add liquidity.

            // If current price > max price of range: Range is below price. Position holds Token B only.
            // Converting A to B equivalent? 
            // Let's rely on Orca SDK logic or just error if single-sided A is invalid.

            // Actually, createOrDeposit logic handled this by converting A to B if needed.
            // Let's mimic that.
            const priceB = PriceMath.tickIndexToPrice(currentTick, tokenAInfo.decimals, tokenBInfo.decimals);
            // amountA * price = amountB equivalent
            const amountBEquivalent = new Decimal(amountA).mul(priceB);
            inputMint = tokenBInfo.mint;
            inputAmount = amountBEquivalent;
        } else if (currentTick < tickLower) {
            // Price below range (Range is above price). Position holds Token A only.
            inputMint = tokenAInfo.mint;
            inputAmount = new Decimal(amountA);
        } else {
            // In range. Use A.
            inputMint = tokenAInfo.mint;
            inputAmount = new Decimal(amountA);
        }

        const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            poolData,
            IGNORE_CACHE
        );

        const quote = increaseLiquidityQuoteByInputToken(
            inputMint,
            inputAmount,
            tickLower,
            tickUpper,
            Percentage.fromFraction(slippageBps || 100, 10000), // default 1%
            pool,
            tokenExtensionCtx
        );

        const { liquidityAmount, tokenMaxA, tokenMaxB } = quote;

        // 3. Derive PDAs
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault")], INCO_VAULT_PROGRAM_ID
        );
        const [vaultConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("config")], INCO_VAULT_PROGRAM_ID
        );
        const [positionTracker] = PublicKey.findProgramAddressSync(
            [Buffer.from("tracker"), walletPubkey.toBuffer(), whirlpoolPubkey.toBuffer()],
            INCO_VAULT_PROGRAM_ID
        );

        const positionMint = Keypair.generate();

        // ATAs
        const tokenAccountA = await getAssociatedTokenAddress(tokenAInfo.mint, walletPubkey);
        const tokenAccountB = await getAssociatedTokenAddress(tokenBInfo.mint, walletPubkey);
        const positionTokenAccount = await getAssociatedTokenAddress(positionMint.publicKey, walletPubkey);

        const [tokenVaultA] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_a"), vaultPda.toBuffer(), tokenAInfo.mint.toBuffer()],
            INCO_VAULT_PROGRAM_ID
        );
        const [tokenVaultB] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_b"), vaultPda.toBuffer(), tokenBInfo.mint.toBuffer()],
            INCO_VAULT_PROGRAM_ID
        );

        // 4. Tick Arrays
        const startTickLower = TickUtil.getStartTickIndex(tickLower, poolData.tickSpacing);
        const startTickUpper = TickUtil.getStartTickIndex(tickUpper, poolData.tickSpacing);
        const tickArrayLowerPda = PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolPubkey, startTickLower);
        const tickArrayUpperPda = PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolPubkey, startTickUpper);

        const tx = await program.methods.createPosition(
            Buffer.from(encryptedAmountA, 'base64'),
            Buffer.from(encryptedAmountB, 'base64'),
            amountType || 0,
            tickLower,
            tickUpper,
            new BN(liquidityAmount.toString()),
            new BN(tokenMaxA.toString()),
            new BN(tokenMaxB.toString()),
            slippageBps ? slippageBps : null // u16 option
        )
            .accounts({
                authority: walletPubkey,
                vaultConfig,
                vaultPda,
                positionTracker,
                positionMint: positionMint.publicKey,
                whirlpool: whirlpoolPubkey,
                positionTokenAccount,
                tokenAccountA,
                tokenAccountB,
                tokenVaultA,
                tokenVaultB,
                tickArrayLower: tickArrayLowerPda.publicKey,
                tickArrayUpper: tickArrayUpperPda.publicKey,
                incoLightningProgram: INCO_LIGHTNING_ID,
                whirlpoolProgram: WHIRLPOOL_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY
            })
            .signers([positionMint])
            .transaction();

        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = walletPubkey;
        tx.partialSign(positionMint);

        const serialized = tx.serialize({ requireAllSignatures: false });

        res.json({
            success: true,
            serializedTransaction: serialized.toString('base64'),
            positionMint: positionMint.publicKey.toBase58()
        });

    } catch (err: any) {
        console.error("Create Vault Position Error:", err);
        res.status(500).json({ error: err.message });
    }
}

export async function withdrawVaultPosition(req: Request, res: Response) {
    try {
        const {
            wallet,
            whirlpool,
            positionMint,
            liquidityAmount,
            closePosition,
            slippageBps
        } = req.body;

        if (!wallet || !whirlpool || !positionMint || !liquidityAmount) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const connection = getConnection();
        const walletPubkey = new PublicKey(wallet);
        const whirlpoolPubkey = new PublicKey(whirlpool);
        const positionMintPubkey = new PublicKey(positionMint);

        // Provider setup
        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        const program = new Program(VAULT_IDL, provider);

        const ctx = WhirlpoolContext.from(connection, dummyWallet);
        const client = buildWhirlpoolClient(ctx);
        const pool = await client.getPool(whirlpoolPubkey);
        const poolData = pool.getData();
        const tokenAInfo = pool.getTokenAInfo();
        const tokenBInfo = pool.getTokenBInfo();

        // Fetch Position Data to get ticks
        const [whirlpoolPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("position"), positionMintPubkey.toBuffer()],
            WHIRLPOOL_PROGRAM_ID
        );
        // We can use client to fetch position data easier?
        // client.getPosition(pubkey) needs the position address, which is `whirlpoolPosition` (PDA of Whirlpool program)
        // Wait, position address is passed? No, positionMint is passed. PDA derivation is correct.
        const position = await client.getPosition(whirlpoolPosition);
        const positionData = position.getData();
        const tickLower = positionData.tickLowerIndex;
        const tickUpper = positionData.tickUpperIndex;

        const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            poolData,
            IGNORE_CACHE
        );

        // Calculate Quote for Min Amounts
        const quote = decreaseLiquidityQuoteByLiquidity(
            new BN(liquidityAmount),
            Percentage.fromFraction(slippageBps || 100, 10000), // default 1%
            position,
            pool,
            tokenExtensionCtx
        );

        const { tokenMinA, tokenMinB } = quote;

        // PDAs
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault")], INCO_VAULT_PROGRAM_ID
        );
        const [vaultConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("config")], INCO_VAULT_PROGRAM_ID
        );
        const [positionTracker] = PublicKey.findProgramAddressSync(
            [Buffer.from("tracker"), walletPubkey.toBuffer(), whirlpoolPubkey.toBuffer()],
            INCO_VAULT_PROGRAM_ID
        );

        // Token accounts
        const positionTokenAccount = await getAssociatedTokenAddress(positionMintPubkey, walletPubkey);
        const tokenAccountA = await getAssociatedTokenAddress(tokenAInfo.mint, walletPubkey);
        const tokenAccountB = await getAssociatedTokenAddress(tokenBInfo.mint, walletPubkey);

        const [tokenVaultA] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_a"), vaultPda.toBuffer(), tokenAInfo.mint.toBuffer()],
            INCO_VAULT_PROGRAM_ID
        );
        const [tokenVaultB] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_b"), vaultPda.toBuffer(), tokenBInfo.mint.toBuffer()],
            INCO_VAULT_PROGRAM_ID
        );

        // Tick Arrays
        const startTickLower = TickUtil.getStartTickIndex(tickLower, poolData.tickSpacing);
        const startTickUpper = TickUtil.getStartTickIndex(tickUpper, poolData.tickSpacing);
        const tickArrayLowerPda = PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolPubkey, startTickLower);
        const tickArrayUpperPda = PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolPubkey, startTickUpper);

        const tx = await program.methods.withdrawPosition(
            new BN(liquidityAmount),
            new BN(tokenMinA),
            new BN(tokenMinB),
            closePosition || false
        )
            .accounts({
                authority: walletPubkey,
                vaultConfig,
                vaultPda,
                positionTracker,
                whirlpool: whirlpoolPubkey,
                whirlpoolPosition,
                positionTokenAccount,
                positionMint: positionMintPubkey,
                tokenAccountA,
                tokenAccountB,
                tokenVaultA,
                tokenVaultB,
                tickArrayLower: tickArrayLowerPda.publicKey,
                tickArrayUpper: tickArrayUpperPda.publicKey,
                whirlpoolProgram: WHIRLPOOL_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
            })
            .transaction();

        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = walletPubkey;

        const serialized = tx.serialize({ requireAllSignatures: false });

        res.json({
            success: true,
            serializedTransaction: serialized.toString('base64')
        });

    } catch (err: any) {
        console.error("Withdraw Vault Position Error:", err);
        res.status(500).json({ error: err.message });
    }
}

export async function collectVaultProfits(req: Request, res: Response) {
    try {
        const {
            wallet,
            whirlpool,
            positionMint,
            tokenMintA,
            tokenMintB
        } = req.body;

        if (!wallet || !whirlpool || !positionMint || !tokenMintA || !tokenMintB) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const connection = getConnection();
        const walletPubkey = new PublicKey(wallet);
        const whirlpoolPubkey = new PublicKey(whirlpool);
        const positionMintPubkey = new PublicKey(positionMint);

        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        const program = new Program(VAULT_IDL, provider);

        const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], INCO_VAULT_PROGRAM_ID);
        const [vaultConfig] = PublicKey.findProgramAddressSync([Buffer.from("config")], INCO_VAULT_PROGRAM_ID);
        const [positionTracker] = PublicKey.findProgramAddressSync(
            [Buffer.from("tracker"), walletPubkey.toBuffer(), whirlpoolPubkey.toBuffer()], INCO_VAULT_PROGRAM_ID
        );

        const [whirlpoolPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("position"), positionMintPubkey.toBuffer()], WHIRLPOOL_PROGRAM_ID
        );

        const positionTokenAccount = await getAssociatedTokenAddress(positionMintPubkey, walletPubkey);
        const [tokenVaultA] = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), vaultPda.toBuffer(), new PublicKey(tokenMintA).toBuffer()], INCO_VAULT_PROGRAM_ID);
        const [tokenVaultB] = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), vaultPda.toBuffer(), new PublicKey(tokenMintB).toBuffer()], INCO_VAULT_PROGRAM_ID);

        // Fee stats accounts
        const [feeAccountA] = PublicKey.findProgramAddressSync([Buffer.from("fees_a"), vaultPda.toBuffer(), new PublicKey(tokenMintA).toBuffer()], INCO_VAULT_PROGRAM_ID);
        const [feeAccountB] = PublicKey.findProgramAddressSync([Buffer.from("fees_b"), vaultPda.toBuffer(), new PublicKey(tokenMintB).toBuffer()], INCO_VAULT_PROGRAM_ID);

        const tx = await program.methods.collectAllProfits()
            .accounts({
                authority: walletPubkey,
                vaultConfig,
                vaultPda,
                positionTracker,
                whirlpool: whirlpoolPubkey,
                whirlpoolPosition,
                positionTokenAccount,
                tokenVaultA,
                tokenVaultB,
                feeAccountA,
                feeAccountB,
                rewardAccount0: null,
                rewardAccount1: null,
                rewardAccount2: null,
                incoLightningProgram: INCO_LIGHTNING_ID,
                whirlpoolProgram: WHIRLPOOL_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .transaction();
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = walletPubkey;

        const serialized = tx.serialize({ requireAllSignatures: false });

        res.json({
            success: true,
            serializedTransaction: serialized.toString('base64')
        });

    } catch (err: any) {
        console.error("Collect Profits Error:", err);
        res.status(500).json({ error: err.message });
    }
}
