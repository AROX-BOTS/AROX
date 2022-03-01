import * as nearApi from "near-api-js";
import path from 'path';
import {log, sleep} from "./sharedTaskFunctions";
import {QueueWebhook} from "../webhookHandler";
import axios from "axios";
const homedir = require("os").homedir();
const CREDENTIALS_DIR = ".near-credentials";
const credentialsPath = path.join(homedir, CREDENTIALS_DIR);

export async function ParasPriceSnipe(taskId: number, keys: Object){
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

    let hasSniped = false;
    let hasFoundSnipe = false;
    let snipeYoctoPrice = "";
    let tokenAddress = "";
    let snipeTokenId = undefined;
    while(!hasSniped){
        while(!hasFoundSnipe){
            try{
                if(retryDelay){
                    await sleep(Number(retryDelay))
                } else{
                    await sleep(350)
                }
                // @ts-ignore
                const getListed = await axios.get("https://api-v2-mainnet.paras.id/token-series?collection_id="+keys.URL+"&exclude_total_burn=true&__limit=12&__sort=lowest_price::1&lookup_token=true&min_price=0");
                const listedData = getListed.data.data.results;
                listedData.every((saleObject: any) =>{
                    let yoctoPrice = saleObject.lowest_price;
                    let nearPrice = nearApi.utils.format.formatNearAmount(yoctoPrice);
                    // @ts-ignore
                    if(Number(nearPrice) <= Number(keys.CONTRACT)){
                        snipeTokenId = saleObject.token.token_id;
                        snipeYoctoPrice = yoctoPrice;
                        tokenAddress = saleObject.contract_id;
                        hasFoundSnipe = true;
                        return false;
                    }
                    return true;
                });
            } catch(e: any){
                log({taskId: taskId, message: "Error while in loop, error-message: " + e.message + " if a custom delay is set, will retry in that time, otherwise restarting in 350ms", type: "error"});
                if(retryDelay){
                    await sleep(Number(retryDelay))
                } else{
                    await sleep(350)
                }
            }
        }

        try{
            log({taskId: taskId, message: "Sending snipe call...", type: "info"});
            // @ts-ignore
            const callFunction = await account.functionCall({contractId: "marketplace.paras.near", methodName: "buy", args: {"token_id": snipeTokenId, "nft_contract_id": tokenAddress, "ft_token_id": "near", "price": snipeYoctoPrice}, attachedDeposit: snipeYoctoPrice, gas:150000000000000});
            hasSniped = true;
            await QueueWebhook(callFunction.transaction_outcome.id, "PARAS PRICE SNIPE", "Mainnet");
            log({taskId: taskId, message: callFunction.transaction_outcome.id + " possible success, no error reported.", type: "success"});
        } catch(e: any){
            log({taskId: taskId, message: "Error while trying to call function, error-message: " + e.message + " if a custom delay is set, will restart in that time, otherwise restarting in 350ms", type: "error"});
            hasFoundSnipe = false;
            if(retryDelay){
                await sleep(Number(retryDelay))
            } else{
                await sleep(350)
            }
        }

    }
}
