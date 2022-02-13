import axios from "axios";
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
            const resp = await axios.post("https://sab-api.ey.r.appspot.com/api/handle-hardware-id", {
                    licensekey: LicenseKey,
                    hardwareId: hwid
                }, {headers: httpHeaders});
            await sleep(750);
            await sleep(750);
            statCode = resp.status;
        } catch(e){
            console.log(e);
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
