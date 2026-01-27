//! VaultPDA - Program-owned account that holds tokens and LP NFTs
//!
//! This PDA:
//! - Owns user token accounts for deposit/withdraw
//! - Owns LP position token accounts (holds NFTs)
//! - Signs CPI calls to Whirlpool program
//! - Includes reentrancy guard

use anchor_lang::prelude::*;

/// Vault PDA that custodies tokens and LP positions
#[account]
pub struct VaultPDA {
    /// User who owns this vault
    pub owner: Pubkey,
    
    /// Reentrancy guard - prevents recursive CPI attacks
    pub locked: bool,
    
    /// Total positions created through this vault
    pub position_count: u32,
    
    /// PDA bump seed
    pub bump: u8,
}

impl VaultPDA {
    /// Account size in bytes
    pub const LEN: usize = 8 +  // discriminator
        32 +    // owner
        1 +     // locked
        4 +     // position_count
        1;      // bump
        // Total: 46 bytes

    /// Initialize a new vault
    pub fn initialize(&mut self, owner: Pubkey, bump: u8) {
        self.owner = owner;
        self.locked = false;
        self.position_count = 0;
        self.bump = bump;
    }

    /// Lock the vault (reentrancy guard)
    pub fn lock(&mut self) -> Result<()> {
        require!(!self.locked, VaultError::VaultLocked);
        self.locked = true;
        Ok(())
    }

    /// Unlock the vault
    pub fn unlock(&mut self) {
        self.locked = false;
    }

    /// Increment position count
    pub fn increment_position_count(&mut self) {
        self.position_count = self.position_count.saturating_add(1);
    }

    /// Decrement position count (when a position is closed)
    pub fn decrement_position_count(&mut self) {
        self.position_count = self.position_count.saturating_sub(1);
    }
}

#[error_code]
pub enum VaultError {
    #[msg("Vault is locked - operation in progress")]
    VaultLocked,
}
