import * as anchor from "@project-serum/anchor";
import {log, sleep} from './sharedTaskFunctions';
import {QueueWebhook} from "../webhookHandler";
import {QueueMintStatusLog} from "../mintStatusLogger";
import {getCandyMachineState, getCandyMachineCreator, mintOneToken, MINT_CONFIG} from "../monkeLabsCandyMachine";

export const BaseMonkeLabsHandler = async(taskId: number, wallet: anchor.Wallet, candyMachineId: string | undefined, mintConfig: MINT_CONFIG, customStart: number | undefined, customRpc: string | undefined, retryDelay: string | undefined): Promise<void> => {
    if(wallet == undefined){
        log({taskId: taskId, message: "Wallet is undefined", type: "error"});
        return;
    }

    // @ts-ignore
    if(customStart == "") customStart = undefined;
    if(retryDelay == "") retryDelay = undefined;

    // @ts-ignore
    if(customRpc == "") customRpc = undefined;

    // @ts-ignore
    const candyMachinePublicId = new anchor.web3.PublicKey(candyMachineId.toString());
    // const startDateSeed = parseInt(<string>candyMachineStartDate, 10);

    let connection;
    if(customRpc != undefined){
        connection = new anchor.web3.Connection(customRpc);
    } else{
        const web3Config: anchor.web3.ConnectionConfig = {
            httpHeaders: {origin: "https://aroxbots.com", referer: "https://aroxbots.com"}
        };
        connection = new anchor.web3.Connection("https://dry-falling-water.solana-mainnet.quiknode.pro/", web3Config); //https://ssc-dao.genesysgo.net/
        // connection = new anchor.web3.Connection("https://ssc-dao.genesysgo.net/", web3Config);
    }

    const candyMachineState =  await getCandyMachineState(
        wallet,
        candyMachinePublicId,
        connection,
        mintConfig.index_key,
        mintConfig.index_cap
    );
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    log({taskId: taskId, message: "Items remaining in machine: " + candyMachineState.state.itemsRemaining + ", Live at: " + candyMachineState.state.goLiveDate + ", total redeemed: " + candyMachineState.state.itemsRedeemed + ", total available: " + candyMachineState.state.itemsAvailable + " price: " + mintConfig.price/1000000000+"SOL", type: "info"});

    if(candyMachineState.state.itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    }

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
        // @ts-ignore
        while(currentDate.getTime() <= candyMachineState.state.goLiveDate.toNumber()){
            // @ts-ignore
            let now = candyMachineState.goLiveDate - Date.now();
            if(0>now){
                break;
            }
            log({taskId: taskId, message: "Sale not live, sleeping "+now+"ms and then running", type: "info"});
            await sleep(now);
        }
    }

    let mintToken;
    while(mintToken == undefined){
        try{
            log({taskId: taskId, message: "Trying to mint...", type: "info"})
            const mintToken = await mintOneToken(wallet, connection, taskId, mintConfig.pda_buf, mintConfig.wl_key, mintConfig.index_key, mintConfig.config_key, mintConfig.primary_wallet);
            // @ts-ignore
            await QueueWebhook(mintToken, "MONKELABS", "AROX")
        } catch(e: any){
            let error = "Unknown error occurred.";

            if (e.logs !== undefined) {
                error = e.logs[e.logs.length - 3].split(' ').splice(2).join(' ');
                if (error.indexOf('0x1') > -1 ) {
                    // console.log(error)
                    error = "Not enough Solana."
                }
            }
            log({taskId: taskId, message: "Unknown error occurred: " +  error, type: "critical"})
            log({taskId: taskId, message: "Waiting retrydelay, and then trying again. If retrydelay isn't specified, defaulting to 500ms", type: "info"})
            if(retryDelay){
                await sleep(Number(retryDelay))
            } else{
                await sleep(500)
            }
        }
    }
}
