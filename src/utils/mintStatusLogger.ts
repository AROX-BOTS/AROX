import got from 'got'
import Queue from 'queue-promise';
import {LicenseKey} from "./configLoader";
import * as http from "http";

const queueObject = new Queue({
    concurrent: 1,
    interval: 250
});

async function sendMintStatus(site: string, wasSuccess: boolean){
    const jsonDataToSend = {
        site: site,
        success: wasSuccess,
        licensekey: LicenseKey
    };
    await new Promise(async (resolve, reject) => {
        try{
            const httpHeaders = {
                'user-agent': 'AROX',
                'accept': '*/*'
            };
            await got.post("https://sab-api.ey.r.appspot.com/api/update-stats", {json:jsonDataToSend, headers: httpHeaders});
            resolve(true);
        } catch(e:any){
        }
    });
}

export const QueueMintStatusLog = async (site: string | undefined, wasSuccess: boolean): Promise<void> => {
    if(site == undefined){
        site = "";
    }
    // @ts-ignore
    queueObject.enqueue(() => sendMintStatus(site, wasSuccess));
    queueObject.on("reject", error => {});
    queueObject.on("resolve", data => {});
}
