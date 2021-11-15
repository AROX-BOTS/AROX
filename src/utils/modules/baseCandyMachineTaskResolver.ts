import * as anchor from "@project-serum/anchor";
import {
    awaitTransactionSignatureConfirmation,
    getCandyMachineState,
    mintMultipleToken,
    mintOneToken,
    sleep
} from "../candy-machine";
import {log} from './sharedTaskFunctions';

export const CandyMachineResolve = async(taskId: number, wallet: anchor.Wallet, mintUrl: string | undefined, mintAmount: number, rpcHost: string | undefined, candyMachineConfigId: string | undefined, candyMachineId: string | undefined, candyMachineStartDate: string | undefined, candyMachineNetworkName: string | undefined, candyMachineTreasuryKey: string | undefined): Promise<void> => {
    if(wallet == undefined){
        log({taskId: taskId, message: "Wallet is undefined", type: "error"});
        return;
    }

    // @ts-ignore
    const configPublicKey = new anchor.web3.PublicKey(candyMachineConfigId.toString());
    // @ts-ignore
    const treasuryPublicKey = new anchor.web3.PublicKey(candyMachineTreasuryKey.toString());
    // @ts-ignore
    const candyMachinePublicId = new anchor.web3.PublicKey(candyMachineId.toString());
  // const startDateSeed = parseInt(<string>candyMachineStartDate, 10);
    const rpcNetworkHost = rpcHost;
    if(rpcNetworkHost == null){
        log({taskId: taskId, message: "RPC is null, returning", type: "error"});
        return;
    }

    let connection;
    if(mintUrl != undefined){
        const web3Config: anchor.web3.ConnectionConfig = {
            httpHeaders: {origin: mintUrl, referer: mintUrl}
        };
        connection = new anchor.web3.Connection(rpcNetworkHost, web3Config);
    } else {
        connection = new anchor.web3.Connection(rpcNetworkHost);
    }
    const txTimeout = 30000; // milliseconds (confirm this works for your project)'

    const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
    } =  await getCandyMachineState(
        wallet,
        candyMachinePublicId,
        connection
    );
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    log({taskId: taskId, message: "Items remaining in machine: " + itemsRemaining + ", Live at: " + goLiveDate + ", total redeemed: " + itemsRedeemed + ", total available: " + itemsAvailable, type: "info"});

    if(itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    }

    let currentDate = new Date();
    while(currentDate < goLiveDate){
        log({taskId: taskId, message: "Sale not live, sleeping 500ms and checking again", type: "info"});
        await sleep(250);
        currentDate = new Date();
    }

    log({taskId: taskId, message: "Sale live, trying to mint...", type: "info"});

    try {
        if (wallet && candyMachine?.program) {

            if(mintAmount <= 1){
                const mintTxId = await mintOneToken(
                    candyMachine,
                    configPublicKey,
                    wallet.publicKey,
                    treasuryPublicKey
                );

                const status = await awaitTransactionSignatureConfirmation(
                    mintTxId,
                    txTimeout,
                    connection,
                    "singleGossip",
                    false
                );

                // @ts-ignore
                if(status.err === null){
                    log({taskId: taskId, message: "Finalised mint of 1 token, TX: " + mintTxId, type: "success"});
                } else{
                    log({taskId: taskId, message: "Encountered error on minting of 1 token", type: "critical"});
                }
            } else{

                const signedTransactions: any = await mintMultipleToken(
                    candyMachine,
                    configPublicKey,
                    wallet.publicKey,
                    treasuryPublicKey,
                    mintAmount
                );

                const promiseArray = []

                for (let index = 0; index < signedTransactions.length; index++) {
                    const tx = signedTransactions[index];
                    promiseArray.push(awaitTransactionSignatureConfirmation(
                        tx,
                        txTimeout,
                        connection,
                        "singleGossip",
                        true
                    ))
                }

                const allTransactionsResult = await Promise.all(promiseArray) // alle de TX ID's fra mints er i signedTransactions
                let totalSuccess = 0;
                let totalFailure = 0;

                for (let index = 0; index < allTransactionsResult.length; index++) {
                    const transactionStatus = allTransactionsResult[index];
                    if (!transactionStatus?.err) {
                        totalSuccess += 1
                    } else {
                        totalFailure += 1
                    }
                }


                if(totalSuccess) {
                    log({taskId: taskId, message: `Congratulations! ${totalSuccess} mints succeeded! Your NFT's should appear in your wallet soon`, type: "success"});
                }

                if(totalFailure) {
                    log({taskId: taskId, message: `Some mints failed! ${totalFailure} mints failed! Check on your wallet`, type: "error"});
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
                message = `Minting period hasn't started yet.`;
            }
        }
        log({taskId: taskId, message: message, type: "error"});
    }
}
