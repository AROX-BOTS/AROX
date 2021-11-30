import got from 'got';
import {version} from "../index";

export const VersionChecker = async(): Promise<boolean> => {
    return new Promise(async(resolve, reject) => {
        try{
            const versionCheck = await got.post("https://sab-api.ey.r.appspot.com/api/get-newest-version");
            if(versionCheck.body == version){
                resolve(true);
            } else{
                resolve(false);
            }
        } catch(e: any){
            resolve(false);
        }
    });
}
