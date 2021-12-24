import * as anchor from "@project-serum/anchor";
import {CandyMachineResolveV2} from "./cmResolverV2";

export async function ManualRunnerV2(taskId: number, wallet: anchor.Wallet, mintUrl: string, keys: Object){
    // @ts-ignore
    await CandyMachineResolveV2(taskId, wallet, keys.CMRPC, keys.CMID);
}
