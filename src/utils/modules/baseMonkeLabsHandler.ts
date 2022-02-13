import * as anchor from "@project-serum/anchor";
import {log, sleep} from './sharedTaskFunctions';
import {QueueWebhook} from "../webhookHandler";
import {QueueMintStatusLog} from "../mintStatusLogger";
import {getCandyMachineState, getCandyMachineCreator, mintOneToken, MINT_CONFIG} from "../monkeLabsCandyMachine";

export const BaseMonkeLabsHandler = async(taskId: number, wallet: anchor.Wallet, candyMachineId: string | undefined, mintConfig: MINT_CONFIG): Promise<void> => {
    if(wallet == undefined){
        log({taskId: taskId, message: "Wallet is undefined", type: "error"});
        return;
    }

    // @ts-ignore
    const candyMachinePublicId = new anchor.web3.PublicKey(candyMachineId.toString());
    // const startDateSeed = parseInt(<string>candyMachineStartDate, 10);

    const web3Config: anchor.web3.ConnectionConfig = {
        httpHeaders: {origin: "https://aroxbots.com", referer: "https://aroxbots.com"}
    };
    const connection = new anchor.web3.Connection("https://dry-falling-water.solana-mainnet.quiknode.pro/059cac57150dbd31b529745ae4333bc0414aa7bc/", web3Config); //https://ssc-dao.genesysgo.net/
    // connection = new anchor.web3.Connection("https://ssc-dao.genesysgo.net/", web3Config);

    const candyMachineState =  await getCandyMachineState(
        wallet,
        candyMachinePublicId,
        connection,
        mintConfig.index_key,
        mintConfig.index_cap
    );
    log({taskId: taskId, message: "Candy machine functions initialised", type: "success"});
    log({taskId: taskId, message: "Items remaining in machine: " + candyMachineState.state.itemsRemaining + ", Live at: " + candyMachineState.state.goLiveDate + ", total redeemed: " + candyMachineState.state.itemsRedeemed + ", total available: " + candyMachineState.state.itemsAvailable + " price: " + candyMachineState.state.price+"SOL", type: "info"});

    if(candyMachineState.state.itemsRemaining == 0){
        log({taskId: taskId, message: "No items left to mint", type: "critical"});
        return;
    }


    let currentDate = new Date();
    // @ts-ignore
    while(currentDate.getTime() <= candyMachineState.state.goLiveDate.toNumber()){
        // @ts-ignore
        let now = candyMachineState.goLiveDate - Date.now();
        log({taskId: taskId, message: "Sale not live, sleeping "+now+"ms and then running", type: "info"});
        await sleep(now);
    }

    try{
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
    }
}
