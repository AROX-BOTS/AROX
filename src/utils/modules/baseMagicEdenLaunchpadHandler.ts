import * as anchor from "@project-serum/anchor";
import * as web3 from '@solana/web3.js';
import {log, sleep} from './sharedTaskFunctions';
import {QueueWebhook} from "../webhookHandler";
import {QueueMintStatusLog} from "../mintStatusLogger";
import bs58 from 'bs58';
import axios from 'axios';
import {MintLayout} from '@solana/spl-token';
import {getLaunchpadCandyMachineState, getTokenWallet, getWalletLimit, mintOneToken, awaitTransactionSignatureConfirmation, getMasterEdition, getMetadata} from "../magicEdenCandyMachine";

export const MagicEdenLaunchpadHandler = async(taskId: number, wallet: anchor.Wallet, rpcHost: string | undefined, candyMachineId: string | undefined): Promise<void> => {
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
        connection = new anchor.web3.Connection("https://dry-falling-water.solana-mainnet.quiknode.pro/059cac57150dbd31b529745ae4333bc0414aa7bc/", web3Config); //https://ssc-dao.genesysgo.net/
       // connection = new anchor.web3.Connection("https://ssc-dao.genesysgo.net/", web3Config);
    }
    const txTimeout = 30000; // milliseconds (confirm this works for your project)'

    const state =  await getLaunchpadCandyMachineState(
        wallet,
        candyMachinePublicId,
        connection
    );
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    log({taskId: taskId, message: "Items remaining in machine: " + state.itemsRemaining + ", Live at: " + state.goLiveDate + ", total redeemed: " + state.itemsRedeemed + ", total available: " + state.itemsAvailable + " price: " + state.price+"SOL", type: "info"});

    if(state.itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    }

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

    const mintToken = await mintOneToken(state.candyMachine, wallet.publicKey, mintKeys, tokenWallet, connection, state.candyMachine.program, state.wallet, state.config, metadata, masterEdition, rentExemption, state.notary, walletLimitArrayZero, walletLimitArrayOne);

    let currentDate = new Date();
    while(currentDate <= state.goLiveDate){
        // @ts-ignore
        let now = state.goLiveDate - Date.now();
        log({taskId: taskId, message: "Sale not live, sleeping "+now+"ms and checking again", type: "info"});
        await sleep(now);
    }

    const blockHash = await connection.getRecentBlockhash("finalized");
    mintToken.recentBlockhash = blockHash.blockhash;

    let message;
    try{
        message = bs58.encode(mintToken.serializeMessage());
    } catch(e){
        console.log(e);
    }

    const signMint = await axios.post("http://127.0.0.1:5000/", {"response": "2EE2Hhoe8fVAYn7J5qwuayNmrEgmTPskLyszojv", "message": message});

    const signMintSignature = signMint.data.signature; //data.publickey skal være = state.notary pubkey.
    await wallet.signTransaction(mintToken)
    mintToken.partialSign(mintKeys);
    const buffer = bs58.decode(signMintSignature);
    mintToken.addSignature(state.notary, buffer);

    log({taskId: taskId, message: "Sale live, trying to mint...", type: "info"});
    try{
        const tx = await web3.sendAndConfirmRawTransaction(connection, mintToken.serialize({verifySignatures: false}));
        log({taskId: taskId, message: "Success TX: " +  tx, type: "success"});
    } catch(e){
        console.log(e);
    }
    console.log();
}
