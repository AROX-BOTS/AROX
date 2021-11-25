import Queue from 'queue-promise';
import {WebhookUrl} from "./configLoader";
import got from "got";
import {sleep} from "./candy-machine";

const queueObject = new Queue({
    concurrent: 1,
    interval: 250
});

const sendTxWebhook = async(txId: String, site: String, rpcName: String): Promise<void> => {
    await new Promise(async (resolve, reject) => {
        const webhookObject = {
            "content": null,
            "embeds": [
                {
                    "title": "Successful mint | AROX",
                    "description": "Yet another successful mint!",
                    "color": 720128,
                    "fields": [
                        {
                            "name": "TXID:",
                            "value": txId
                        },
                        {
                            "name": "SITE:",
                            "value": site
                        },
                        {
                            "name": "NETWORK:",
                            "value": rpcName
                        }
                    ]
                }
            ],
            "username": "AROX",
            "avatar_url": "https://media.discordapp.net/attachments/798873586705104936/912850763942858772/IMG_3016.png?width=1090&height=1090"
        };
        let statCode;
        try{
            const {statusCode} = await got.post(WebhookUrl, {json: webhookObject});
            await sleep(200);
            await sleep(200);
            statCode = statusCode;
        } catch(e){
            if (e instanceof got.HTTPError) {
                try {
                    const {statusCode} = await got.post(WebhookUrl, {json: webhookObject});
                    await sleep(200);
                    await sleep(200);
                    statCode = statusCode;
                } catch (e) {
                    if (e instanceof got.HTTPError) {
                        const {statusCode} = await got.post(WebhookUrl, {json: webhookObject});
                        await sleep(200);
                        await sleep(200);
                        statCode = statusCode;
                    }
                }
            }
        }
        resolve(statCode);
    });
}

export const QueueWebhook = async (txId: String, site: string | undefined, rpcName: string | undefined): Promise<void> => {
    if(site == undefined){
        site = "";
    }
    // @ts-ignore
    queueObject.enqueue(() => sendTxWebhook(txId, site, rpcName));
    queueObject.on("reject", error => {});
    queueObject.on("resolve", data => {});
}
