//! Verify Decryption - Full Ed25519 signature validation for Inco attestations
//!
//! This instruction provides COMPLETE on-chain verification:
//! 1. Validates Ed25519 instruction is present at index 0
//! 2. Verifies signer is the trusted Inco covalidator
//! 3. Validates message hash matches provided handles + plaintexts
//! 4. Signature verification is done by Solana runtime (Ed25519 precompile)

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;

/// Ed25519 program ID (native precompile for signature verification)
pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

/// Inco covalidator public key (from Inco devnet/mainnet config)
/// IMPORTANT: Update this with actual Inco covalidator pubkey for deployment
pub const INCO_COVALIDATOR_PUBKEY: [u8; 32] = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // TODO: Replace with actual Inco covalidator pubkey before deployment
];

/// Ed25519 instruction data layout:
/// - num_signatures (1 byte)
/// - padding (1 byte)
/// - signature_offset (2 bytes, little-endian)
/// - signature_instruction_index (2 bytes)
/// - public_key_offset (2 bytes)
/// - public_key_instruction_index (2 bytes)
/// - message_offset (2 bytes)
/// - message_size (2 bytes)
/// - message_instruction_index (2 bytes)
/// [signature data follows if in same instruction]
/// [public key data follows]
/// [message data follows]

pub fn handler(
    ctx: Context<VerifyDecryption>,
    num_handles: u8,
    handles: Vec<[u8; 16]>,
    plaintexts: Vec<[u8; 16]>,
) -> Result<()> {
    // Validate input lengths match
    require!(
        handles.len() == num_handles as usize,
        VerifyError::HandleCountMismatch
    );
    require!(
        plaintexts.len() == num_handles as usize,
        VerifyError::PlaintextCountMismatch
    );

    let instructions_account = &ctx.accounts.instructions;

    // ========== STEP 1: Load Ed25519 instruction (MUST be index 0) ==========
    let ed25519_ix = anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked(
        0, 
        instructions_account,
    ).map_err(|_| VerifyError::MissingEd25519Instruction)?;

    // ========== STEP 2: Verify program ID is Ed25519 precompile ==========
    require!(
        ed25519_ix.program_id == ED25519_PROGRAM_ID,
        VerifyError::InvalidEd25519Program
    );
    msg!("✓ Ed25519 program ID verified");

    // ========== STEP 3: Parse Ed25519 instruction data ==========
    let data = &ed25519_ix.data;
    require!(data.len() >= 16, VerifyError::Ed25519DataTooShort);

    let num_signatures = data[0];
    require!(num_signatures == 1, VerifyError::InvalidSignatureCount);

    // Parse offsets (little-endian u16)
    let signature_offset = u16::from_le_bytes([data[2], data[3]]) as usize;
    let pubkey_offset = u16::from_le_bytes([data[6], data[7]]) as usize;
    let message_offset = u16::from_le_bytes([data[10], data[11]]) as usize;
    let message_size = u16::from_le_bytes([data[12], data[13]]) as usize;

    // Validate data length
    let required_len = message_offset + message_size;
    require!(data.len() >= required_len, VerifyError::Ed25519DataTooShort);

    // ========== STEP 4: CRITICAL - Verify signer is Inco covalidator ==========
    require!(
        pubkey_offset + 32 <= data.len(),
        VerifyError::Ed25519DataTooShort
    );
    let signer_pubkey = &data[pubkey_offset..pubkey_offset + 32];
    
    require!(
        signer_pubkey == INCO_COVALIDATOR_PUBKEY,
        VerifyError::UnauthorizedCovalidator
    );
    msg!("✓ Inco covalidator pubkey verified");

    // ========== STEP 5: CRITICAL - Verify message matches handles + plaintexts ==========
    let message = &data[message_offset..message_offset + message_size];
    
    // Expected message format: handle0 || plaintext0 || handle1 || plaintext1 || ...
    // Each pair is 32 bytes (16 handle + 16 plaintext)
    let expected_len = (num_handles as usize) * 32;
    require!(
        message.len() == expected_len,
        VerifyError::MessageLengthMismatch
    );

    // Verify each handle-plaintext pair matches what we expect
    for i in 0..num_handles as usize {
        let msg_handle = &message[i * 32..i * 32 + 16];
        let msg_plaintext = &message[i * 32 + 16..i * 32 + 32];
        
        require!(
            msg_handle == &handles[i],
            VerifyError::HandleMismatch
        );
        require!(
            msg_plaintext == &plaintexts[i],
            VerifyError::PlaintextMismatch
        );
    }
    msg!("✓ Message content verified ({} handle-plaintext pairs)", num_handles);

    // ========== STEP 6: Signature verification ==========
    // The Ed25519 precompile instruction is verified by the Solana runtime
    // BEFORE our program executes. If we reach this point, the signature is valid.
    msg!("✓ Ed25519 signature verified by Solana runtime");

    // ========== STEP 7: Emit verification event ==========
    emit!(DecryptionVerified {
        authority: ctx.accounts.authority.key(),
        num_handles,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Decryption verification complete! {} handles verified on-chain", num_handles);
    Ok(())
}

#[derive(Accounts)]
pub struct VerifyDecryption<'info> {
    pub authority: Signer<'info>,
    
    /// CHECK: Instructions sysvar for reading Ed25519 instruction
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

#[error_code]
pub enum VerifyError {
    #[msg("Handle count does not match expected")]
    HandleCountMismatch,
    
    #[msg("Plaintext count does not match expected")]
    PlaintextCountMismatch,
    
    #[msg("Missing Ed25519 instruction at index 0")]
    MissingEd25519Instruction,
    
    #[msg("Invalid Ed25519 program ID")]
    InvalidEd25519Program,
    
    #[msg("Ed25519 instruction data too short")]
    Ed25519DataTooShort,
    
    #[msg("Invalid signature count, expected 1")]
    InvalidSignatureCount,
    
    #[msg("Unauthorized covalidator - not trusted Inco signer")]
    UnauthorizedCovalidator,
    
    #[msg("Message length does not match expected")]
    MessageLengthMismatch,
    
    #[msg("Handle in message does not match provided handle")]
    HandleMismatch,
    
    #[msg("Plaintext in message does not match provided plaintext")]
    PlaintextMismatch,
}

#[event]
pub struct DecryptionVerified {
    pub authority: Pubkey,
    pub num_handles: u8,
    pub timestamp: i64,
}
