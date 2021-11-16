import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import {ReactParseRunner} from './modules/candyMachineTaskReactParser';
import {ManualRunner} from './modules/candyMachineTaskManual';
import {LoadWallet} from "./walletLoader";

const appdataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME : process.env.HOME + "/.local/share");
// @ts-ignore
const taskPath = path.join(appdataPath, 'SAB', 'Tasks.csv');


const LoadTasks = async(): Promise<[]> => {
    // @ts-ignore
    const results = [];
    await new Promise(async (resolve, reject) => {
        fs.createReadStream(taskPath)
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

export const StartTasks = async(): Promise<void> => {
    const parsedTaskArray = await LoadTasks();
    // @ts-ignore
    let tasks = [];
    let i = 1;
    for (const task of parsedTaskArray){
        // @ts-ignore
        switch (task.TYPE){
            case "cm-react":{
                // @ts-ignore
                let wallet = await LoadWallet(task.WALLET);
                if(wallet == undefined){
                    return;
                }
                // @ts-ignore
                tasks.push(ReactParseRunner(i, wallet, task.URL, task.TO_MINT, task.PARSE_TYPE));
                i++;
                break;
            }
            case "cm-manual":{
                // @ts-ignore
                let wallet = await LoadWallet(task.WALLET);
                if(wallet == undefined){
                    return;
                }
                // @ts-ignore
                tasks.push(ManualRunner(i, wallet, task.URL, task));
                i++;
                break;
            }
            default:{
                console.log("Not a valid selection");
                break;
            }
        }

        await new Promise(async (resolve, reject) => {
            // @ts-ignore
            await Promise.allSettled(tasks).then(resolve());
            }
        );

    }
}
