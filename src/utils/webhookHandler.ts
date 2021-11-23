import Queue from 'queue-promise';
import {WebhookUrl} from "./configLoader";
import got from "got";
import {sleep} from "./candy-machine";

const queueObject = new Queue({
    concurrent: 1,
    interval: 250
});

const sendTxWebhook = async(txId: String): Promise<void> => {
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
                        }
                    ]
                }
            ],
            "username": "AROX",
            "avatar_url": "https://cdn.discordapp.com/attachments/798873586705104936/912812500209270885/funlogo-01.png"
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

export const QueueWebhook = async(txId: String): Promise<void> => {
    queueObject.enqueue(() => sendTxWebhook(txId));
    queueObject.on("reject", error => {});
    queueObject.on("resolve", data => {});
}
