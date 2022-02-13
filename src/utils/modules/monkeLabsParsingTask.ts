import axios from 'axios';
import * as anchor from "@project-serum/anchor";
import {log} from "./sharedTaskFunctions";
import {BaseMonkeLabsHandler} from "./baseMonkeLabsHandler";


export async function MonkeLabsParseRunner(taskId: number, wallet: anchor.Wallet, mintUrl: string){
    log({taskId: taskId, message: "Starting parsing of sitekeys", type: "info"});
    const siteKeys = await getSiteAndParseKeys(taskId, mintUrl);
    if(siteKeys== undefined){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    try{
        await BaseMonkeLabsHandler(taskId, wallet, siteKeys.candyMachineIdString, siteKeys.config);
    } catch (error: any) {
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
                await BaseMonkeLabsHandler(taskId, wallet, siteKeys.candyMachineIdString, siteKeys.config);
                message = `Minting period hasn't started yet.`;
            }
        }
        log({taskId: taskId, message: message, type: "error"});
    }
}

async function getSiteAndParseKeys(taskId: number, baseUrl: string | undefined) {
    const httpheaders = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'en-DK,en;q=0.9,da-DK;q=0.8,da;q=0.7,en-US;q=0.6',
        'dnt': '1',
        'sec-ch-ua': '"Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-gpc': '1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36'
    }
    if(baseUrl == undefined){
        log({taskId: taskId, message: "Mint URL not defined", type: "error"});
        return;
    }
    const site = await axios.get(baseUrl, {headers: httpheaders});
    if(site.status != 200){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    const body = site.data;
    let regexPattern = /static\/js\/\d{1,3}\..{1,50}\.chunk\.js/;
    const chunkFound = regexPattern.exec(body);
    if(chunkFound == null){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    const chunkSiteUrl = baseUrl+chunkFound[0];

    const httpheaders2 = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'en-DK,en;q=0.9,da-DK;q=0.8,da;q=0.7,en-US;q=0.6',
        'dnt': '1',
        'sec-ch-ua': '"Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-gpc': '1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36',
        'sec-fetch-dest': 'script',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-origin',
        'referer': baseUrl
    }

    const chunkSite = await axios.get(chunkSiteUrl, {headers: httpheaders2});
    if(chunkSite.status != 200){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    const chunkSiteBody = chunkSite.data;

    const wlKeyRegex = /REACT_APP_WHITELIST_KEY:"\w{32,44}"/.exec(chunkSiteBody);
    if (!wlKeyRegex) {
        log({taskId: taskId, message: "Cannot parse site with this parse setting (1)", type: "error"});
        return;
    }
    const wlKey = wlKeyRegex[0];

    const priceRegex = /REACT_APP_PRICE:"\d*"/.exec(chunkSiteBody);
    if (!priceRegex) {
        log({taskId: taskId, message: "Cannot parse site (2)", type: "error"});
        return;
    }
    const priceParsed = priceRegex[0];

    if(priceParsed == null){
        log({taskId: taskId, message: "Cannot find price parsing ID, not critical.", type: "error"});
    }

    const indexCapRegex = /REACT_APP_INDEX_CAP:"\d*"/.exec(chunkSiteBody);
    if (!indexCapRegex) {
        log({taskId: taskId, message: "Cannot parse site (2)", type: "error"});
        return;
    }
    const indexCap = indexCapRegex[0];
    if(indexCap == null){
        log({taskId: taskId, message: "Cannot find index cap, critical.", type: "error"});
        return;
    }

    const indexKeyRegex = /REACT_APP_INDEX_KEY:"\w{32,44}"/.exec(chunkSiteBody);
    if (!indexKeyRegex) {
        log({taskId: taskId, message: "Cannot parse site (3)", type: "error"});
        return;
    }
    const indexKey = indexKeyRegex[0];
    if(indexKey == null){
        log({taskId: taskId, message: "Cannot find index key, critical.", type: "error"});
        return;
    }

    const configKeyRegex = /REACT_APP_CONFIG_KEY:"\w{32,44}"/.exec(chunkSiteBody);
    if (!configKeyRegex) {
        log({taskId: taskId, message: "Cannot parse site (4)", type: "error"});
        return;
    }
    const configKey = configKeyRegex[0];
    if(configKey == null){
        log({taskId: taskId, message: "Cannot find index key, critical.", type: "error"});
        return;
    }

    const primaryWalletRegex = /REACT_APP_PRIMARY_WALLET:"\w{32,44}"/.exec(chunkSiteBody);
    if (!primaryWalletRegex) {
        log({taskId: taskId, message: "Cannot parse site (5)", type: "error"});
        return;
    }
    const primaryWalletKey = primaryWalletRegex[0];
    if(primaryWalletKey == null){
        log({taskId: taskId, message: "Cannot find index key, critical.", type: "error"});
        return;
    }

    const pdaBufRegex = /REACT_APP_PDA_BUFFER:"\d*"/.exec(chunkSiteBody);
    if (!pdaBufRegex) {
        log({taskId: taskId, message: "Cannot parse site (6)", type: "error"});
        return;
    }
    const pdaBuf = pdaBufRegex[0];
    if(pdaBuf == null){
        log({taskId: taskId, message: "Cannot find index key, critical.", type: "error"});
        return;
    }

    const candyMachineIdRegex = /REACT_APP_CANDY_MACHINE_ID:"\w{32,44}"/.exec(chunkSiteBody);
    if (!candyMachineIdRegex) {
        log({taskId: taskId, message: "Cannot parse site (7)", type: "error"});
        return;
    }
    const candyMachineId = candyMachineIdRegex[0];
    if(candyMachineId == null){
        log({taskId: taskId, message: "Cannot find index key, critical.", type: "error"});
        return;
    }

    // @ts-ignore
    const wlKeyString = wlKey.replace("REACT_APP_WHITELIST_KEY:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const priceString = priceParsed.replace("REACT_APP_PRICE:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const indexCapString = indexCap.replace("REACT_APP_INDEX_CAP:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const indexKeyString = indexKey.replace("REACT_APP_INDEX_KEY:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const configKeyString = configKey.replace("REACT_APP_CONFIG_KEY:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const primaryWalletString = primaryWalletKey.replace("REACT_APP_PRIMARY_WALLET:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const pdaBufString = pdaBuf.replace("REACT_APP_PDA_BUFFER:","").replace(",","").slice(1, -1);
    // @ts-ignore
    const candyMachineIdString = candyMachineId.replace("REACT_APP_CANDY_MACHINE_ID:","").replace(",","").slice(1, -1);

    const config = {
        "pda_buf": parseInt(pdaBufString),
        "price": parseInt(priceString),
        "index_cap": parseInt(indexCapString),
        "index_key": indexKeyString,
        "wl_key":wlKeyString,
        "primary_wallet": primaryWalletString,
        "config_key": configKeyString
    }
    return {
        candyMachineIdString,
        config
    };
}

