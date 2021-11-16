import * as anchor from "@project-serum/anchor";
import {CandyMachineResolve} from "./baseCandyMachineTaskResolver";
import got from "got";
import {log} from './sharedTaskFunctions';


export async function ReactParseRunner(taskId: number, wallet: anchor.Wallet, mintUrl: string, mintAmount: number, parseType: string | undefined){
    if(parseType == undefined) parseType = "1";
    log({taskId: taskId, message: "Starting parsing of sitekeys", type: "info"});
    const siteKeys = await getSiteAndParseKeys(taskId, mintUrl, parseType);
    if(siteKeys== undefined){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    try{
        await CandyMachineResolve(taskId, wallet, mintUrl, mintAmount, siteKeys?.rpcHostString, siteKeys?.candyMachineConfigString, siteKeys?.candyMachineIdString, siteKeys?.candyMachineStartDateString, siteKeys?.candyMachineNetworkNameString, siteKeys?.candyMachineTreasuryString);
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
                message = `Minting period hasn't started yet.`;
            }
        }
        log({taskId: taskId, message: message, type: "error"});
    }
}

async function getSiteAndParseKeys(taskId: number, baseUrl: string | undefined, parseType: string) {
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
    const site = await got(baseUrl, {headers: httpheaders, timeout: 1500});
    if(site.statusCode != 200){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    const body = site.body;
    let regexPattern = /\/static\/js\/\d{1,3}\..{1,50}\.chunk\.js/;
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

    const chunkSite = await got(chunkSiteUrl, {headers: httpheaders2});
    if(chunkSite.statusCode != 200){
        log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
        return;
    }
    const chunkSiteBody = chunkSite.body;
    let rpcHostRegexObject;
    let candyMachineConfigRegexObject;
    let candyMachineIdRegexObject;
    let candyMachineStartDateRegexObject;
    let candyMachineNetworkNameRegexObject;
    let candyMachineTreasuryRegexObject;

    let rpcHostStringObject;
    let candyMachineConfigStringObject;
    let candyMachineIdStringObject;
    let candyMachineStartDateStringObject;
    let candyMachineNetworkNameStringObject;
    let candyMachineTreasuryStringObject;
    switch(parseType){
        case "1":{
            const regexPattern = /REACT_APP_CANDY_MACHINE_CONFIG:".{1,50}",REACT_APP_CANDY_MACHINE_ID:".{1,50}",REACT_APP_TREASURY_ADDRESS:".{1,50}",REACT_APP_CANDY_START_DATE:"\d*",REACT_APP_SOLANA_NETWORK:".{1,50}",REACT_APP_SOLANA_RPC_HOST:".{1,150}"}/
            const reactOptionsRegex = regexPattern.exec(chunkSiteBody);
            if(reactOptionsRegex == null){ log({taskId: taskId, message: "Cannot parse site with this parse setting", type: "error"}); return;}
            const reactOptions = reactOptionsRegex[0];
            rpcHostRegexObject = /REACT_APP_SOLANA_RPC_HOST:".{1,150}"/.exec(reactOptions);
            candyMachineConfigRegexObject = /REACT_APP_CANDY_MACHINE_CONFIG:".{1,50}",/.exec(reactOptions);
            candyMachineIdRegexObject = /REACT_APP_CANDY_MACHINE_ID:".{1,50}",/.exec(reactOptions);
            candyMachineStartDateRegexObject = /REACT_APP_CANDY_START_DATE:"\d*"/.exec(reactOptions);
            candyMachineNetworkNameRegexObject = /REACT_APP_SOLANA_NETWORK:".{1,50}",/.exec(reactOptions);
            candyMachineTreasuryRegexObject = /REACT_APP_TREASURY_ADDRESS:".{1,50}"/.exec(reactOptions);
            break;
        }
        case "2":{
            const regexPattern = /REACT_APP_SOLANA_RPC_HOST:".{1,50}",REACT_APP_CANDY_MACHINE_CONFIG:".{1,50}",REACT_APP_CANDY_MACHINE_ID:".{1,50}",REACT_APP_CANDY_START_DATE:"\d*",REACT_APP_SOLANA_NETWORK:".{1,50}",REACT_APP_TREASURY_ADDRESS:".{1,50}"}\)/;
            const reactOptionsRegex = regexPattern.exec(chunkSiteBody);
            if(reactOptionsRegex == null){ log({taskId: taskId, message: "Cannot parse site with this parse setting", type: "error"}); return;}
            const reactOptions = reactOptionsRegex[0];
            rpcHostRegexObject = /REACT_APP_SOLANA_RPC_HOST:".{1,50}",/.exec(reactOptions);
            candyMachineConfigRegexObject = /REACT_APP_CANDY_MACHINE_CONFIG:".{1,50}",/.exec(reactOptions);
            candyMachineIdRegexObject = /REACT_APP_CANDY_MACHINE_ID:".{1,50}",/.exec(reactOptions);
            candyMachineStartDateRegexObject = /REACT_APP_CANDY_START_DATE:"\d*"/.exec(reactOptions);
            candyMachineNetworkNameRegexObject = /REACT_APP_SOLANA_NETWORK:".{1,50}",/.exec(reactOptions);
            candyMachineTreasuryRegexObject = /REACT_APP_TREASURY_ADDRESS:".{1,50}"/.exec(reactOptions);
            break;
        }
        case "3":{
            const rpcRegex = /REACT_APP_SOLANA_RPC_HOST:".{1,150}"/.exec(chunkSiteBody);
            if (!rpcRegex) {
                log({taskId: taskId, message: "Cannot parse site with this parse setting (1)", type: "error"});
                return;
            }
            rpcHostStringObject = rpcRegex[0];
            const cmConfigRegex = /REACT_APP_CANDY_MACHINE_CONFIG:".{1,50}"/.exec(chunkSiteBody);
            if (!cmConfigRegex) {
                log({taskId: taskId, message: "Cannot parse site with this parse setting (2)", type: "error"});
                return;
            }
            candyMachineConfigStringObject = cmConfigRegex[0];
            const cmIdRegex = /REACT_APP_CANDY_MACHINE_ID:".{1,50}"/.exec(chunkSiteBody);
            if (!cmIdRegex) {
                log({taskId: taskId, message: "Cannot parse site with this parse setting (3)", type: "error"});
                return;
            }
            candyMachineIdStringObject = cmIdRegex[0];
            const cmStartDate = /REACT_APP_CANDY_START_DATE:"\d*"/.exec(chunkSiteBody);
            if (!cmStartDate) {
                log({taskId: taskId, message: "Cannot parse site with this parse setting (4)", type: "error"});
                return;
            }
            candyMachineStartDateStringObject = cmStartDate[0];
            const treasuryRegex = /REACT_APP_TREASURY_ADDRESS:".{1,50}"/.exec(chunkSiteBody);
            if (!treasuryRegex) {
                log({taskId: taskId, message: "Cannot parse site with this parse setting (5)", type: "error"});
                return;
            }
            candyMachineTreasuryStringObject = treasuryRegex[0];
            const candyMachineNetworkNameRegex = /REACT_APP_SOLANA_NETWORK:".{1,20}"/.exec(chunkSiteBody);
            if (!candyMachineNetworkNameRegex) {
                log({taskId: taskId, message: "Cannot parse site with this parse setting (6)", type: "error"});
                return;
            }
            candyMachineNetworkNameStringObject = candyMachineNetworkNameRegex[0];
        }
    }
    if(parseType == "3"){
        if(rpcHostStringObject == null || candyMachineConfigStringObject == null || candyMachineIdStringObject == null || candyMachineStartDateStringObject == null || candyMachineNetworkNameStringObject == null || candyMachineTreasuryStringObject == null){
            log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
            return;
        }
    } else {
        if(rpcHostRegexObject == null || candyMachineConfigRegexObject == null || candyMachineIdRegexObject == null || candyMachineStartDateRegexObject == null || candyMachineNetworkNameRegexObject == null || candyMachineTreasuryRegexObject == null){
            log({taskId: taskId, message: "Cannot find sitekeys, must be found manually", type: "error"});
            return;
        }
    }
    let rpcHostString;
    let candyMachineConfigString;
    let candyMachineIdString;
    let candyMachineStartDateString;
    let candyMachineNetworkNameString;
    let candyMachineTreasuryString;
    if(parseType == "3"){
        // @ts-ignore
        rpcHostString = rpcHostStringObject.replace("REACT_APP_SOLANA_RPC_HOST:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineConfigString = candyMachineConfigStringObject.replace("REACT_APP_CANDY_MACHINE_CONFIG:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineIdString = candyMachineIdStringObject.replace("REACT_APP_CANDY_MACHINE_ID:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineStartDateString = candyMachineStartDateStringObject.replace("REACT_APP_CANDY_START_DATE:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineNetworkNameString = candyMachineNetworkNameStringObject.replace("REACT_APP_SOLANA_NETWORK:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineTreasuryString = candyMachineTreasuryStringObject.replace("REACT_APP_TREASURY_ADDRESS:","").replace(",","").slice(1, -1);
    } else{
        // @ts-ignore
        rpcHostString =  rpcHostRegexObject[0].replace("REACT_APP_SOLANA_RPC_HOST:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineConfigString =  candyMachineConfigRegexObject[0].replace("REACT_APP_CANDY_MACHINE_CONFIG:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineIdString = candyMachineIdRegexObject[0].replace("REACT_APP_CANDY_MACHINE_ID:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineStartDateString = candyMachineStartDateRegexObject[0].replace("REACT_APP_CANDY_START_DATE:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineNetworkNameString = candyMachineNetworkNameRegexObject[0].replace("REACT_APP_SOLANA_NETWORK:","").replace(",","").slice(1, -1);
        // @ts-ignore
        candyMachineTreasuryString = candyMachineTreasuryRegexObject[0].replace("REACT_APP_TREASURY_ADDRESS:","").replace(",","").slice(1, -1);
    }

    if(rpcHostString.includes('"')){
        rpcHostString = rpcHostString.split('"')[0]
    }
    if(rpcHostString.includes('{')){
        rpcHostString = rpcHostString.split('{')[0]
    }

    return {
        rpcHostString,
        candyMachineConfigString,
        candyMachineIdString,
        candyMachineStartDateString,
        candyMachineNetworkNameString,
        candyMachineTreasuryString
    };
}

