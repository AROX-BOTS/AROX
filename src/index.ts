import * as fs from 'fs';
import * as path from 'path';
import {StartTasks} from './utils/taskInitializer';
import * as readline from 'readline';
import {ConfigLoader} from "./utils/configLoader";
import {AuthenticateUser} from "./utils/authenticationHandler";
import {sleep} from "./utils/candyMachineUtilities";
import {VersionChecker} from "./utils/versionChecker";
import {log} from "./utils/modules/sharedTaskFunctions";

export const version = "BETA 0.5"
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

// @ts-ignore
const configFile = path.join(appdataPath, 'SAB', 'Config.json');

// @ts-ignore
const taskFile = path.join(appdataPath, 'SAB', 'Tasks.csv');

// @ts-ignore
const solWallets = path.join(appdataPath, 'SAB', 'Solana Wallets.csv');

if (!fs.existsSync(configFolder)){
    fs.mkdirSync(configFolder);
}

if (!fs.existsSync(walletFolder)){
    fs.mkdirSync(walletFolder);
}

if (!fs.existsSync(configFile)){
    fs.writeFileSync(configFile,'{\n' +
        '  "licenseKey": "",\n' +
        '  "webhookUrl": ""\n' +
        '}\n');
}

if (!fs.existsSync(taskFile)){
    fs.writeFileSync(taskFile,'"TYPE","URL","WALLET","CONTRACT","CUSTOMSTART","CUSTOMRPC","RETRYDELAY"');
}
if (!fs.existsSync(solWallets)){
    fs.writeFileSync(solWallets,'"NAME","PRIVKEY"');
}

const initializationSteps = async (): Promise<void> => {
    await ConfigLoader();
    const validKey = await AuthenticateUser();
    if(!validKey){
        console.log("Your licensekey isn't valid. Please make sure that you have added the correct one to Config.json");
        await sleep(5000);
        process.exit(1);
    }
    const getVersion = await VersionChecker();
    if(!getVersion){
        log({taskId: 0, message:"Your version is: " + version + ", which may not be the newest version. Please check the Discord", type: "info"});
        await sleep(5000);
    }
}

const startUpSelections = async (): Promise<boolean>  => {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.clear();
    const name = "   _____        ___________             ____    _____       _____ \n" +
        "  /      |_      \\          \\        ____\\_  \\__ \\    \\     /    / \n" +
        " /         \\      \\    /\\    \\      /     /     \\ \\    |   |    /  \n" +
        "|     /\\    \\      |   \\_\\    |    /     /\\      | \\    \\ /    /   \n" +
        "|    |  |    \\     |      ___/    |     |  |     |  \\    |    /    \n" +
        "|     \\/      \\    |      \\  ____ |     |  |     |  /    |    \\    \n" +
        "|\\      /\\     \\  /     /\\ \\/    \\|     | /     /| /    /|\\    \\   \n" +
        "| \\_____\\ \\_____\\/_____/ |\\______||\\     \\_____/ ||____|/ \\|____|  \n" +
        "| |     | |     ||     | | |     || \\_____\\   | / |    |   |    |  \n" +
        " \\|_____|\\|_____||_____|/ \\|_____| \\ |    |___|/  |____|   |____|  \n" +
        "                                    \\|____|                        "
    console.log(name);
    console.log("VERSION: " + version);
    await sleep(450);
    return await new Promise(async (resolve, reject) => {
        console.log(
            "1: Run tasks \n" +
            "i: File directory \n"
        )
        rl.question('Selection:', async (answer) => {
            switch (answer.toLowerCase()) {
                case '1':
                    await StartTasks();
                    resolve(true);
                    break;
                case 'i':
                    console.log(configFolder);
                    await sleep(5000);
                    resolve(true);
                    break;
                default:
                    console.log('Invalid answer!');
                    resolve(true);
                    break;
            }
            rl.close();
        });
    });
}

let running: boolean;
initializationSteps().then(startUpSelections);
