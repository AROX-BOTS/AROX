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

export const CandyMachineResolveV2 = async(taskId: number, wallet: anchor.Wallet, rpcHost: string | undefined, candyMachineId: string | undefined): Promise<void> => {
    if(wallet == undefined){
        log({taskId: taskId, message: "Wallet is undefined", type: "error"});
        return;
    }

    let rpcNetworkHost = rpcHost;
    if(rpcNetworkHost == null || rpcNetworkHost == ""){
        log({taskId: taskId, message: "RPC is null, setting to mainnet-beta", type: "error"});
        rpcNetworkHost = "https://solana-api.projectserum.com";
    }

    let connection;
    connection = new anchor.web3.Connection(rpcNetworkHost);

    //const txTimeout = 30000; // milliseconds (confirm this works for your project)'

    const candyMachineIdPubkey = new anchor.web3.PublicKey(
        // @ts-ignore
        candyMachineId
    );

    const candyMachineState = await getCandyMachineState(
        wallet,
        // @ts-ignore
        candyMachineIdPubkey,
        connection
    );
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    let price = candyMachineState.state.price;
    // @ts-ignore
    log({taskId: taskId, message: "Items remaining in machine: " + candyMachineState.state.itemsRemaining + ", Live at: " + candyMachineState.state.goLiveDate + ", total redeemed: " + candyMachineState.state.itemsRedeemed + ", total available: " + candyMachineState.state.itemsAvailable + " price: " + price / 1000000000+"SOL", type: "info"});

    if(candyMachineState.state.itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    }

    let currentDate = new Date();
    while(currentDate.valueOf() <= candyMachineState.state.goLiveDate.toNumber()){
        log({taskId: taskId, message: "Sale not live, sleeping 500ms and checking again", type: "info"});
        await sleep(500);
        currentDate = new Date();
    }

    log({taskId: taskId, message: "Sale live, trying to mint...", type: "info"});

    try {
        if (wallet) {

            const mintTxId = await mintOneToken(
                candyMachineState,
                wallet.publicKey
            );

            log({taskId: taskId, message: "Finalised mint, awaiting transaction confirmation", type: "info"});
            const status = await awaitTransactionSignatureConfirmation(
                // @ts-ignore
                mintTxId[0],
                15000, //default 15k
                connection,
                "singleGossip",
                true
            );

            // @ts-ignore
            if (status.err === null) {
                log({taskId: taskId, message: "Finalised mint of 1 token, TX: " + mintTxId, type: "success"});
                try{
                    // @ts-ignore
                    await QueueWebhook(mintTxId[0], "", "mainnet-beta");
                    await QueueMintStatusLog("", true);
                } catch{}
            } else {
                log({taskId: taskId, message: "Encountered error on minting of 1 token", type: "critical"});
                await QueueMintStatusLog("", false);
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
                    await CandyMachineResolveV2(taskId, wallet, rpcHost, candyMachineId);
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
                            await CandyMachineResolveV2(taskId, wallet, rpcHost, candyMachineId);}
                        // message = `Minting period hasn't started yet.`;
                    }
                }
                // message = `Minting period hasn't started yet.`;
            }
        }
        log({taskId: taskId, message: message, type: "error"});
    }
}
