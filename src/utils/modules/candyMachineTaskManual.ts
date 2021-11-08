import * as anchor from "@project-serum/anchor";
import {CandyMachineResolve} from "./baseCandyMachineTaskResolver";

export async function ManualRunner(taskId: number, wallet: anchor.Wallet, mintUrl: string, keys: Object){
    // @ts-ignore
    await CandyMachineResolve(taskId, wallet, mintUrl, keys.TO_MINT, keys.CMRPC, keys.CMCONFIG, keys.CMID, keys.CMSTART, keys.CMNETWORK, keys.CMTREASURY);
}

