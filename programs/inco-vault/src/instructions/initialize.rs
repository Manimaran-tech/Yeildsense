//! Initialize instruction - Sets up VaultConfig and VaultPDA

use anchor_lang::prelude::*;
use crate::state::{VaultConfig, VaultPDA};

/// Initialize the vault configuration
pub fn handler_init_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.vault_config;
    config.initialize(ctx.accounts.admin.key(), ctx.bumps.vault_config);
    
    msg!("Vault config initialized with admin: {}", ctx.accounts.admin.key());
    Ok(())
}

/// Initialize a user's vault PDA
pub fn handler_init_vault(ctx: Context<InitializeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_pda;
    vault.initialize(ctx.accounts.owner.key(), ctx.bumps.vault_pda);
    
    msg!("Vault PDA initialized for owner: {}", ctx.accounts.owner.key());
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = VaultConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        init,
        payer = owner,
        space = VaultPDA::LEN,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault_pda: Account<'info, VaultPDA>,
    
    pub system_program: Program<'info, System>,
}
