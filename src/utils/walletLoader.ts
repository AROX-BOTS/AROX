import * as fs from 'fs';
import * as path from 'path';
import * as anchor from "@project-serum/anchor";
import * as solanaWeb3 from "@solana/web3.js";

export const LoadWallet = async (walletName: string | undefined): Promise<anchor.Wallet | undefined> => {
    if(walletName == undefined){
        console.log("Wallet name is not defined");
        return;
    }

    const appdataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME : process.env.HOME + "/.local/share");

    walletName = walletName+".txt";
    // @ts-ignore
    const totalWalletPath = path.join(appdataPath, 'SAB', 'Wallets', walletName);
    let walletExists;
   /* fs.stat(totalWalletPath, function(err, stat) {
        if(err == null) {
           walletExists = true;
        } else if(err.code == 'ENOENT') {
            walletExists = false;
        }
    }); */
    walletExists = fs.existsSync(totalWalletPath);

    if(!walletExists){
        console.log("Cannot find that wallet in the wallet folder. Ensure it's a .txt file");
        return;
    }
    let walletUintArray: number[];
    const bufferData = fs.readFileSync(totalWalletPath);
    walletUintArray = await processBuffer(bufferData);


    const walletKey = Uint8Array.from(walletUintArray);
    let keypair = solanaWeb3.Keypair.fromSecretKey(walletKey);
    return new anchor.Wallet(keypair);
}

const processBuffer = async (data: Buffer): Promise<number[]> => {
    const dataString = data.toString().replace("[","").replace("]","");
    const array = dataString.split(",");
    let walletUintArray: number[] = [];
    array.forEach(numberString => {
        walletUintArray.push(Number(numberString)); //Number(numberString)
    });
    return walletUintArray;
}
