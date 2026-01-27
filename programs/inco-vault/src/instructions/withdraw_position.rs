//! Withdraw Position - Decreases liquidity and optionally closes position
//!
//! This instruction:
//! 1. Collects all pending fees and rewards
//! 2. Decreases liquidity from the Whirlpool position
//! 3. Optionally closes the position if all liquidity is removed
//! 4. Returns tokens to user

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

use crate::state::{PositionTracker, VaultPDA, VaultConfig};
use super::create_position::{INCO_LIGHTNING_ID, WHIRLPOOL_PROGRAM_ID};
use super::whirlpool_cpi;

/// Withdraw liquidity from position
pub fn handler(
    ctx: Context<WithdrawPosition>,
    liquidity_amount: u128,
    token_min_a: u64,
    token_min_b: u64,
    close_position: bool,
) -> Result<()> {
    // Step 0: Check vault not paused + lock
    ctx.accounts.vault_config.require_not_paused()?;
    ctx.accounts.vault_pda.lock()?;

    let vault_seeds = &[
        b"vault".as_ref(),
        ctx.accounts.authority.key.as_ref(),
        &[ctx.accounts.vault_pda.bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    // Step 1: Collect any pending fees first
    let pre_balance_a = ctx.accounts.token_account_a.amount;
    let pre_balance_b = ctx.accounts.token_account_b.amount;

    whirlpool_cpi::cpi_collect_fees(
        ctx.accounts.whirlpool_program.to_account_info(),
        ctx.accounts.whirlpool.to_account_info(),
        ctx.accounts.vault_pda.to_account_info(),
        ctx.accounts.whirlpool_position.to_account_info(),
        ctx.accounts.position_token_account.to_account_info(),
        ctx.accounts.token_account_a.to_account_info(),
        ctx.accounts.token_vault_a.to_account_info(),
        ctx.accounts.token_account_b.to_account_info(),
        ctx.accounts.token_vault_b.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        signer_seeds,
    )?;

    msg!("Fees collected before withdrawal");

    // Step 2: Decrease liquidity
    whirlpool_cpi::cpi_decrease_liquidity(
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
        token_min_a,
        token_min_b,
    )?;

    msg!("Liquidity decreased: {}", liquidity_amount);

    // Step 3: Reload to calculate received amounts
    ctx.accounts.token_account_a.reload()?;
    ctx.accounts.token_account_b.reload()?;

    let received_a = ctx.accounts.token_account_a.amount.saturating_sub(pre_balance_a);
    let received_b = ctx.accounts.token_account_b.amount.saturating_sub(pre_balance_b);

    msg!("Tokens withdrawn: A={}, B={}", received_a, received_b);

    // Step 4: Close position if requested and all liquidity removed
    if close_position {
        whirlpool_cpi::cpi_close_position(
            ctx.accounts.whirlpool_program.to_account_info(),
            ctx.accounts.vault_pda.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.whirlpool_position.to_account_info(),
            ctx.accounts.position_mint.to_account_info(),
            ctx.accounts.position_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            signer_seeds,
        )?;

        msg!("Position closed");

        // Update vault stats
        ctx.accounts.vault_pda.decrement_position_count();
    }

    // Step 5: Update position tracker
    let tracker = &mut ctx.accounts.position_tracker;
    tracker.last_update = Clock::get()?.unix_timestamp;

    // Unlock vault
    ctx.accounts.vault_pda.unlock();

    emit!(PositionWithdrawn {
        user: ctx.accounts.authority.key(),
        position_mint: ctx.accounts.position_mint.key(),
        liquidity_withdrawn: liquidity_amount,
        token_a_received: received_a,
        token_b_received: received_b,
        position_closed: close_position,
        timestamp: tracker.last_update,
    });

    msg!("Withdrawal complete!");
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawPosition<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(seeds = [b"config"], bump = vault_config.bump)]
    pub vault_config: Account<'info, VaultConfig>,
    
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault_pda.bump,
        constraint = vault_pda.owner == authority.key() @ WithdrawError::InvalidOwner
    )]
    pub vault_pda: Account<'info, VaultPDA>,
    
    #[account(
        mut,
        seeds = [b"tracker", authority.key().as_ref(), position_tracker.whirlpool.as_ref()],
        bump = position_tracker.bump,
        constraint = position_tracker.user == authority.key() @ WithdrawError::InvalidOwner
    )]
    pub position_tracker: Account<'info, PositionTracker>,
    
    // Whirlpool accounts
    /// CHECK: Whirlpool (validated by CPI)
    #[account(mut)]
    pub whirlpool: UncheckedAccount<'info>,
    
    /// CHECK: Position (validated by CPI)
    #[account(mut)]
    pub whirlpool_position: UncheckedAccount<'info>,
    
    // LP NFT
    #[account(mut)]
    pub position_mint: Account<'info, Mint>,
    
    /// CHECK: Position token account (owned by vault PDA)
    #[account(mut)]
    pub position_token_account: UncheckedAccount<'info>,
    
    // User token accounts to receive withdrawn tokens
    #[account(
        mut,
        constraint = token_account_a.owner == authority.key() @ WithdrawError::InvalidOwner
    )]
    pub token_account_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = token_account_b.owner == authority.key() @ WithdrawError::InvalidOwner
    )]
    pub token_account_b: Account<'info, TokenAccount>,
    
    // Pool vaults
    /// CHECK: Token vault A
    #[account(mut)]
    pub token_vault_a: UncheckedAccount<'info>,
    
    /// CHECK: Token vault B
    #[account(mut)]
    pub token_vault_b: UncheckedAccount<'info>,
    
    // Tick arrays
    /// CHECK: Tick array lower
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,
    
    /// CHECK: Tick array upper
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,
    
    // Programs
    /// CHECK: Whirlpool program
    #[account(address = WHIRLPOOL_PROGRAM_ID)]
    pub whirlpool_program: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum WithdrawError {
    #[msg("Invalid vault owner")]
    InvalidOwner,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
}

#[event]
pub struct PositionWithdrawn {
    pub user: Pubkey,
    pub position_mint: Pubkey,
    pub liquidity_withdrawn: u128,
    pub token_a_received: u64,
    pub token_b_received: u64,
    pub position_closed: bool,
    pub timestamp: i64,
}
