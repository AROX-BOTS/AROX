import * as anchor from '@project-serum/anchor';
import { MintLayout, TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import {sleep} from "./candy-machine";
import {TransactionInstruction} from "@solana/web3.js";
import bs58 from "bs58";
export const ME_CANDY_MACHINE_PROGRAM = new anchor.web3.PublicKey("CMZYPASGWeTz7RNGHaRJfCq2XQ5pYK6nDvVQxzkH51zb");
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new anchor.web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
    TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export interface MeCandyMachine {
    id: anchor.web3.PublicKey,
    connection: anchor.web3.Connection;
    program: anchor.Program;
}

interface MeCandyMachineState {
    candyMachine: MeCandyMachine;
    itemsAvailable: number;
    itemsRedeemed: number;
    itemsRedeemedRaffle: number;
    itemsRemaining: number;
    wallet: anchor.web3.PublicKey;
    config: anchor.web3.PublicKey;
    notary: anchor.web3.PublicKey;
    bump: number;

}

interface WalletLimitData {
    walletLimitPubkey: anchor.web3.PublicKey;
    walletLimitNumber: number;
}
export const awaitTransactionSignatureConfirmation = async (
    txid: anchor.web3.TransactionSignature,
    timeout: number,
    connection: anchor.web3.Connection,
    commitment: anchor.web3.Commitment = "recent",
    queryStatus = false
): Promise<anchor.web3.SignatureStatus | null | void> => {
    let done = false;
    let status: anchor.web3.SignatureStatus | null | void = {
        slot: 0,
        confirmations: 0,
        err: null,
    };
    let subId = 0;
    status = await new Promise(async (resolve, reject) => {
        setTimeout(() => {
            if (done) {
                return;
            }
            done = true;
            //    console.log("Rejecting for timeout...");
            reject({ timeout: true });
        }, timeout);
        try {
            subId = connection.onSignature(
                txid,
                (result: any, context: any) => {
                    done = true;
                    status = {
                        err: result.err,
                        slot: context.slot,
                        confirmations: 0,
                    };
                    if (result.err) {
                        // console.log("Rejected via websocket", result.err);
                        reject(status);
                    } else {
                        //  console.log("Resolved via websocket", result);
                        resolve(status);
                    }
                },
                commitment
            );
        } catch (e) {
            done = true;
            //     console.error("WS error in setup", txid, e);
        }
        while (!done && queryStatus) {
            // eslint-disable-next-line no-loop-func
            (async () => {
                try {
                    const signatureStatuses = await connection.getSignatureStatuses([
                        txid,
                    ]);
                    status = signatureStatuses && signatureStatuses.value[0];
                    if (!done) {
                        if (!status) {
                            //   console.log("REST null result for", txid, status);
                        } else if (status.err) {
                            //    console.log("REST error for", txid, status);
                            done = true;
                            reject(status.err);
                        } else if (!status.confirmations) {
                            //    console.log("REST no confirmations for", txid, status);
                        } else {
                            //    console.log("REST confirmation for", txid, status);
                            done = true;
                            resolve(status);
                        }
                    }
                } catch (e) {
                    if (!done) {
                        //   console.log("REST connection error: txid", txid, e);
                    }
                }
            })();
            await sleep(2000);
        }
    });

    //@ts-ignore
    if (connection._signatureSubscriptions[subId]) {
        connection.removeSignatureListener(subId);
    }
    done = true;
//console.log("Returning status", status);
    return status;
}


export const getLaunchpadCandyMachineState = async (
    anchorWallet: anchor.Wallet,
    candyMachineId: anchor.web3.PublicKey,
    connection: anchor.web3.Connection,
): Promise<MeCandyMachineState> => {
    const provider = new anchor.Provider(connection, anchorWallet, {
        preflightCommitment: "recent",
    });

    const idl = await anchor.Program.fetchIdl(
        ME_CANDY_MACHINE_PROGRAM,
        provider
    );

    // @ts-ignore
    const program = new anchor.Program(idl, ME_CANDY_MACHINE_PROGRAM, provider);
    const candyMachine = {
        id: candyMachineId,
        connection,
        program,
    }

    const state: any = await program.account.candyMachine.fetch(candyMachineId);

  //  const price = state.data.price.toNumber() / 1000000000;
    const itemsAvailable = state.itemsAvailable.toNumber();
    const itemsRedeemed = state.itemsRedeemedNormal.toNumber();
    const itemsRedeemedRaffle = state.itemsRedeemedRaffle.toNumber();
    const itemsRemaining = itemsAvailable - itemsRedeemed;

  //  let goLiveDate = state.data.goLiveDate.toNumber();
  //  goLiveDate = new Date(goLiveDate * 1000);
    const wallet = state.wallet;
    const config = state.config;
    const notary = state.notary;
    const bump = state.bump;

    return {
        candyMachine,
        itemsAvailable,
        itemsRedeemed,
        itemsRedeemedRaffle,
        itemsRemaining,
        wallet,
        config,
        notary,
        bump
    };
}

export const getWalletLimit = async(
    candyMachineId: anchor.web3.PublicKey,
    mintingWalletPubkey = anchor.web3.PublicKey
): Promise<WalletLimitData> => {
    // @ts-ignore
    return await anchor.web3.PublicKey.findProgramAddress([Buffer.from("wallet_limit"), candyMachineId.toBuffer(), mintingWalletPubkey.toBuffer()], ME_CANDY_MACHINE_PROGRAM);
}

export const getRaffleTicketInfo = async (
    candyMachineId: anchor.web3.PublicKey,
    mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("raffle_ticket"),
                candyMachineId.toBuffer(),
                mint.toBuffer(),
            ],
            ME_CANDY_MACHINE_PROGRAM
        )
    )[0];
};

export const getRaffleEscrowInfo = async (
    candyMachineId: anchor.web3.PublicKey,
    mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("raffle_ticket"),
                candyMachineId.toBuffer(),
                mint.toBuffer(),
                Buffer.from("escrow"),
            ],
            ME_CANDY_MACHINE_PROGRAM
        )
    )[0];
};

export const getLaunchStagesInfo = async (
    candyMachineId: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("candy_machine"),
                Buffer.from("launch_stages"),
                candyMachineId.toBuffer()
            ],
            ME_CANDY_MACHINE_PROGRAM
        )
    )[0];
};

export const getTokenWallet = async (
    wallet: anchor.web3.PublicKey,
    mint: anchor.web3.PublicKey
) => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
        )
    )[0];
};

export const getMetadata = async (
    mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        )
    )[0];
};

export const getMasterEdition = async (
    mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
                Buffer.from("edition"),
            ],
            TOKEN_METADATA_PROGRAM_ID
        )
    )[0];
};

/* export */ const createAssociatedTokenAccountInstruction = (
    associatedTokenAddress: anchor.web3.PublicKey,
    payer: anchor.web3.PublicKey,
    walletAddress: anchor.web3.PublicKey,
    splTokenMintAddress: anchor.web3.PublicKey
) => {
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
        { pubkey: walletAddress, isSigner: false, isWritable: false },
        { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
        {
            pubkey: anchor.web3.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
            pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];
    return new anchor.web3.TransactionInstruction({
        keys,
        programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        data: Buffer.from([]),
    });
};


export const mintOneToken = async (candyMachine: any, payerUserWallet: any, mintAccount: any, tokenWallet: any, connection: any, program: any, wallet: any, config: any, metadata: any, masterEdition: any, rentExemption: any, notary: any, walletLimitPubkey: any, walletLimitOne: any, raffleTicketInfo: any, raffleTicketEscrow: any, launchStagesInfo: any) => {
    const accounts = {
        config: config,
        candyMachine: candyMachine.id,
        launchStagesInfo: launchStagesInfo,
        payer: payerUserWallet,
        wallet: wallet,
        //raffleTicket: raffleTicketInfo,
        //raffleEscrow: raffleTicketEscrow,
        mint: mintAccount.publicKey,
        metadata: metadata,
        masterEdition: masterEdition,
        walletLimitInfo: walletLimitPubkey,
        mintAuthority: payerUserWallet,
        updateAuthority: payerUserWallet,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY
    };

    const defaultPubKey = {
        pubkey: new anchor.web3.PublicKey("11111111111111111111111111111111"),
        isWritable: !0,
        isSigner: !1
    };
    const userKey = {
        pubkey: payerUserWallet,
        isWritable: !1,
        isSigner: !1
    };

    const notaryKey = {
        pubkey: notary || anchor.web3.SystemProgram.programId,
        isWritable: !1,
        isSigner: !0
    };
    const memo = new TransactionInstruction({
        programId: new anchor.web3.PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        keys: [],
        data: Buffer.from(bs58.encode(Buffer.from("we live to fight another day")))
    });

    try{
        const transaction = program.transaction.mintNft(walletLimitOne, {
            'accounts': accounts,
            'signers': [mintAccount],
            'remainingAccounts': [defaultPubKey, userKey, notaryKey],
            'instructions': [anchor.web3.SystemProgram.createAccount({
                'fromPubkey': payerUserWallet,
                'newAccountPubkey': mintAccount.publicKey,
                'space': MintLayout.span,
                'lamports': await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span,),
                'programId': TOKEN_PROGRAM_ID
            }),memo,
                Token.createInitMintInstruction(
                    TOKEN_PROGRAM_ID,
                    mintAccount.publicKey,
                    0,
                    payerUserWallet,
                    payerUserWallet
                ),
                createAssociatedTokenAccountInstruction(
                    tokenWallet,
                    payerUserWallet,
                    payerUserWallet,
                    mintAccount.publicKey
                ),
                Token.createMintToInstruction(
                    TOKEN_PROGRAM_ID,
                    mintAccount.publicKey,
                    tokenWallet,
                    payerUserWallet,
                    [],
                    1
                )]
        });
        transaction.feePayer = payerUserWallet
        return transaction;
    } catch(e){
        console.log(e);
    }
};
