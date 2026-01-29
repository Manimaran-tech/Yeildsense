//! CPI helpers for Orca Whirlpool interactions
//! 
//! Uses raw invoke_signed since whirlpool crate isn't available as dependency.
//! Instruction discriminators are from Orca's Anchor IDL.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

use super::create_position::WHIRLPOOL_PROGRAM_ID;

/// Whirlpool instruction discriminators (from Anchor IDL)
pub mod discriminators {
    /// open_position: sha256("global:open_position")[0..8]
    pub const OPEN_POSITION: [u8; 8] = [135, 128, 47, 77, 15, 152, 240, 49];
    /// increase_liquidity: sha256("global:increase_liquidity")[0..8]
    pub const INCREASE_LIQUIDITY: [u8; 8] = [46, 156, 243, 118, 13, 205, 251, 178];
    /// decrease_liquidity: sha256("global:decrease_liquidity")[0..8]
    pub const DECREASE_LIQUIDITY: [u8; 8] = [160, 38, 208, 111, 172, 195, 133, 136];
    /// collect_fees: sha256("global:collect_fees")[0..8]
    pub const COLLECT_FEES: [u8; 8] = [164, 152, 207, 99, 30, 186, 19, 182];
    /// collect_reward: sha256("global:collect_reward")[0..8]
    pub const COLLECT_REWARD: [u8; 8] = [70, 5, 132, 87, 86, 235, 177, 34];
    /// close_position: sha256("global:close_position")[0..8]
    pub const CLOSE_POSITION: [u8; 8] = [123, 134, 81, 0, 49, 68, 98, 98];
}

/// OpenPosition bumps struct
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct OpenPositionBumps {
    pub position_bump: u8,
}

/// CPI to open_position on Whirlpool
pub fn cpi_open_position<'info>(
    whirlpool_program: AccountInfo<'info>,
    funder: AccountInfo<'info>,
    owner: AccountInfo<'info>,
    position: AccountInfo<'info>,
    position_mint: AccountInfo<'info>,
    position_token_account: AccountInfo<'info>,
    whirlpool: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: AccountInfo<'info>,
    associated_token_program: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    bumps: OpenPositionBumps,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    // Build instruction data
    let mut data = Vec::with_capacity(8 + 1 + 4 + 4);
    data.extend_from_slice(&discriminators::OPEN_POSITION);
    data.push(bumps.position_bump);
    data.extend_from_slice(&tick_lower_index.to_le_bytes());
    data.extend_from_slice(&tick_upper_index.to_le_bytes());

    let accounts = vec![
        AccountMeta::new(*funder.key, true),
        AccountMeta::new_readonly(*owner.key, false),
        AccountMeta::new(*position.key, false),
        AccountMeta::new(*position_mint.key, true),
        AccountMeta::new(*position_token_account.key, false),
        AccountMeta::new_readonly(*whirlpool.key, false),
        AccountMeta::new_readonly(*token_program.key, false),
        AccountMeta::new_readonly(*system_program.key, false),
        AccountMeta::new_readonly(*rent.key, false),
        AccountMeta::new_readonly(*associated_token_program.key, false),
    ];

    let ix = Instruction {
        program_id: WHIRLPOOL_PROGRAM_ID,
        accounts,
        data,
    };

    invoke_signed(
        &ix,
        &[
            funder,
            owner,
            position,
            position_mint,
            position_token_account,
            whirlpool,
            token_program,
            system_program,
            rent,
            associated_token_program,
            whirlpool_program,
        ],
        signer_seeds,
    ).map_err(|_e| error!(ErrorCode::CpiError))?;

    Ok(())
}

/// CPI to increase_liquidity on Whirlpool
pub fn cpi_increase_liquidity<'info>(
    whirlpool_program: AccountInfo<'info>,
    whirlpool: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    position_authority: AccountInfo<'info>,
    position: AccountInfo<'info>,
    position_token_account: AccountInfo<'info>,
    token_owner_account_a: AccountInfo<'info>,
    token_owner_account_b: AccountInfo<'info>,
    token_vault_a: AccountInfo<'info>,
    token_vault_b: AccountInfo<'info>,
    tick_array_lower: AccountInfo<'info>,
    tick_array_upper: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    liquidity_amount: u128,
    token_max_a: u64,
    token_max_b: u64,
) -> Result<()> {
    // Build instruction data
    let mut data = Vec::with_capacity(8 + 16 + 8 + 8);
    data.extend_from_slice(&discriminators::INCREASE_LIQUIDITY);
    data.extend_from_slice(&liquidity_amount.to_le_bytes());
    data.extend_from_slice(&token_max_a.to_le_bytes());
    data.extend_from_slice(&token_max_b.to_le_bytes());

    let accounts = vec![
        AccountMeta::new(*whirlpool.key, false),
        AccountMeta::new_readonly(*token_program.key, false),
        AccountMeta::new_readonly(*position_authority.key, true),
        AccountMeta::new(*position.key, false),
        AccountMeta::new_readonly(*position_token_account.key, false),
        AccountMeta::new(*token_owner_account_a.key, false),
        AccountMeta::new(*token_owner_account_b.key, false),
        AccountMeta::new(*token_vault_a.key, false),
        AccountMeta::new(*token_vault_b.key, false),
        AccountMeta::new(*tick_array_lower.key, false),
        AccountMeta::new(*tick_array_upper.key, false),
    ];

    let ix = Instruction {
        program_id: WHIRLPOOL_PROGRAM_ID,
        accounts,
        data,
    };

    invoke_signed(
        &ix,
        &[
            whirlpool,
            token_program,
            position_authority,
            position,
            position_token_account,
            token_owner_account_a,
            token_owner_account_b,
            token_vault_a,
            token_vault_b,
            tick_array_lower,
            tick_array_upper,
            whirlpool_program,
        ],
        signer_seeds,
    ).map_err(|_e| error!(ErrorCode::CpiError))?;

    Ok(())
}

/// CPI to decrease_liquidity on Whirlpool
pub fn cpi_decrease_liquidity<'info>(
    whirlpool_program: AccountInfo<'info>,
    whirlpool: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    position_authority: AccountInfo<'info>,
    position: AccountInfo<'info>,
    position_token_account: AccountInfo<'info>,
    token_owner_account_a: AccountInfo<'info>,
    token_owner_account_b: AccountInfo<'info>,
    token_vault_a: AccountInfo<'info>,
    token_vault_b: AccountInfo<'info>,
    tick_array_lower: AccountInfo<'info>,
    tick_array_upper: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    liquidity_amount: u128,
    token_min_a: u64,
    token_min_b: u64,
) -> Result<()> {
    let mut data = Vec::with_capacity(8 + 16 + 8 + 8);
    data.extend_from_slice(&discriminators::DECREASE_LIQUIDITY);
    data.extend_from_slice(&liquidity_amount.to_le_bytes());
    data.extend_from_slice(&token_min_a.to_le_bytes());
    data.extend_from_slice(&token_min_b.to_le_bytes());

    let accounts = vec![
        AccountMeta::new(*whirlpool.key, false),
        AccountMeta::new_readonly(*token_program.key, false),
        AccountMeta::new_readonly(*position_authority.key, true),
        AccountMeta::new(*position.key, false),
        AccountMeta::new_readonly(*position_token_account.key, false),
        AccountMeta::new(*token_owner_account_a.key, false),
        AccountMeta::new(*token_owner_account_b.key, false),
        AccountMeta::new(*token_vault_a.key, false),
        AccountMeta::new(*token_vault_b.key, false),
        AccountMeta::new(*tick_array_lower.key, false),
        AccountMeta::new(*tick_array_upper.key, false),
    ];

    let ix = Instruction {
        program_id: WHIRLPOOL_PROGRAM_ID,
        accounts,
        data,
    };

    invoke_signed(
        &ix,
        &[
            whirlpool,
            token_program,
            position_authority,
            position,
            position_token_account,
            token_owner_account_a,
            token_owner_account_b,
            token_vault_a,
            token_vault_b,
            tick_array_lower,
            tick_array_upper,
            whirlpool_program,
        ],
        signer_seeds,
    ).map_err(|_e| error!(ErrorCode::CpiError))?;

    Ok(())
}

/// CPI to collect_fees on Whirlpool
pub fn cpi_collect_fees<'info>(
    whirlpool_program: AccountInfo<'info>,
    whirlpool: AccountInfo<'info>,
    position_authority: AccountInfo<'info>,
    position: AccountInfo<'info>,
    position_token_account: AccountInfo<'info>,
    token_owner_account_a: AccountInfo<'info>,
    token_vault_a: AccountInfo<'info>,
    token_owner_account_b: AccountInfo<'info>,
    token_vault_b: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(8);
    data.extend_from_slice(&discriminators::COLLECT_FEES);

    let accounts = vec![
        AccountMeta::new_readonly(*whirlpool.key, false),
        AccountMeta::new_readonly(*position_authority.key, true),
        AccountMeta::new(*position.key, false),
        AccountMeta::new_readonly(*position_token_account.key, false),
        AccountMeta::new(*token_owner_account_a.key, false),
        AccountMeta::new(*token_vault_a.key, false),
        AccountMeta::new(*token_owner_account_b.key, false),
        AccountMeta::new(*token_vault_b.key, false),
        AccountMeta::new_readonly(*token_program.key, false),
    ];

    let ix = Instruction {
        program_id: WHIRLPOOL_PROGRAM_ID,
        accounts,
        data,
    };

    invoke_signed(
        &ix,
        &[
            whirlpool,
            position_authority,
            position,
            position_token_account,
            token_owner_account_a,
            token_vault_a,
            token_owner_account_b,
            token_vault_b,
            token_program,
            whirlpool_program,
        ],
        signer_seeds,
    ).map_err(|_e| error!(ErrorCode::CpiError))?;

    Ok(())
}

/// CPI to collect_reward on Whirlpool
pub fn cpi_collect_reward<'info>(
    whirlpool_program: AccountInfo<'info>,
    whirlpool: AccountInfo<'info>,
    position_authority: AccountInfo<'info>,
    position: AccountInfo<'info>,
    position_token_account: AccountInfo<'info>,
    reward_owner_account: AccountInfo<'info>,
    reward_vault: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    reward_index: u8,
) -> Result<()> {
    let mut data = Vec::with_capacity(8 + 1);
    data.extend_from_slice(&discriminators::COLLECT_REWARD);
    data.push(reward_index);

    let accounts = vec![
        AccountMeta::new_readonly(*whirlpool.key, false),
        AccountMeta::new_readonly(*position_authority.key, true),
        AccountMeta::new(*position.key, false),
        AccountMeta::new_readonly(*position_token_account.key, false),
        AccountMeta::new(*reward_owner_account.key, false),
        AccountMeta::new(*reward_vault.key, false),
        AccountMeta::new_readonly(*token_program.key, false),
    ];

    let ix = Instruction {
        program_id: WHIRLPOOL_PROGRAM_ID,
        accounts,
        data,
    };

    invoke_signed(
        &ix,
        &[
            whirlpool,
            position_authority,
            position,
            position_token_account,
            reward_owner_account,
            reward_vault,
            token_program,
            whirlpool_program,
        ],
        signer_seeds,
    ).map_err(|_e| error!(ErrorCode::CpiError))?;

    Ok(())
}

/// CPI to close_position on Whirlpool
pub fn cpi_close_position<'info>(
    whirlpool_program: AccountInfo<'info>,
    position_authority: AccountInfo<'info>,
    receiver: AccountInfo<'info>,
    position: AccountInfo<'info>,
    position_mint: AccountInfo<'info>,
    position_token_account: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(8);
    data.extend_from_slice(&discriminators::CLOSE_POSITION);

    let accounts = vec![
        AccountMeta::new_readonly(*position_authority.key, true),
        AccountMeta::new(*receiver.key, false),
        AccountMeta::new(*position.key, false),
        AccountMeta::new(*position_mint.key, false),
        AccountMeta::new(*position_token_account.key, false),
        AccountMeta::new_readonly(*token_program.key, false),
    ];

    let ix = Instruction {
        program_id: WHIRLPOOL_PROGRAM_ID,
        accounts,
        data,
    };

    invoke_signed(
        &ix,
        &[
            position_authority,
            receiver,
            position,
            position_mint,
            position_token_account,
            token_program,
            whirlpool_program,
        ],
        signer_seeds,
    ).map_err(|_e| error!(ErrorCode::CpiError))?;

    Ok(())
}

/// Error codes for CPI operations
#[error_code]
pub enum ErrorCode {
    #[msg("CPI call to Whirlpool program failed")]
    CpiError,
}
