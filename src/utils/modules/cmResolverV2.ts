import * as anchor from "@project-serum/anchor";
import {
    awaitTransactionSignatureConfirmation,
    getCandyMachineState,
    mintOneToken,
    sleep
} from "../cm-v2";
import {log} from './sharedTaskFunctions';
import {QueueWebhook} from "../webhookHandler";
import {QueueMintStatusLog} from "../mintStatusLogger";
import {sendAndConfirmRawTransaction, Transaction} from "@solana/web3.js";

export const CandyMachineResolveV2 = async(taskId: number, wallet: anchor.Wallet, rpcHost: string | undefined, candyMachineId: string | undefined, mintUrl: string | undefined, customStart: number | undefined, customRpc: string | undefined, retryDelay: string | undefined): Promise<void> => {
    if(wallet == undefined){
        log({taskId: taskId, message: "Wallet is undefined", type: "error"});
        return;
    }

    if(retryDelay == "") retryDelay = undefined;

    // @ts-ignore
    if(customRpc == "") customRpc = undefined;

    let connection
    if(customRpc != undefined){
        connection = new anchor.web3.Connection(customRpc); //https://ssc-dao.genesysgo.net/
    } else{
        const web3Config: anchor.web3.ConnectionConfig = {
            httpHeaders: {origin: "https://aroxbots.com", referer: "https://aroxbots.com"}
        };
        connection = new anchor.web3.Connection("https://dry-falling-water.solana-mainnet.quiknode.pro/", web3Config); //https://ssc-dao.genesysgo.net/
    }
    //const txTimeout = 30000; // milliseconds (confirm this works for your project)'

    const candyMachineIdPubkey = new anchor.web3.PublicKey(
        // @ts-ignore
        candyMachineId
    );

    let candyMachineState;
    try{
        candyMachineState = await getCandyMachineState(
            wallet,
            // @ts-ignore
            candyMachineIdPubkey,
            connection
        );
    } catch(e){
        console.log(e);
    }
    if(candyMachineState == undefined){
        log({taskId: taskId, message: "Cannot init CM", type: "critical"})
        return;
    }
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    let price = candyMachineState.state.price;
    // @ts-ignore
    log({taskId: taskId, message: "Items remaining in machine: " + candyMachineState.state.itemsRemaining + ", Live at: " + candyMachineState.state.goLiveDate.toNumber() + ", total redeemed: " + candyMachineState.state.itemsRedeemed + ", total available: " + candyMachineState.state.itemsAvailable + " price: " + price / 1000000000+"SOL", type: "info"});

   /* if(candyMachineState.state.itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    }*/

    // @ts-ignore
    if(customStart == "") customStart = undefined;

    let currentDate = new Date();
        /*await sendTransactions(
                candyMachine.program.provider.connection,
                candyMachine.program.provider.wallet,
                [instructions, cleanupInstructions],
                [signers, []],
            )
        ).txs.map(t => t.txid);*/
    if(customStart != undefined){
        log({taskId: taskId, message: "Using custom start date...", type: "info"});
        while(currentDate.valueOf() <= customStart){
            let now= customStart - currentDate.valueOf();
            if(0>now) break;
            log({taskId: taskId, message: "Haven't reached custom start date, sleeping"+now+"ms and checking again. Current time: " + currentDate.valueOf(), type: "info"});
            await sleep(500);
            currentDate = new Date();
        }
    } else {
        while(currentDate.valueOf() <= (candyMachineState.state.goLiveDate.toNumber()*1000)){
            let now=  (candyMachineState.state.goLiveDate.toNumber()*1000)-currentDate.valueOf();
            if(0>now) break;
            log({taskId: taskId, message: "Sale not live, sleeping: "+now+"ms and checking again", type: "info"});
            await sleep(now);
            currentDate = new Date();
        }
    }

    try {
        if (wallet) {
            let status;
            let mintTxId;
            try{
                log({taskId: taskId, message: "Sale live, trying to mint...", type: "info"});
                const transactionInstructions = await mintOneToken(candyMachineState, wallet.publicKey, taskId);

            } catch(e){
                log({taskId: taskId, message: "Encountered error, retrying.", type: "critical"});
                if(retryDelay != undefined){
                    log({taskId: taskId, message: "Using custom retry delay.", type: "info"});
                    await sleep(Number(retryDelay));
                } else{
                    await sleep(500);
                }
                let error = true
                while(error){
                    try{
                        log({taskId: taskId, message: "Retrying...", type: "info"});
                        const transactionInstructions = await mintOneToken(candyMachineState, wallet.publicKey, taskId);
                    } catch(e){
                        // @ts-ignore
                        log({taskId: taskId, message: "Error: " + e.message, type: "info"});
                    }
                }
            }
        }
    } catch (error: any) {
        // TODO: blech:
        let message = error.msg || "Minting failed! Please try again!";
        if (!error.msg) {
            if (error.message.indexOf("0x138")) {
            } else if (error.message.indexOf("0x137")) {
                message = `SOLD OUT!`;
            } else if (error.message.indexOf("0x135")) {
                message = `Insufficient funds to mint. Please fund your wallet.`;
            }
        } else {
            if (error.code === 311) {
                message = `SOLD OUT!`;
            } else if (error.code === 312) {
                try{
                    await CandyMachineResolveV2(taskId, wallet, rpcHost, candyMachineId, undefined, customStart, customRpc, retryDelay);
                } catch(error: any){
                    if (!error.msg) {
                        if (error.message.indexOf("0x138")) {
                        } else if (error.message.indexOf("0x137")) {
                            message = `SOLD OUT!`;
                        } else if (error.message.indexOf("0x135")) {
                            message = `Insufficient funds to mint. Please fund your wallet.`;
                        }
                    } else {
                        if (error.code === 311) {
                            message = `SOLD OUT!`;
                        } else if (error.code === 312) {
                            await CandyMachineResolveV2(taskId, wallet, rpcHost, candyMachineId, mintUrl, customStart, customRpc, retryDelay);}
                        // message = `Minting period hasn't started yet.`;
                    }
                }
                // message = `Minting period hasn't started yet.`;
            }
        }
        log({taskId: taskId, message: message, type: "error"});
    }
}
