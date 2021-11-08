import colors from "colors";

export function log(status: { taskId: number | undefined; message: string; type: string }) {
    let message = status.message;
    let taskId;
    if(status.taskId == undefined){
        taskId = "";
    } else {
        taskId = "["+status.taskId.toString()+"] ";

    }
    if (status.type == 'success') {
        message = colors.green(taskId+message);
    } else if (status.type == 'error' || status.type == 'critical') {
        message = colors.red(taskId+message);
    } else if(status.type == 'info'){
        message = colors.yellow(taskId+message);
    }
    console.log(message);
}
