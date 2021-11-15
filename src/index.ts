import * as fs from 'fs';
import * as path from 'path';
import {StartTasks} from './utils/taskInitializer';
import * as readline from 'readline';
import {ConfigLoader} from "./utils/configLoader";
import {AuthenticateUser} from "./utils/authenticationHandler";


/*
Notes:
Hele starten er IKKE async, da vi gerne vil tjekke om tingene eksisterer og om licens etc. er valid før vi kører resten af programmet
Alt andet SKAL være async. Både for concurrency men også performance :)
 */

const appdataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME : process.env.HOME + "/.local/share");
// @ts-ignore
const configFolder = path.join(appdataPath, 'SAB');
// @ts-ignore
const walletFolder = path.join(appdataPath, 'SAB', 'Wallets');

if (!fs.existsSync(configFolder)){
    fs.mkdirSync(configFolder);
}

if (!fs.existsSync(walletFolder)){
    fs.mkdirSync(walletFolder);
}

const initializationSteps = async (): Promise<void> => {
    await ConfigLoader();
    const validKey = await AuthenticateUser();
    if(!validKey){
        process.exit(1);
    }
}

const startUpSelections = async (): Promise<void>  => {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    await new Promise(async (resolve, reject) => {
        console.clear();
        console.log(
            "1: Run tasks \n" +
            "i: File directory \n"
        )
        rl.question('Selection:', async (answer) => {
            switch (answer.toLowerCase()) {
                case '1':
                    await StartTasks();
                    break;
                case 'i':
                    console.log(configFolder);
                    break;
                default:
                    console.log('Invalid answer!');
            }
            rl.close();
        });
    });
}


initializationSteps().then(startUpSelections);
