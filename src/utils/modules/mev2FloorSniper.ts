import * as anchor from "@project-serum/anchor";
import axios from "axios";
import {Transaction} from "@solana/web3.js";
import {web3} from "@project-serum/anchor";
import {log, sleep} from "./sharedTaskFunctions";
import {QueueWebhook} from "../webhookHandler";

export async function Mev2FloorSniper(taskId: number, wallet: anchor.Wallet, keys: Object){
    // @ts-ignore
    let rpcHost = keys.CUSTOMRPC;
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
    }

    // @ts-ignore
    let retryDelay = keys.RETRYDELAY;

    if(retryDelay == "") retryDelay = undefined;

    // @ts-ignore
    let collection = keys.URL;
    if(collection == "") collection = undefined;
    if(collection == undefined){console.log("please define collection"); return;}
    const collectionUrl = "https://api-mainnet.magiceden.dev/rpc/getListedNFTsByQuery?q=%7B%22%24match%22%3A%7B%22collectionSymbol%22%3A%22"+collection+"%22%7D%2C%22%24sort%22%3A%7B%22takerAmount%22%3A1%2C%22createdAt%22%3A-1%7D%2C%22%24skip%22%3A0%2C%22%24limit%22%3A20%7D";

    let hasFoundSnipe = false;
    let hasSniped = false;
    let snipeObject = {
        sellerId: undefined,
        auctionHouseKey: undefined,
        tokenMintKey: undefined,
        tokenAtaKey: undefined,
        price: undefined,
        sellerReferral: undefined
    };
    while(!hasSniped){
        while(!hasFoundSnipe){
            const getListings = await axios.get(collectionUrl);
            const listingsObject = getListings.data;

            listingsObject.results.every((salepost: any) =>{
                let price = salepost.price;
                // @ts-ignore
                if(price <= Number(keys.CONTRACT)){
                    hasFoundSnipe = true;
                    snipeObject = {
                        sellerId: salepost.owner,
                        auctionHouseKey: salepost.v2.auctionHouseKey,
                        tokenMintKey: salepost.mintAddress,
                        tokenAtaKey: salepost.id,
                        price: price,
                        sellerReferral: salepost.v2.sellerReferral
                    };
                    return false;
                }
                return true;
            });

            if(!hasFoundSnipe){
                log({taskId: taskId, message: "Waiting retrydelay, and then trying again. If retrydelay isn't specified, defaulting to 5sec", type: "info"})
                if(retryDelay){
                    await sleep(Number(retryDelay))
                } else{
                    await sleep(5000)
                }
            }
        }

        log({taskId: taskId, message: "Found an item, trying to snipe...", type: "info"})
        const transactionUrl = "https://api-mainnet.magiceden.dev/v2/instructions/buy_now?buyer="+wallet.publicKey.toBase58()+"&seller="+snipeObject.sellerId+"&auctionHouseAddress="+snipeObject.auctionHouseKey+"&tokenMint="+snipeObject.tokenMintKey+"&tokenATA="+snipeObject.tokenAtaKey+"&price="+snipeObject.price+"&sellerReferral="+snipeObject.sellerReferral+"&sellerExpiry=0";
        const sendTransactionData = await axios.get(transactionUrl);
        const responseTextJson = sendTransactionData.data;
        const respBuffer = responseTextJson.tx.data;
        let transaction = new Transaction();
        try{
            transaction = Transaction.populate(web3.Message.from(respBuffer));
        } catch(e){
            console.log(e);
            return;
        }
        const blockHash = await connection.getRecentBlockhash("finalized");
        transaction.recentBlockhash = blockHash.blockhash;

        try{
            await wallet.signTransaction(transaction);
        } catch(e){
            console.log(e);
            return;
        }
        try{
            const tx = await web3.sendAndConfirmRawTransaction(connection, transaction.serialize());
            console.log(tx);
            await QueueWebhook(tx, "ME-V2-PRICE SNIPE","MAINNET")
            hasSniped = true;
        } catch(e){
            console.log(e);
        }
    }
}
