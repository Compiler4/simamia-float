import path from "node:path";

import {
    access,
} from "node:fs/promises";

import {
    spawn,
} from "node:child_process";

const projectRoot =
    process.cwd();

const forwardedArguments =
    process.argv.slice(2);

const npx =
    process.platform ===
    "win32" ?
    "npx.cmd" :
    "npx";

function run(
    command,
    args,
    label,
) {
    return new Promise(
        (
            resolve,
            reject,
        ) => {
            console.log(
                "\n============================================================",
            );

            console.log(label);

            console.log(
                "============================================================",
            );

            const child =
                spawn(
                    command,
                    args, {
                        cwd: projectRoot,

                        env: process.env,

                        stdio: "inherit",

                        shell: false,
                    },
                );

            child.on(
                "error",
                reject,
            );

            child.on(
                "exit",
                (
                    code,
                    signal,
                ) => {
                    if (code === 0) {
                        resolve();

                        return;
                    }

                    reject(
                        new Error(
                            signal ?
                            `${label} stopped with signal ${signal}.` :
                            `${label} failed with exit code ${code}.`,
                        ),
                    );
                },
            );
        },
    );
}

async function exists(
    filePath,
) {
    try {
        await access(filePath);

        return true;
    } catch {
        return false;
    }
}

async function main() {
    await run(
        npx, [
            "--no-install",
            "prisma",
            "format",
        ],
        "1/6 Prisma format",
    );

    await run(
        npx, [
            "--no-install",
            "prisma",
            "validate",
        ],
        "2/6 Prisma validate",
    );

    await run(
        npx, [
            "--no-install",
            "prisma",
            "db",
            "push",
        ],
        "3/6 Push schema",
    );

    await run(
        npx, [
            "--no-install",
            "prisma",
            "generate",
        ],
        "4/6 Generate Prisma Client",
    );

    await run(
        process.execPath, [
            path.join(
                projectRoot,
                "scripts",
                "run-all-seeds.mjs",
            ),

            ...forwardedArguments,
        ],
        "5/6 Run every seed file",
    );

    const verifyScript =
        path.join(
            projectRoot,
            "prisma",
            "verify-seeded-data.ts",
        );

    if (
        await exists(
            verifyScript,
        )
    ) {
        await run(
            npx, [
                "--no-install",
                "tsx",
                verifyScript,
                ...forwardedArguments,
            ],
            "6/6 Verify seeded data",
        );
    } else {
        console.log(
            "\n6/6 Verification skipped: prisma/verify-seeded-data.ts was not found.",
        );
    }

    console.log(
        "\n============================================================",
    );

    console.log(
        "DATABASE SCHEMA AND ALL SEED FILES COMPLETED",
    );

    console.log(
        "============================================================",
    );
}

main().catch(
    (error) => {
        console.error(
            "\nDATABASE SETUP FAILED",
        );

        console.error(
            error instanceof Error ?
            error.message :
            error,
        );

        process.exit(1);
    },
);