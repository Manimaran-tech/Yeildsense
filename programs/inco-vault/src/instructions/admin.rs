//! Admin instructions - Pause, unpause, and admin rotation

use anchor_lang::prelude::*;
use crate::state::VaultConfig;

/// Pause the vault (emergency)
pub fn handler_pause(ctx: Context<AdminAction>) -> Result<()> {
    require!(
        ctx.accounts.admin.key() == ctx.accounts.vault_config.admin,
        AdminError::Unauthorized
    );
    
    ctx.accounts.vault_config.pause()?;
    
    emit!(VaultPaused {
        admin: ctx.accounts.admin.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Vault PAUSED by admin: {}", ctx.accounts.admin.key());
    Ok(())
}

/// Unpause the vault
pub fn handler_unpause(ctx: Context<AdminAction>) -> Result<()> {
    require!(
        ctx.accounts.admin.key() == ctx.accounts.vault_config.admin,
        AdminError::Unauthorized
    );
    
    ctx.accounts.vault_config.unpause();
    
    emit!(VaultUnpaused {
        admin: ctx.accounts.admin.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Vault UNPAUSED by admin: {}", ctx.accounts.admin.key());
    Ok(())
}

/// Propose new admin (step 1)
pub fn handler_propose_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
    require!(
        ctx.accounts.admin.key() == ctx.accounts.vault_config.admin,
        AdminError::Unauthorized
    );
    
    ctx.accounts.vault_config.propose_admin(new_admin);
    
    emit!(AdminProposed {
        current_admin: ctx.accounts.admin.key(),
        proposed_admin: new_admin,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("New admin proposed: {}", new_admin);
    Ok(())
}

/// Accept admin role (step 2)
pub fn handler_accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    let old_admin = ctx.accounts.vault_config.admin;
    
    ctx.accounts.vault_config.accept_admin(ctx.accounts.new_admin.key())?;
    
    emit!(AdminRotated {
        old_admin,
        new_admin: ctx.accounts.new_admin.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Admin rotated from {} to {}", old_admin, ctx.accounts.new_admin.key());
    Ok(())
}

/// Update protocol parameters
pub fn handler_update_params(
    ctx: Context<AdminAction>,
    max_slippage_bps: Option<u16>,
    min_liquidity: Option<u128>,
    max_liquidity: Option<u128>,
) -> Result<()> {
    require!(
        ctx.accounts.admin.key() == ctx.accounts.vault_config.admin,
        AdminError::Unauthorized
    );
    
    let config = &mut ctx.accounts.vault_config;
    
    if let Some(slippage) = max_slippage_bps {
        require!(slippage <= 10000, AdminError::InvalidSlippage); // Max 100%
        config.default_max_slippage_bps = slippage;
    }
    
    if let Some(min_liq) = min_liquidity {
        config.min_liquidity = min_liq;
    }
    
    if let Some(max_liq) = max_liquidity {
        require!(max_liq > config.min_liquidity, AdminError::InvalidLiquidityBounds);
        config.max_liquidity = max_liq;
    }
    
    msg!("Vault parameters updated");
    Ok(())
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"config"], bump = vault_config.bump)]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(mut)]
    pub new_admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"config"],
        bump = vault_config.bump,
        constraint = vault_config.pending_admin == new_admin.key() @ AdminError::NotPendingAdmin
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[error_code]
pub enum AdminError {
    #[msg("Unauthorized - not admin")]
    Unauthorized,
    #[msg("Not the pending admin")]
    NotPendingAdmin,
    #[msg("Invalid slippage value")]
    InvalidSlippage,
    #[msg("Invalid liquidity bounds")]
    InvalidLiquidityBounds,
}

#[event]
pub struct VaultPaused {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultUnpaused {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AdminProposed {
    pub current_admin: Pubkey,
    pub proposed_admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AdminRotated {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub timestamp: i64,
}
