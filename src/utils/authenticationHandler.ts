import got from "got";
import {LicenseKey} from "./configLoader";
import {machineId} from 'node-machine-id';
import {sleep} from "./candy-machine";
import {log} from "./modules/sharedTaskFunctions";

export const AuthenticateUser = async(): Promise<boolean> => {
    let validKey: boolean = false;
    log({taskId: 0, message: "Authenticating...", type: "info"})
    await new Promise(async (resolve, reject) => {
        const hwid = await machineId();
        let statCode;
        try{
            const httpHeaders = {
                'user-agent': 'SAB',
                'accept': '*/*'
            };
            const {statusCode} = await got.post("https://sab-api.ey.r.appspot.com/api/handle-hardware-id", {json: {
                    licensekey: LicenseKey,
                    hardwareId: hwid
                }, headers: httpHeaders});
            await sleep(750);
            await sleep(750);
            statCode = statusCode;
        } catch(e){
            if (e instanceof got.HTTPError) {
                try{
                    const httpHeaders = {
                        'user-agent': 'SAB',
                        'accept': '*/*'
                    };
                    const {statusCode} = await got.post("https://sab-api.ey.r.appspot.com/api/handle-hardware-id", {json: {
                            licensekey: LicenseKey,
                            hardwareId: hwid
                        }, headers: httpHeaders});
                    await sleep(750);
                    await sleep(750);
                    statCode = statusCode;
                } catch(e){
                    if (e instanceof got.HTTPError) {
                        validKey = false;
                        resolve(validKey);
                    }
                }
            }
        }
        if(statCode !== 200){
            validKey = false;
            resolve(validKey);
        } else{
            validKey = true;
            resolve(validKey);
        }
    });

    return validKey;
}
