import * as anchor from "@project-serum/anchor";
import * as web3 from '@solana/web3.js';
import {log, sleep} from './sharedTaskFunctions';
import {QueueWebhook} from "../webhookHandler";
import {QueueMintStatusLog} from "../mintStatusLogger";
import bs58 from 'bs58';
import axios from 'axios';
import {MintLayout} from '@solana/spl-token';
import {
    getLaunchpadCandyMachineState,
    getTokenWallet,
    getWalletLimit,
    mintOneToken,
    awaitTransactionSignatureConfirmation,
    getMasterEdition,
    getMetadata,
    getRaffleTicketInfo, getRaffleEscrowInfo, getLaunchStagesInfo
} from "../magicEdenCandyMachine";

export const MagicEdenLaunchpadHandler = async(taskId: number, wallet: anchor.Wallet, rpcHost: string | undefined, candyMachineId: string | undefined, customStart: string | undefined): Promise<void> => {
    if(wallet == undefined){
        log({taskId: taskId, message: "Wallet is undefined", type: "error"});
        return;
    }

    // @ts-ignore
    const candyMachinePublicId = new anchor.web3.PublicKey(candyMachineId.toString());
    // const startDateSeed = parseInt(<string>candyMachineStartDate, 10);
    const rpcNetworkHost = rpcHost;
    if(rpcNetworkHost == null){
        log({taskId: taskId, message: "Another RPC hasn't been specified, using AROX RPC", type: "info"});
    }

    if(rpcHost == ""){
        rpcHost = undefined;
    }
    let connection;
    if(rpcHost != undefined){
        connection = new anchor.web3.Connection(rpcHost);
    } else {
        const web3Config: anchor.web3.ConnectionConfig = {
            httpHeaders: {origin: "https://aroxbots.com", referer: "https://aroxbots.com"}
        };
        connection = new anchor.web3.Connection("https://dry-falling-water.solana-mainnet.quiknode.pro/", web3Config); //https://ssc-dao.genesysgo.net/
       // connection = new anchor.web3.Connection("https://ssc-dao.genesysgo.net/", web3Config);
    }
    const txTimeout = 30000; // milliseconds (confirm this works for your project)'

    try{
        const state =  await getLaunchpadCandyMachineState(
            wallet,
            candyMachinePublicId,
            connection
        );
    } catch(e){
        console.log(e);
    }
    const state =  await getLaunchpadCandyMachineState(
        wallet,
        candyMachinePublicId,
        connection
    );
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    log({taskId: taskId, message: "Items remaining in machine: " + state.itemsRemaining + ", total redeemed: " + state.itemsRedeemed + ", total available: " + state.itemsAvailable, type: "info"});
/*
    if(state.itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    } */

    const mintKeys = anchor.web3.Keypair.generate();
    const metadata = await getMetadata(mintKeys.publicKey);
    const masterEdition = await getMasterEdition(mintKeys.publicKey);
    // @ts-ignore
    const walletLimit = await getWalletLimit(state.candyMachine.id, wallet.publicKey);
    const rentExemption = await connection.getMinimumBalanceForRentExemption(MintLayout.span);
    // @ts-ignore
    const walletLimitArrayZero = walletLimit[0];
    // @ts-ignore
    const walletLimitArrayOne = walletLimit[1];
    const tokenWallet = await getTokenWallet(wallet.publicKey, mintKeys.publicKey);
    const raffleTicketInfo = await getRaffleTicketInfo(state.candyMachine.id, mintKeys.publicKey);
    const raffleEscrowInformation = await getRaffleEscrowInfo(state.candyMachine.id, mintKeys.publicKey);
    const launchStagesInfo = await getLaunchStagesInfo(state.candyMachine.id);

    let mintToken;
    try{
        mintToken = await mintOneToken(state.candyMachine, wallet.publicKey, mintKeys, tokenWallet, connection, state.candyMachine.program, state.wallet, state.config, metadata, masterEdition, rentExemption, state.notary, walletLimitArrayZero, walletLimitArrayOne, raffleTicketInfo, raffleEscrowInformation, launchStagesInfo, state.orderInfo);
    } catch(e){
        console.log(e);
    }
    // @ts-ignore
    if(customStart == "") customStart = undefined;

    let currentDate = new Date();
    if(customStart != undefined){
        // @ts-ignore
        while(currentDate.getTime() <= customStart){
            // @ts-ignore
            let now = customStart - Date.now();
            if(0>now){
                break;
            }
            log({taskId: taskId, message: "Custom start parameter set, sleeping "+now+"ms and then running", type: "info"});
            await sleep(now);
        }
    } else{
        log({taskId: taskId, message: "No start time set. Launching.", type: "info"});
    }

    const blockHash = await connection.getRecentBlockhash("finalized");
    mintToken.recentBlockhash = blockHash.blockhash;

    let message;
    try{
        message = bs58.encode(mintToken.serializeMessage());
    } catch(e){
        console.log(e);
    }

    let signMint;
    log({taskId: taskId, message: "Getting signature from ME Servers...", type: "info"});
    while(signMint == undefined){
        try{
            signMint = await axios.post("http://185.38.142.173/api/magiceden/sign", {"response": "", "message": message}, {headers:{"User-Agent": "Magic-Eden", "Referer":"https://magiceden.io/","Origin":"https://magiceden.io"}});
        } catch(e){
            console.log(e)
        }
    }
    if(signMint.data.publicKey != state.notary.toBase58() || signMint.data.error){
        if(signMint.data.error){console.log(signMint.data)}
        while(signMint.data.publicKey != state.notary.toBase58()){
            log({taskId: taskId, message: "Error getting correct signature from ME, retrying", type: "error"});
            try{
                signMint = await axios.post("http://185.38.142.173/api/magiceden/sign", {"response": "", "message": message}, {headers:{"User-Agent": "Magic-Eden", "Referer":"https://magiceden.io/","Origin":"https://magiceden.io"}});
            } catch(e){
                console.log(e)
            }
        }
    }
    const signMintSignature = signMint.data.signature; //data.publickey skal være = state.notary pubkey.
    await wallet.signTransaction(mintToken)
    mintToken.partialSign(mintKeys);
    const buffer = bs58.decode(signMintSignature);
    mintToken.addSignature(state.notary, buffer);

    log({taskId: taskId, message: "Sending transaction...", type: "info"});
    try{
        const tx = await web3.sendAndConfirmRawTransaction(connection, mintToken.serialize({verifySignatures: false, preflightCommitment: "processed", skipPreflight: true}));
        log({taskId: taskId, message: "Success TX: " +  tx, type: "success"});
        if(rpcHost != undefined){
            await QueueWebhook(tx, "Magic Eden Launchpad", "CUSTOM");
        } else{
            await QueueWebhook(tx, "Magic Eden Launchpad", "AROX");
        }
    } catch(e){
        console.log(e);
    }
    console.log();
}
