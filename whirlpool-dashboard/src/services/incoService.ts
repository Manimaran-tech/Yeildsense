/**
 * Real Inco SVM SDK Service
 * Using actual @inco/solana-sdk patterns from official documentation
 * 
 * This service handles:
 * 1. Client-side encryption for sensitive amounts
 * 2. Attested reveal for off-chain display
 * 3. Attested decrypt for on-chain verification
 * 4. Inco-specific utility conversions
 */

import { encryptValue, decrypt, hexToBuffer, handleToBuffer, plaintextToBuffer } from '@inco/solana-sdk';
import { Transaction, SYSVAR_INSTRUCTIONS_PUBKEY, PublicKey, Connection, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Inco Lightning Program ID (from official docs)
export const INCO_LIGHTNING_PROGRAM_ID = new PublicKey(
    '5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj'
);

// Whirlpool Program ID
export const WHIRLPOOL_PROGRAM_ID = new PublicKey(
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'
);

export interface EncryptedAmount {
    original: string;
    encrypted: string;
    encryptedHex: string;
    encryptedBuffer: Buffer;
    timestamp: number;
}

export interface DecryptResult {
    success: boolean;
    plaintexts: string[];
    handles: string[];
    ed25519Instructions: any[];
    error?: string;
}

/**
 * Encrypt amount using real Inco SDK (for on-chain use)
 */
export async function encryptAmount(amount: string | number): Promise<EncryptedAmount> {
    const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Scale to 9 decimals (standard for SOL/SPL tokens)
    const scaledValue = BigInt(Math.floor(numValue * 1_000_000_000));

    console.log('[IncoService] Encrypting amount:', numValue, '-> scaled:', scaledValue.toString());

    // Real Inco SDK encryption
    const encryptedHex = await encryptValue(scaledValue);

    // Convert to buffer for on-chain use
    const encryptedBuffer = hexToBuffer(encryptedHex);

    console.log('[IncoService] Encrypted hex (first 20 chars):', encryptedHex.substring(0, 20) + '...');

    return {
        original: numValue.toString(),
        encrypted: encryptedHex,
        encryptedHex,
        encryptedBuffer,
        timestamp: Date.now()
    };
}

/**
 * Create position with encrypted amount (uses real Inco CPI)
 */
export async function createEncryptedPosition(
    program: any,
    wallet: any,
    poolAddress: PublicKey,
    amount: number
): Promise<string> {
    // Step 1: Encrypt amount client-side
    const encrypted = await encryptAmount(amount);

    // Step 2: Derive position tracker PDA
    const [trackerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('tracker'), wallet.publicKey.toBuffer(), poolAddress.toBuffer()],
        program.programId
    );

    // Step 3: Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), wallet.publicKey.toBuffer()],
        program.programId
    );

    // Step 4: Call on-chain program with encrypted data
    // Note: This matches our Rust implementation of inco_vault program
    const tx = await program.methods
        .createPositionWithLiquidity(
            Buffer.from(encrypted.encryptedBuffer), // Encrypted Amount A
            Buffer.from(encrypted.encryptedBuffer), // Encrypted Amount B (simplified)
            0,                                      // Amount type
            -887272,                                // tickLow (placeholder)
            887272,                                 // tickHigh (placeholder)
            1000000n,                               // liquidity (placeholder)
            1000000n,                               // maxA
            1000000n,                               // maxB
            null                                    // maxSlippage
        )
        .accounts({
            authority: wallet.publicKey,
            vaultConfig: PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId)[0],
            vaultPda: vaultPda,
            positionTracker: trackerPda,
            whirlpool: poolAddress,
            // (other accounts required by Whirlpool CPI omitted for brevity in this example)
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
            whirlpoolProgram: WHIRLPOOL_PROGRAM_ID,
        })
        .rpc();

    console.log('[IncoService] Position created, tx:', tx);
    return tx;
}

/**
 * Attested reveal - decrypt for off-chain display only
 * REQUIRES: Wallet signMessage capability
 */
export async function revealPosition(
    handles: string[],
    wallet: {
        publicKey: PublicKey;
        signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    }
): Promise<DecryptResult> {
    try {
        console.log('[IncoService] Requesting attested reveal for handles:', handles);

        // Real Inco SDK attested reveal (requires wallet signature)
        const result = await decrypt(handles, {
            address: wallet.publicKey,
            signMessage: wallet.signMessage,
        });

        console.log('[IncoService] Revealed values:', result.plaintexts);

        return {
            success: true,
            plaintexts: result.plaintexts,
            handles: result.handles,
            ed25519Instructions: result.ed25519Instructions,
        };
    } catch (error) {
        console.error('[IncoService] Reveal error:', error);
        return {
            success: false,
            plaintexts: [],
            handles: [],
            ed25519Instructions: [],
            error: String(error),
        };
    }
}

/**
 * Attested decrypt - for on-chain verification
 * This builds a transaction with Ed25519 instructions + our program's verification instruction
 */
export async function decryptWithOnChainVerification(
    handles: string[],
    wallet: any,
    program: any,
    connection: Connection
): Promise<string> {
    // Step 1: Get decryption result with Ed25519 instructions
    const result = await decrypt(handles, {
        address: wallet.publicKey,
        signMessage: wallet.signMessage,
    });

    console.log('[IncoService] Decrypted values for on-chain:', result.plaintexts);

    // Step 2: Build program instruction for on-chain verification
    const handleBuffers = result.handles.map((h: string) => handleToBuffer(h));
    const plaintextBuffers = result.plaintexts.map((p: string) => plaintextToBuffer(p));

    const programInstruction = await program.methods
        .verifyDecryption(
            result.handles.length,
            handleBuffers,
            plaintextBuffers
        )
        .accounts({
            authority: wallet.publicKey,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .instruction();

    // Step 3: Build transaction with Ed25519 instructions first
    // Solana verifies these native instructions before our program runs
    const tx = new Transaction();
    result.ed25519Instructions.forEach((ix: TransactionInstruction) => tx.add(ix));
    tx.add(programInstruction);

    // Step 4: Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('[IncoService] On-chain verification tx:', signature);
    return signature;
}

/**
 * Utility to parse handle from tx logs if needed
 */
export async function getHandleFromTx(
    connection: Connection,
    txSignature: string,
    logPrefix: string
): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const txDetails = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
    });

    const logs = txDetails?.meta?.logMessages || [];

    for (const log of logs) {
        if (log.includes(logPrefix)) {
            const match = log.match(/(\d+)/);
            if (match) return match[1];
        }
    }

    throw new Error(`Handle not found in logs for prefix: ${logPrefix}`);
}

/**
 * Format encrypted hex for display (truncated)
 */
export function formatEncryptedDisplay(encrypted: string, length: number = 12): string {
    if (!encrypted || encrypted.length < length * 2) {
        return encrypted || 'N/A';
    }
    const start = encrypted.substring(0, length);
    const end = encrypted.substring(encrypted.length - 4);
    return `${start}...${end}`;
}

/**
 * Check if a value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
    return value.startsWith('0x') && value.length > 20;
}
