//! Create Position - Opens real Whirlpool LP position with encrypted tracking
//!
//! This instruction:
//! 1. Encrypts deposit amount via Inco CPI
//! 2. Opens real Whirlpool position (mints LP NFT)
//! 3. Adds liquidity (transfers tokens to pool)
//! 4. Creates PositionTracker with encrypted data

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::{PositionTracker, VaultPDA, VaultConfig};
use super::whirlpool_cpi::{self, OpenPositionBumps};

use anchor_lang::solana_program::pubkey;

// Inco Lightning program ID
pub const INCO_LIGHTNING_ID: Pubkey = pubkey!("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj");

// Whirlpool program ID
pub const WHIRLPOOL_PROGRAM_ID: Pubkey = pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

/// Create a new position with liquidity
pub fn handler(
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
    // Step 0: Check vault not paused + validate liquidity
    ctx.accounts.vault_config.require_not_paused()?;
    ctx.accounts.vault_config.validate_liquidity(liquidity_amount)?;
    
    // Step 0.5: Lock vault (reentrancy guard)
    ctx.accounts.vault_pda.lock()?;

    // Step 1: Encrypt amounts via Inco CPI
    // Create encrypted account A
    let handle_a = super::inco_lightning_cpi::cpi_new_euint128(
        ctx.accounts.inco_lightning_program.to_account_info(),
        ctx.accounts.authority.to_account_info(),
        encrypted_amount_a,
        amount_type,
    )?;
    msg!("Encrypted account A created with handle: {}", handle_a);

    // Create encrypted account B
    let handle_b = super::inco_lightning_cpi::cpi_new_euint128(
        ctx.accounts.inco_lightning_program.to_account_info(),
        ctx.accounts.authority.to_account_info(),
        encrypted_amount_b,
        amount_type,
    )?;
    msg!("Encrypted account B created with handle: {}", handle_b);

    msg!("Encrypted handles: A={}, B={}", handle_a, handle_b);

    // Step 2: Build signer seeds for vault PDA
    let vault_seeds = &[
        b"vault".as_ref(),
        ctx.accounts.authority.key.as_ref(),
        &[ctx.accounts.vault_pda.bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    // Step 3: CPI to Whirlpool: open_position
    // This mints the LP NFT and creates the position account
    whirlpool_cpi::cpi_open_position(
        ctx.accounts.whirlpool_program.to_account_info(),
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.vault_pda.to_account_info(),
        ctx.accounts.whirlpool_position.to_account_info(),
        ctx.accounts.position_mint.to_account_info(),
        ctx.accounts.position_token_account.to_account_info(),
        ctx.accounts.whirlpool.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        ctx.accounts.associated_token_program.to_account_info(),
        signer_seeds,
        OpenPositionBumps { position_bump: 255 }, // Bump is computed by Whirlpool program
        tick_lower_index,
        tick_upper_index,
    )?;

    msg!("LP position opened at ticks [{}, {}]", tick_lower_index, tick_upper_index);

    // Step 4: CPI to Whirlpool: increase_liquidity
    // Calculate slippage-adjusted max amounts
    let slippage = max_slippage_bps.unwrap_or(ctx.accounts.vault_config.default_max_slippage_bps);
    let max_a_with_slippage = token_max_a
        .checked_mul(10000 + slippage as u64)
        .ok_or(CreatePositionError::Overflow)?
        .checked_div(10000)
        .ok_or(CreatePositionError::Overflow)?;
    let max_b_with_slippage = token_max_b
        .checked_mul(10000 + slippage as u64)
        .ok_or(CreatePositionError::Overflow)?
        .checked_div(10000)
        .ok_or(CreatePositionError::Overflow)?;

    whirlpool_cpi::cpi_increase_liquidity(
        ctx.accounts.whirlpool_program.to_account_info(),
        ctx.accounts.whirlpool.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_pda.to_account_info(),
        ctx.accounts.whirlpool_position.to_account_info(),
        ctx.accounts.position_token_account.to_account_info(),
        ctx.accounts.token_account_a.to_account_info(),
        ctx.accounts.token_account_b.to_account_info(),
        ctx.accounts.token_vault_a.to_account_info(),
        ctx.accounts.token_vault_b.to_account_info(),
        ctx.accounts.tick_array_lower.to_account_info(),
        ctx.accounts.tick_array_upper.to_account_info(),
        signer_seeds,
        liquidity_amount,
        max_a_with_slippage,
        max_b_with_slippage,
    )?;

    msg!("Liquidity added: {} (max A: {}, max B: {})", 
         liquidity_amount, max_a_with_slippage, max_b_with_slippage);

    // Step 5: Initialize PositionTracker with encrypted data
    let tracker = &mut ctx.accounts.position_tracker;
    tracker.initialize(
        ctx.accounts.authority.key(),
        ctx.accounts.position_mint.key(),
        ctx.accounts.whirlpool.key(),
        handle_a,
        handle_b,
        tick_lower_index,
        tick_upper_index,
        ctx.bumps.position_tracker,
    )?;

    // Step 6: Update vault stats
    ctx.accounts.vault_pda.increment_position_count();
    
    // Step 7: Unlock vault
    ctx.accounts.vault_pda.unlock();

    // Emit event
    emit!(PositionCreated {
        user: ctx.accounts.authority.key(),
        position_mint: ctx.accounts.position_mint.key(),
        whirlpool: ctx.accounts.whirlpool.key(),
        tick_lower: tick_lower_index,
        tick_upper: tick_upper_index,
        liquidity: liquidity_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Position created successfully!");
    Ok(())
}

#[derive(Accounts)]
pub struct CreatePositionWithLiquidity<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    // Global config (for pause check)
    #[account(seeds = [b"config"], bump = vault_config.bump)]
    pub vault_config: Account<'info, VaultConfig>,
    
    // User's vault PDA
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault_pda.bump,
        constraint = vault_pda.owner == authority.key() @ CreatePositionError::InvalidOwner
    )]
    pub vault_pda: Account<'info, VaultPDA>,
    
    // Position tracker (new)
    #[account(
        init,
        payer = authority,
        space = PositionTracker::LEN,
        seeds = [b"tracker", authority.key().as_ref(), whirlpool.key().as_ref()],
        bump
    )]
    pub position_tracker: Account<'info, PositionTracker>,
    
    // Whirlpool accounts
    /// CHECK: Whirlpool account (validated by CPI)
    pub whirlpool: UncheckedAccount<'info>,
    
    /// CHECK: Whirlpool position (created by CPI)
    #[account(mut)]
    pub whirlpool_position: UncheckedAccount<'info>,
    
    // LP NFT mint
    #[account(mut)]
    pub position_mint: Account<'info, Mint>,
    
    // LP NFT token account (owned by vault PDA)
    #[account(mut)]
    pub position_token_account: Account<'info, TokenAccount>,
    
    // User token accounts for deposit
    #[account(
        mut,
        constraint = token_account_a.owner == authority.key() @ CreatePositionError::InvalidOwner
    )]
    pub token_account_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = token_account_b.owner == authority.key() @ CreatePositionError::InvalidOwner
    )]
    pub token_account_b: Account<'info, TokenAccount>,
    
    // Whirlpool token vaults
    /// CHECK: Pool vault A (validated by CPI)
    #[account(mut)]
    pub token_vault_a: UncheckedAccount<'info>,
    
    /// CHECK: Pool vault B (validated by CPI)
    #[account(mut)]
    pub token_vault_b: UncheckedAccount<'info>,
    
    // Tick arrays
    /// CHECK: Tick array lower (validated by CPI)
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,
    
    /// CHECK: Tick array upper (validated by CPI)
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,
    
    // Programs
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: UncheckedAccount<'info>,
    
    /// CHECK: Whirlpool program
    #[account(address = WHIRLPOOL_PROGRAM_ID)]
    pub whirlpool_program: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum CreatePositionError {
    #[msg("Invalid vault owner")]
    InvalidOwner,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
}

#[event]
pub struct PositionCreated {
    pub user: Pubkey,
    pub position_mint: Pubkey,
    pub whirlpool: Pubkey,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub liquidity: u128,
    pub timestamp: i64,
}
