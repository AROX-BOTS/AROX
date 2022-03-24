import * as anchor from "@project-serum/anchor";
import {MagicEdenLaunchpadHandler} from "./baseMagicEdenLaunchpadHandler";

export async function MagicEdenLaunchpadTask(taskId: number, wallet: anchor.Wallet, keys: Object){
    // @ts-ignore
    await MagicEdenLaunchpadHandler(taskId, wallet, keys.CUSTOMRPC, keys.CONTRACT, keys.CUSTOMSTART);
}
