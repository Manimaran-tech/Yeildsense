//! PositionTracker - Tracks encrypted position data with full profit accounting
//! 
//! This account stores:
//! - LP position reference (NFT mint)
//! - Encrypted deposit amounts (token A and B via Inco handles)
//! - Encrypted profit tracking (fees + 3 reward mints)
//! - Position metadata (tick range, rebalance count)

use anchor_lang::prelude::*;

/// Tracks a user's LP position with encrypted profit data
#[account]
pub struct PositionTracker {
    /// User who owns this position
    pub user: Pubkey,
    
    /// LP NFT mint address (actual Whirlpool position)
    pub lp_position_mint: Pubkey,
    
    /// Whirlpool this position is in
    pub whirlpool: Pubkey,
    
    // ========== ENCRYPTED DEPOSIT TRACKING ==========
    /// Inco handle for encrypted token A deposit amount
    pub encrypted_deposit_a: u128,
    
    /// Inco handle for encrypted token B deposit amount
    pub encrypted_deposit_b: u128,
    
    /// Timestamp of initial deposit
    pub deposit_timestamp: i64,
    
    // ========== ENCRYPTED PROFIT TRACKING (DUAL TOKEN) ==========
    /// Inco handle for encrypted token A realized profit (fees)
    pub encrypted_realized_profit_a: u128,
    
    /// Inco handle for encrypted token B realized profit (fees)
    pub encrypted_realized_profit_b: u128,
    
    // ========== ENCRYPTED REWARD TRACKING (3 POSSIBLE MINTS) ==========
    /// Inco handle for encrypted reward 0 balance
    pub encrypted_reward_0: u128,
    
    /// Inco handle for encrypted reward 1 balance
    pub encrypted_reward_1: u128,
    
    /// Inco handle for encrypted reward 2 balance
    pub encrypted_reward_2: u128,
    
    // ========== POSITION METADATA ==========
    /// Lower tick index of the position's range
    pub tick_lower: i32,
    
    /// Upper tick index of the position's range
    pub tick_upper: i32,
    
    /// Number of times this position has been rebalanced
    pub rebalance_count: u16,
    
    /// Last update timestamp
    pub last_update: i64,
    
    /// PDA bump seed
    pub bump: u8,
}

impl PositionTracker {
    /// Account size in bytes
    pub const LEN: usize = 8 +  // discriminator
        32 +    // user
        32 +    // lp_position_mint
        32 +    // whirlpool
        16 +    // encrypted_deposit_a
        16 +    // encrypted_deposit_b
        8 +     // deposit_timestamp
        16 +    // encrypted_realized_profit_a
        16 +    // encrypted_realized_profit_b
        16 +    // encrypted_reward_0
        16 +    // encrypted_reward_1
        16 +    // encrypted_reward_2
        4 +     // tick_lower
        4 +     // tick_upper
        2 +     // rebalance_count
        8 +     // last_update
        1;      // bump
        // Total: 233 bytes

    /// Initialize a new position tracker
    pub fn initialize(
        &mut self,
        user: Pubkey,
        lp_position_mint: Pubkey,
        whirlpool: Pubkey,
        encrypted_deposit_a: u128,
        encrypted_deposit_b: u128,
        tick_lower: i32,
        tick_upper: i32,
        bump: u8,
    ) -> Result<()> {
        self.user = user;
        self.lp_position_mint = lp_position_mint;
        self.whirlpool = whirlpool;
        self.encrypted_deposit_a = encrypted_deposit_a;
        self.encrypted_deposit_b = encrypted_deposit_b;
        self.deposit_timestamp = Clock::get()?.unix_timestamp;
        self.encrypted_realized_profit_a = 0;
        self.encrypted_realized_profit_b = 0;
        self.encrypted_reward_0 = 0;
        self.encrypted_reward_1 = 0;
        self.encrypted_reward_2 = 0;
        self.tick_lower = tick_lower;
        self.tick_upper = tick_upper;
        self.rebalance_count = 0;
        self.last_update = self.deposit_timestamp;
        self.bump = bump;
        Ok(())
    }

    /// Update position after rebalance
    pub fn update_after_rebalance(
        &mut self,
        new_lp_position_mint: Pubkey,
        new_tick_lower: i32,
        new_tick_upper: i32,
    ) -> Result<()> {
        self.lp_position_mint = new_lp_position_mint;
        self.tick_lower = new_tick_lower;
        self.tick_upper = new_tick_upper;
        self.rebalance_count = self.rebalance_count.saturating_add(1);
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }
}
