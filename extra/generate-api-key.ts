import { Database } from "../backend/database";
import { R } from "redbean-node";
import { DockgeServer } from "../backend/dockge-server";
import { log } from "../backend/log";
import { parse } from "ts-command-line-args";
import { User } from "../backend/models/user";
import crypto from "crypto";

interface Arguments {
    username: string;
}

const main = async () => {
    try {
        // Parse arguments for this script
        const args = parse<Arguments>({
            username: String,
        }, {
            stopAtFirstUnknown: true,
            partial: true,
        });

        if (!args.username) {
            console.error("Usage: tsx extra/generate-api-key.ts --username <username>");
            process.exit(1);
        }

        // Remove --username and its value from process.argv so DockgeServer doesn't complain
        const newArgv = [];
        let skipNext = false;
        for (const arg of process.argv) {
            if (skipNext) {
                skipNext = false;
                continue;
            }
            if (arg === "--username") {
                skipNext = true;
                continue;
            }
            // Handle --username=value
            if (arg.startsWith("--username=")) {
                continue;
            }
            newArgv.push(arg);
        }
        process.argv = newArgv;

        const server = new DockgeServer();

        if (!args.username) {
            console.error("Usage: tsx extra/generate-api-key.ts --username <username>");
            process.exit(1);
        }

        console.log("Connecting to database...");
        await Database.init(server);

        const user = await R.findOne("user", " username = ? ", [
            args.username,
        ]) as User;

        if (!user) {
            console.error(`User ${args.username} not found.`);
            process.exit(1);
        }

        const apiKey = crypto.randomBytes(16).toString("hex");
        user.api_key = apiKey;
        await R.store(user);

        console.log(`API Key for ${args.username} generated successfully:`);
        console.log(apiKey);

    } catch (e) {
        if (e instanceof Error) {
            console.error(e.message);
        }
        process.exit(1);
    } finally {
        await Database.close();
    }
};

main();
