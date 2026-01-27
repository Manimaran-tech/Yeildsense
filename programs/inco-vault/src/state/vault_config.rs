//! VaultConfig - Global configuration with emergency controls
//!
//! This account stores:
//! - Admin address with 2-step rotation
//! - Emergency pause functionality
//! - Protocol parameters

use anchor_lang::prelude::*;

/// Global vault configuration with emergency controls
#[account]
pub struct VaultConfig {
    /// Current admin (has pause/unpause authority)
    pub admin: Pubkey,
    
    /// Pending admin for 2-step rotation
    pub pending_admin: Pubkey,
    
    /// Whether the vault is paused
    pub paused: bool,
    
    /// Timestamp when vault was paused (0 if not paused)
    pub pause_timestamp: i64,
    
    /// Default max slippage in basis points (100 = 1%)
    pub default_max_slippage_bps: u16,
    
    /// Minimum liquidity per position (dust protection)
    pub min_liquidity: u128,
    
    /// Maximum liquidity per position (sanity cap)
    pub max_liquidity: u128,
    
    /// PDA bump seed
    pub bump: u8,
}

impl VaultConfig {
    /// Account size in bytes
    pub const LEN: usize = 8 +  // discriminator
        32 +    // admin
        32 +    // pending_admin
        1 +     // paused
        8 +     // pause_timestamp
        2 +     // default_max_slippage_bps
        16 +    // min_liquidity
        16 +    // max_liquidity
        1;      // bump
        // Total: 116 bytes

    /// Default minimum liquidity (dust protection)
    pub const DEFAULT_MIN_LIQUIDITY: u128 = 1_000;
    
    /// Default maximum liquidity per position
    pub const DEFAULT_MAX_LIQUIDITY: u128 = 1_000_000_000_000_000;
    
    /// Default max slippage (1%)
    pub const DEFAULT_MAX_SLIPPAGE_BPS: u16 = 100;

    /// Initialize vault config
    pub fn initialize(&mut self, admin: Pubkey, bump: u8) {
        self.admin = admin;
        self.pending_admin = Pubkey::default();
        self.paused = false;
        self.pause_timestamp = 0;
        self.default_max_slippage_bps = Self::DEFAULT_MAX_SLIPPAGE_BPS;
        self.min_liquidity = Self::DEFAULT_MIN_LIQUIDITY;
        self.max_liquidity = Self::DEFAULT_MAX_LIQUIDITY;
        self.bump = bump;
    }

    /// Pause the vault
    pub fn pause(&mut self) -> Result<()> {
        self.paused = true;
        self.pause_timestamp = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Unpause the vault
    pub fn unpause(&mut self) {
        self.paused = false;
        self.pause_timestamp = 0;
    }

    /// Propose new admin (step 1 of rotation)
    pub fn propose_admin(&mut self, new_admin: Pubkey) {
        self.pending_admin = new_admin;
    }

    /// Accept admin role (step 2 of rotation)
    pub fn accept_admin(&mut self, new_admin: Pubkey) -> Result<()> {
        require!(
            self.pending_admin == new_admin,
            ConfigError::NotPendingAdmin
        );
        self.admin = new_admin;
        self.pending_admin = Pubkey::default();
        Ok(())
    }

    /// Check if vault is operational
    pub fn require_not_paused(&self) -> Result<()> {
        require!(!self.paused, ConfigError::VaultPaused);
        Ok(())
    }

    /// Validate liquidity amount against bounds
    pub fn validate_liquidity(&self, amount: u128) -> Result<()> {
        require!(amount >= self.min_liquidity, ConfigError::LiquidityTooLow);
        require!(amount <= self.max_liquidity, ConfigError::LiquidityTooHigh);
        Ok(())
    }
}

#[error_code]
pub enum ConfigError {
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Not the pending admin")]
    NotPendingAdmin,
    #[msg("Liquidity amount too low")]
    LiquidityTooLow,
    #[msg("Liquidity amount too high")]
    LiquidityTooHigh,
}
