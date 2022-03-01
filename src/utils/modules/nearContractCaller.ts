import * as nearApi from "near-api-js";
import path from 'path';
import {log, sleep} from "./sharedTaskFunctions";
import {QueueWebhook} from "../webhookHandler";
const homedir = require("os").homedir();
const CREDENTIALS_DIR = ".near-credentials";
const credentialsPath = path.join(homedir, CREDENTIALS_DIR);

export async function NearContract(taskId: number, keys: Object){
    // @ts-ignore
    const nearWallet = keys.WALLET;
    const keyStore = new nearApi.keyStores.UnencryptedFileSystemKeyStore(credentialsPath);
    let config;
    // @ts-ignore
    let customRpc = keys.CUSTOMRPC;
    // @ts-ignore
    let retryDelay = keys.RETRYDELAY;
    if(retryDelay == "") retryDelay = undefined;

    if(customRpc == "") customRpc = undefined;
    if(customRpc != undefined){
        config = {
            keyStore,
            networkId: "mainnet",
            nodeUrl: customRpc,
        };
    } else{
         config = {
            keyStore,
            networkId: "mainnet",
            nodeUrl: "https://rpc.mainnet.near.org",
        };
    }
    // @ts-ignore
    const connection = await nearApi.connect({ ...config, keyStore });
    const account = await connection.account(nearWallet);
    const accountData = await account.getAccountBalance();
    log({taskId: taskId, message: "Successfully connected to account: " + nearWallet + " current NEAR available in account: " + nearApi.utils.format.formatNearAmount(accountData.available), type: "info"});

    // @ts-ignore
    const decodedInstructions = Buffer.from(keys.CONTRACT, 'base64').toString('binary');
    let parsedContractInfo;
    try{
        parsedContractInfo = JSON.parse(decodedInstructions);
    } catch(e: any){
        console.log(e);
    }

    // @ts-ignore
    let customStart = keys.CUSTOMSTART;

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
    }

    let hasMinted = false;
    while(!hasMinted){
        try{
            log({taskId: taskId, message: "Sending function call...", type: "info"});
            const callFunction = await account.functionCall(parsedContractInfo);
            await QueueWebhook(callFunction.transaction_outcome.id, "NEAR", "Mainnet");
            log({taskId: taskId, message: callFunction.transaction_outcome.id + " possible success, no error reported.", type: "success"});
        } catch(e: any){
            log({taskId: taskId, message: "Error while trying to call function, error-message: " + e.message + " if a custom delay is set, will retry in that time, otherwise retrying in 350ms", type: "error"});
            if(retryDelay){
                await sleep(Number(retryDelay))
            } else{
                await sleep(350)
            }
        }
    }
}
