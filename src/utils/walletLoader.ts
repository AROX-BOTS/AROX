import * as fs from 'fs';
import * as path from 'path';
import * as anchor from "@project-serum/anchor";
import * as solanaWeb3 from "@solana/web3.js";
import * as csv from "csv-parser";
import bs58 from "bs58";

let wallets: { [name: string]: string } = {};

export const LoadWallet = async (walletName: string | undefined): Promise<anchor.Wallet | undefined> => {
    if(walletName == undefined){
        console.log("Wallet name is not defined");
        return;
    }

    const isEmpty = Object.keys(wallets).length === 0;
    if(isEmpty){
        await loadWallets()
    }

    const walletPrivKey = wallets[walletName];
    const walletKey = bs58.decode(walletPrivKey);
    let keypair = solanaWeb3.Keypair.fromSecretKey(walletKey);
    return new anchor.Wallet(keypair);
}

const loadWallets = async(): Promise<void> => {
    const parsedWalletsArray = await LoadWalletCsv();
    for (const wallet of parsedWalletsArray){
        // @ts-ignore
        wallets[wallet.NAME] = wallet.PRIVKEY
    }
}

const LoadWalletCsv = async(): Promise<[]> => {
    const appdataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME : process.env.HOME + "/.local/share");
    // @ts-ignore
    const totalWalletsPath = path.join(appdataPath, 'SAB', 'Solana Wallets.csv');
    // @ts-ignore
    const results = [];
    await new Promise(async (resolve, reject) => {
        fs.createReadStream(totalWalletsPath)
            .pipe(csv.default())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                // @ts-ignore
                resolve(results);
            });
    });
    // @ts-ignore
    return results;
}
