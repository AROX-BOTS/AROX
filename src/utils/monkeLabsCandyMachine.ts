import * as anchor from '@project-serum/anchor';

import { MintLayout, AccountLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
    Account,
    Keypair,
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    TransactionInstruction,
    Transaction,
    sendAndConfirmRawTransaction
} from '@solana/web3.js';

import {
    CIVIC,
    getAtaForMint,
    getNetworkExpire,
    getNetworkToken,
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
} from './fairLaunchUtils';
import {log} from "./modules/sharedTaskFunctions";

export const CANDY_MACHINE_PROGRAM = new anchor.web3.PublicKey(
    'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ',
);

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export interface MINT_CONFIG{
    "pda_buf": number;
    "price": number,
    "index_cap": number,
    "index_key": string,
    "wl_key":string,
    "primary_wallet": string,
    "config_key": string
}

interface CandyMachineState {
    itemsAvailable: number;
    itemsRedeemed: number;
    itemsRemaining: number;
    treasury: anchor.web3.PublicKey;
    tokenMint: anchor.web3.PublicKey;
    isSoldOut: boolean;
    isActive: boolean;
    isPresale: boolean;
    goLiveDate: anchor.BN;
    price: anchor.BN;
    gatekeeper: null | {
        expireOnUse: boolean;
        gatekeeperNetwork: anchor.web3.PublicKey;
    };
    endSettings: null | [number, anchor.BN];
    whitelistMintSettings: null | {
        mode: any;
        mint: anchor.web3.PublicKey;
        presale: boolean;
        discountPrice: null | anchor.BN;
    };
    hiddenSettings: null | {
        name: string;
        uri: string;
        hash: Uint8Array;
    };
}

export interface CandyMachineAccount {
    id: anchor.web3.PublicKey;
    program: anchor.Program;
    state: CandyMachineState;
}
export const getCandyMachineState = async (anchorWallet: anchor.Wallet, candyMachineId: anchor.web3.PublicKey, connection: anchor.web3.Connection, indexKey: string, indexCap: number): Promise<CandyMachineAccount> => {
    const provider = new anchor.Provider(connection, anchorWallet, {
        preflightCommitment: 'recent',
    });

    const idl = await anchor.Program.fetchIdl(CANDY_MACHINE_PROGRAM, provider);
    // @ts-ignore
    const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM, provider);

    const  getItemsMinted = async function () {
            const index = new PublicKey(indexKey),
            account = await connection.getAccountInfo(index);
        if (account === null) {
            return 0
        }
        return (account.data[1] << 8) + account.data[0];
    }

    const state: any = await program.account.candyMachine.fetch(candyMachineId);
    const itemsAvailable = indexCap;
    const itemsRedeemed = await getItemsMinted();//state.itemsRedeemed.toNumber();
    const itemsRemaining = itemsAvailable - itemsRedeemed;

    const presale =
        state.data.whitelistMintSettings &&
        state.data.whitelistMintSettings.presale &&
        (!state.data.goLiveDate ||
            state.data.goLiveDate.toNumber() > new Date().getTime() / 1000);

    return {
        id: candyMachineId,
        program,
        state: {
            itemsAvailable,
            itemsRedeemed,
            itemsRemaining,
            isSoldOut: itemsRemaining === 0,
            isActive:
                (presale ||
                    state.data.goLiveDate.toNumber() < new Date().getTime() / 1000) &&
                (state.endSettings
                    ? state.endSettings.endSettingType.date
                        ? state.endSettings.number.toNumber() > new Date().getTime() / 1000
                        : itemsRedeemed < state.endSettings.number.toNumber()
                    : true),
            isPresale: presale,
            goLiveDate: state.data.goLiveDate,
            treasury: state.wallet,
            tokenMint: state.tokenMint,
            gatekeeper: state.data.gatekeeper,
            endSettings: state.data.endSettings,
            whitelistMintSettings: state.data.whitelistMintSettings,
            hiddenSettings: state.data.hiddenSettings,
            price: state.data.price,
        },
    };
};

const getMasterEdition = async (mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
                Buffer.from('edition'),
            ],
            TOKEN_METADATA_PROGRAM_ID,
        )
    )[0];
};

const getMetadata = async (mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID,
        )
    )[0];
};

export const getCandyMachineCreator = async (candyMachine: anchor.web3.PublicKey): Promise<[anchor.web3.PublicKey, number]> => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('candy_machine'), candyMachine.toBuffer()],
        CANDY_MACHINE_PROGRAM,
    );
};

const programId = "miniYQHyKbyrPBftpouZJVo4S1SkoYJoKngtfiJB9yq"
const our_wallet = new PublicKey("mnKzuL9RMtR6GeSHBfDpnQaefcMsiw7waoTSduKNiXM");

export const mintOneToken = async (wallet: any, connection: any, taskId: number, pdaBuf: number, whitelistKey: string, indexKey: string, configKey: string, primaryWallet: string) => {
       let meta_program = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
        minter_program = new PublicKey(programId),
        associated_program = new PublicKey(
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        ),
        mint_kp = Keypair.generate(),
        token_key = (
            await PublicKey.findProgramAddress(
                [
                    wallet.publicKey.toBuffer(),
                    TOKEN_PROGRAM_ID.toBuffer(),
                    mint_kp.publicKey.toBuffer(),
                ],
                associated_program
            )
        )[0],
        meta_key = (
            await PublicKey.findProgramAddress(
                [
                    new Uint8Array([109, 101, 116, 97, 100, 97, 116, 97]),
                    meta_program.toBuffer(),
                    mint_kp.publicKey.toBuffer(),
                ],
                meta_program
            )
        )[0],
        auth_key = (
            await PublicKey.findProgramAddress(
                [
                    new Uint8Array([
                        pdaBuf,
                        (pdaBuf & 0xff00) >> 8,
                    ]),
                    new Uint8Array([97, 117, 116, 104]),
                    minter_program.toBuffer(),
                ],
                minter_program
            )
        )[0],
        sys_key = new PublicKey('11111111111111111111111111111111'),
        rent_key = new PublicKey('SysvarRent111111111111111111111111111111111'),
        uniqPDA = (
            await PublicKey.findProgramAddress(
                [
                    new Uint8Array([
                        pdaBuf,
                        (pdaBuf & 0xff00) >> 8,
                    ]),
                    wallet.publicKey.toBuffer(),
                    minter_program.toBuffer(),
                ],
                minter_program
            )
        )[0],
        timePDA = (
            await PublicKey.findProgramAddress(
                [
                    new Uint8Array([108, 116, 105, 109, 101]),
                    wallet.publicKey.toBuffer(),
                    minter_program.toBuffer(),
                ],
                minter_program
            )
        )[0],
        edition_key = (
            await PublicKey.findProgramAddress(
                [
                    new Uint8Array([109, 101, 116, 97, 100, 97, 116, 97]),
                    meta_program.toBuffer(),
                    mint_kp.publicKey.toBuffer(),
                    new Uint8Array([101, 100, 105, 116, 105, 111, 110]),
                ],
                meta_program
            )
        )[0],
        their_wallet = new PublicKey(primaryWallet),
        ix_key = new PublicKey(indexKey),
        wl_key = new PublicKey(whitelistKey),
        config_key = new PublicKey(configKey),
        other_key = new PublicKey('7FHzVCP9eX6zmZjw3qwvmdDMhSvCkLxipQatAqhtbVBf');

    // accounts
    let account_0 = { pubkey: ix_key, isSigner: false, isWritable: true },
        account_1 = { pubkey: their_wallet, isSigner: false, isWritable: true },
        account_2 = { pubkey: our_wallet, isSigner: false, isWritable: true },
        account_3 = { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        account_4 = { pubkey: wl_key, isSigner: false, isWritable: true },
        account_5 = { pubkey: token_key, isSigner: false, isWritable: true },
        account_6 = { pubkey: sys_key, isSigner: false, isWritable: false },
        account_7 = { pubkey: meta_key, isSigner: false, isWritable: true },
        account_8 = {
            pubkey: mint_kp.publicKey,
            isSigner: false,
            isWritable: true,
        },
        account_9 = { pubkey: meta_program, isSigner: false, isWritable: false },
        account_10 = { pubkey: rent_key, isSigner: false, isWritable: false },
        account_11 = { pubkey: auth_key, isSigner: false, isWritable: true },
        account_12 = {
            pubkey: TOKEN_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
        },
        account_13 = { pubkey: uniqPDA, isSigner: false, isWritable: true },
        account_14 = { pubkey: timePDA, isSigner: false, isWritable: true },
        account_15 = { pubkey: edition_key, isSigner: false, isWritable: true },
        account_16 = { pubkey: config_key, isSigner: false, isWritable: true },
        account_17 = {
            pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'),
            isSigner: false,
            isWritable: false,
        },
        account_18 = { pubkey: other_key, isSigner: false, isWritable: false };

    let mintRent = await connection.getMinimumBalanceForRentExemption(
            MintLayout.span
        ),
        tokenRent = await connection.getMinimumBalanceForRentExemption(
            AccountLayout.span
        );

    let mintAccount = SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: mint_kp.publicKey,
            lamports: mintRent,
            space: MintLayout.span,
            programId: TOKEN_PROGRAM_ID,
        }),
        tokenAccount = Token.createAssociatedTokenAccountInstruction(
            associated_program,
            TOKEN_PROGRAM_ID,
            mint_kp.publicKey,
            token_key,
            wallet.publicKey,
            wallet.publicKey
        ),
        create_token = Token.createInitMintInstruction(
            TOKEN_PROGRAM_ID,
            mint_kp.publicKey,
            0,
            wallet.publicKey,
            null
        ),
        mint_into_token_account = Token.createMintToInstruction(
            TOKEN_PROGRAM_ID,
            mint_kp.publicKey,
            token_key,
            wallet.publicKey,
            [],
            1
        ),
        instruction = new TransactionInstruction({
            keys: [
                account_0,
                account_1,
                account_2,
                account_3,
                account_4,
                account_5,
                account_6,
                account_7,
                account_8,
                account_9,
                account_10,
                account_11,
                account_12,
                account_13,
                account_14,
                account_15,
                account_16,
                account_17,
                account_18,
            ],
            programId: minter_program,
            data: Buffer.from(new Uint8Array([9])),
        }),
        create_time = new TransactionInstruction({
            keys: [account_3, account_14, account_6],
            programId: minter_program,
            data: Buffer.from(new Uint8Array([14])),
        });

    let transaction = new Transaction().add(
        mintAccount,
        create_token,
        tokenAccount,
        mint_into_token_account,
        create_time,
        instruction
    );

    let bh = (await connection.getRecentBlockhash()).blockhash;

    transaction.recentBlockhash = bh;
    transaction.feePayer = wallet.publicKey;
    transaction.sign(mint_kp);

    let sig = null;

    try {
        let signedTransaction = await wallet.signTransaction(transaction),
            sig = await sendAndConfirmRawTransaction(
                connection,
                signedTransaction.serialize(),
                { commitment: 'confirmed' }
            );

        let conf = await connection.getConfirmedTransaction(sig, 'confirmed');
        let timed_out = conf!.meta!.logMessages!.join('').indexOf('timeout') > -1;

        if (timed_out) {
            console.log("timeout");
        } else {
            console.log("success");
            return sig;
        }
    } catch (e: any) {
        let error = 'Unknown error occurred.';

        if (e.logs !== undefined) {
            error = e.logs[e.logs.length - 3].split(' ').splice(2).join(' ');
            if (error.indexOf('0x1') > -1) {
                console.log(error);
                error = 'Not enough Solana.';
            }
        }
    } finally {
    }
};

export const shortenAddress = (address: string, chars = 4): string => {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
