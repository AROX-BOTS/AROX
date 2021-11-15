import * as fs from 'fs';
import * as path from 'path';

export let LicenseKey: string;
export let WebhookUrl: string;

export const ConfigLoader = async(): Promise<void> => {
    const appdataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME : process.env.HOME + "/.local/share");
    // @ts-ignore
    const configPath = path.join(appdataPath, 'SAB', 'Config.json');
    await new Promise(async (resolve, reject) => {
        fs.readFile(configPath, 'utf-8', (err, data) => {
            if (err) throw err;
            let jsonData = JSON.parse(data);
            LicenseKey = jsonData.licenseKey;
            WebhookUrl = jsonData.webhookUrl;
        });
        resolve(true);
    });
    console.log();
}
