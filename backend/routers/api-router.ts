import { DockgeServer } from "../dockge-server";
import { Router } from "../router";
import express, { Express, Router as ExpressRouter } from "express";
import { R } from "redbean-node";
import { User } from "../models/user";
import { Stack } from "../stack";
import { CREATED_STACK, EXITED, RUNNING, UNKNOWN } from "../../common/util-common";

export class ApiRouter extends Router {
    create(app: Express, server: DockgeServer): ExpressRouter {
        const router = express.Router();

        // Middleware for API Key Authentication
        router.use("/api/*", async (req, res, next) => {
            const apiKey = req.headers["x-api-key"];

            if (!apiKey || typeof apiKey !== "string") {
                res.status(401).json({
                    ok: false,
                    msg: "Missing or invalid x-api-key header",
                });
                return;
            }

            const user = await R.findOne("user", " api_key = ? AND active = 1 ", [
                apiKey,
            ]) as User;

            if (!user) {
                res.status(401).json({
                    ok: false,
                    msg: "Invalid API Key",
                });
                return;
            }

            next();
        });

        // Get Stacks
        router.get("/api/stacks", async (req, res) => {
            try {
                const stackList = await Stack.getStackList(server);

                const result = await Promise.all(Array.from(stackList.values()).map(async (stack) => {
                    const services = [];
                    const serviceStatusList = await stack.getServiceStatusList();

                    for (const [serviceName, status] of serviceStatusList) {
                        services.push({
                            name: serviceName,
                            ...status,
                        });
                    }

                    return {
                        name: stack.name,
                        status: this.statusToString(stack.status),
                        statusNum: stack.status,
                        isManagedByDockge: stack.isManagedByDockge,
                        composeFileName: stack.composeFileName,
                        services: services,
                    };
                }));

                res.json(result);
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.includes("spawn docker ENOENT")) {
                        res.json([]);
                        return;
                    }

                    res.status(500).json({
                        ok: false,
                        msg: e.message,
                    });
                } else {
                    res.status(500).json({
                        ok: false,
                        msg: "Unknown error",
                    });
                }
            }
        });

        // Get specific stack
        router.get("/api/stacks/:name", async (req, res) => {
            try {
                const stackName = req.params.name;
                const stack = await Stack.getStack(server, stackName);

                // Update status if needed
                await stack.updateStatus();

                // Get services status
                const services = [];
                const serviceStatusList = await stack.getServiceStatusList();

                for (const [serviceName, status] of serviceStatusList) {
                    services.push({
                        name: serviceName,
                        ...status,
                    });
                }

                res.json({
                    name: stack.name,
                    status: this.statusToString(stack.status),
                    statusNum: stack.status,
                    isManagedByDockge: stack.isManagedByDockge,
                    composeFileName: stack.composeFileName,
                    composeYAML: stack.composeYAML,
                    composeENV: stack.composeENV,
                    services: services,
                });

            } catch (e) {
                res.status(404).json({
                    ok: false,
                    msg: "Stack not found",
                });
            }
        });

        return router;
    }

    statusToString(status: number) {
        switch (status) {
            case RUNNING:
                return "active";
            case EXITED:
                return "exited";
            case CREATED_STACK:
                return "inactive";
            default:
                return "unknown";
        }
    }
}
