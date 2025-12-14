import { spawn } from "child_process";

export class ClineClient {

  async runTask(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("cline", ["run", "--non-interactive", "--prompt", prompt], {
        stdio: "inherit",
        shell: true,
      });

      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Cline exited with code ${code}`));
      });
    });
  }
}

export const clineClient = new ClineClient();
