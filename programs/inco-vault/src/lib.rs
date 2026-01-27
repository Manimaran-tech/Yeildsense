//! Inco Vault - Privacy-preserving yield vault with Whirlpool integration
//!
//! This program provides:
//! - Encrypted position tracking via Inco handles
//! - Real Whirlpool LP position management (open, increase, decrease, close)
//! - Dual-token fee collection with 3 reward mints
//! - Correct rebalance semantics (close → open)
//! - Full Ed25519 attested decryption verification
//! - Emergency controls (pause, admin rotation)

use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("incoBncSVFXQx8LWWND6rrZMsNpYzXJ8jSKSfLHFSE3");

#[program]
pub mod inco_vault {
    use super::*;

    // ========== INITIALIZATION ==========
    
    /// Initialize the global vault configuration
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize::handler_init_config(ctx)
    }

    /// Initialize a user's vault PDA
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        instructions::initialize::handler_init_vault(ctx)
    }

    // ========== POSITION MANAGEMENT ==========
    
    /// Create a new LP position with encrypted tracking
    pub fn create_position_with_liquidity(
        ctx: Context<CreatePositionWithLiquidity>,
        encrypted_amount_a: Vec<u8>,
        encrypted_amount_b: Vec<u8>,
        amount_type: u8,
        tick_lower_index: i32,
        tick_upper_index: i32,
        liquidity_amount: u128,
        token_max_a: u64,
        token_max_b: u64,
        max_slippage_bps: Option<u16>,
    ) -> Result<()> {
        instructions::create_position::handler(
            ctx,
            encrypted_amount_a,
            encrypted_amount_b,
            amount_type,
            tick_lower_index,
            tick_upper_index,
            liquidity_amount,
            token_max_a,
            token_max_b,
            max_slippage_bps,
        )
    }

    /// Collect all fees and rewards, update encrypted profit
    pub fn collect_all_profits(ctx: Context<CollectAllProfits>) -> Result<()> {
        instructions::collect_profits::handler(ctx)
    }

    /// Withdraw liquidity from position (partial or full)
    pub fn withdraw_position(
        ctx: Context<WithdrawPosition>,
        liquidity_amount: u128,
        token_min_a: u64,
        token_min_b: u64,
        close_position: bool,
    ) -> Result<()> {
        instructions::withdraw_position::handler(ctx, liquidity_amount, token_min_a, token_min_b, close_position)
    }

    /// Rebalance position to new tick range (close old, open new)
    pub fn rebalance_position(
        ctx: Context<RebalancePosition>,
        new_tick_lower: i32,
        new_tick_upper: i32,
        max_slippage_bps: Option<u16>,
    ) -> Result<()> {
        instructions::rebalance::handler(ctx, new_tick_lower, new_tick_upper, max_slippage_bps)
    }

    // ========== VERIFICATION ==========
    
    /// Verify decryption via Ed25519 attestation
    pub fn verify_decryption(
        ctx: Context<VerifyDecryption>,
        num_handles: u8,
        handles: Vec<[u8; 16]>,
        plaintexts: Vec<[u8; 16]>,
    ) -> Result<()> {
        instructions::verify_decryption::handler(ctx, num_handles, handles, plaintexts)
    }

    // ========== ADMIN ==========
    
    /// Pause the vault (emergency)
    pub fn pause_vault(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::handler_pause(ctx)
    }

    /// Unpause the vault
    pub fn unpause_vault(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::handler_unpause(ctx)
    }

    /// Propose new admin (step 1 of 2-step rotation)
    pub fn propose_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
        instructions::admin::handler_propose_admin(ctx, new_admin)
    }

    /// Accept admin role (step 2 of 2-step rotation)
    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        instructions::admin::handler_accept_admin(ctx)
    }

    /// Update protocol parameters
    pub fn update_params(
        ctx: Context<AdminAction>,
        max_slippage_bps: Option<u16>,
        min_liquidity: Option<u128>,
        max_liquidity: Option<u128>,
    ) -> Result<()> {
        instructions::admin::handler_update_params(ctx, max_slippage_bps, min_liquidity, max_liquidity)
    }
}
