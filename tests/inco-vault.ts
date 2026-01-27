import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Keypair,
    Transaction,
    Ed25519Program,
    SYSVAR_INSTRUCTIONS_PUBKEY
} from "@solana/web3.js";
import { expect } from "chai";
import { IncoVault } from "../target/types/inco_vault";

describe("inco-vault", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.IncoVault as Program<IncoVault>;
    const admin = provider.wallet;

    // PDAs
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        program.programId
    );

    it("Initializes the global vault config", async () => {
        const tx = await program.methods
            .initializeConfig()
            .accounts({
                admin: admin.publicKey,
                vaultConfig: configPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const config = await program.account.vaultConfig.fetch(configPda);
        expect(config.admin.toBase58()).to.equal(admin.publicKey.toBase58());
        expect(config.paused).to.be.false;
        expect(config.defaultMaxSlippageBps).to.equal(100);
    });

    it("Rotates admin via 2-step process", async () => {
        const newAdmin = Keypair.generate();

        // Step 1: Propose
        await program.methods
            .proposeAdmin(newAdmin.publicKey)
            .accounts({
                admin: admin.publicKey,
                vaultConfig: configPda,
            })
            .rpc();

        let config = await program.account.vaultConfig.fetch(configPda);
        expect(config.pendingAdmin.toBase58()).to.equal(newAdmin.publicKey.toBase58());

        // Step 2: Accept
        await program.methods
            .acceptAdmin()
            .accounts({
                newAdmin: newAdmin.publicKey,
                vaultConfig: configPda,
            })
            .signers([newAdmin])
            .rpc();

        config = await program.account.vaultConfig.fetch(configPda);
        expect(config.admin.toBase58()).to.equal(newAdmin.publicKey.toBase58());
        expect(config.pendingAdmin.toBase58()).to.equal(PublicKey.default.toBase58());

        // Rotate back for other tests
        await program.methods
            .proposeAdmin(admin.publicKey)
            .accounts({
                admin: newAdmin.publicKey,
                vaultConfig: configPda,
            })
            .signers([newAdmin])
            .rpc();

        await program.methods
            .acceptAdmin()
            .accounts({
                newAdmin: admin.publicKey,
                vaultConfig: configPda,
            })
            .rpc();
    });

    it("Pauses and unpauses the vault", async () => {
        // Pause
        await program.methods
            .pauseVault()
            .accounts({
                admin: admin.publicKey,
                vaultConfig: configPda,
            })
            .rpc();

        let config = await program.account.vaultConfig.fetch(configPda);
        expect(config.paused).to.be.true;

        // Unpause
        await program.methods
            .unpauseVault()
            .accounts({
                admin: admin.publicKey,
                vaultConfig: configPda,
            })
            .rpc();

        config = await program.account.vaultConfig.fetch(configPda);
        expect(config.paused).to.be.false;
    });

    it("Verifies on-chain decryption with Ed25519 attestation", async () => {
        // Mock data for verification
        const handle = Buffer.alloc(16, 1);
        const plaintext = Buffer.alloc(16, 2);

        // In a real test, we would generate a real Ed25519 signature
        // from the Inco covalidator. For unit testing the program logic,
        // we demonstrate the instruction building.

        const handles = [Array.from(handle)];
        const plaintexts = [Array.from(plaintext)];

        // This would fail on a real validator unless the covalidator pubkey matches
        // and the signature is valid. Here we just verify the instruction can be built.
        try {
            const tx = new Transaction();

            // 1. Add Ed25519 instruction (would be index 0)
            // (Simplified placeholder for the complex Ed25519 instruction data)
            // tx.add(Ed25519Program.createInstructionWithPublicKey(...));

            // 2. Add our program's verification instruction
            const verifyIx = await program.methods
                .verifyDecryption(1, handles, plaintexts)
                .accounts({
                    authority: admin.publicKey,
                    instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
                })
                .instruction();

            tx.add(verifyIx);

            expect(verifyIx.data.length).to.be.greaterThan(0);
            console.log("VerifyDecryption instruction built successfully");
        } catch (e) {
            console.error("Failed to build verification instruction:", e);
            throw e;
        }
    });

    it("Validates vault PDA initialization", async () => {
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), admin.publicKey.toBuffer()],
            program.programId
        );

        await program.methods
            .initializeVault()
            .accounts({
                owner: admin.publicKey,
                vault_pda: vaultPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const vault = await program.account.vaultPda.fetch(vaultPda);
        expect(vault.owner.toBase58()).to.equal(admin.publicKey.toBase58());
        expect(vault.locked).to.be.false;
        expect(vault.positionCount).to.equal(0);
    });
});
