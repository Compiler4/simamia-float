import {
    access,
    readdir,
} from "node:fs/promises";

import path from "node:path";

import {
    spawn,
} from "node:child_process";

const projectRoot =
    process.cwd();

const prismaDirectory =
    path.join(
        projectRoot,
        "prisma",
    );

const forwardedArguments =
    process.argv.slice(2);

const preferredOrder = [
    "seed.ts",
    "seed-company-admin.ts",
    "seed-accountant-portal.ts",
    "seed-staff.ts",
    "seed-broker.ts",
    "seed-gps-manager.ts",
    "seed-super-admin.ts",
    "seed-developer.ts",
    "seed-data-folder.ts",
];

const optionalImportScripts = [
    "import-float-agents-json.ts",
    "import-bank-statement-json.ts",
];

function commandForScript(
    filePath,
) {
    const extension =
        path.extname(
            filePath,
        ).toLowerCase();

    if (
        [
            ".ts",
            ".mts",
            ".cts",
            ".tsx",
        ].includes(extension)
    ) {
        return {
            command: process.platform ===
                "win32" ?
                "npx.cmd" : "npx",

            args: [
                "--no-install",
                "tsx",
                filePath,
                ...forwardedArguments,
            ],
        };
    }

    return {
        command: process.execPath,

        args: [
            filePath,
            ...forwardedArguments,
        ],
    };
}

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

            console.log(
                `RUNNING: ${label}`,
            );

            console.log(
                "============================================================",
            );

            const child =
                spawn(
                    command,
                    args, {
                        cwd: projectRoot,

                        env: {
                            ...process.env,

                            SIMAMIA_SEED_RUNNER: "1",
                        },

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

async function fileExists(
    filePath,
) {
    try {
        await access(filePath);

        return true;
    } catch {
        return false;
    }
}

function orderSeedFiles(
    fileNames,
) {
    const preferredIndex =
        new Map(
            preferredOrder.map(
                (
                    name,
                    index,
                ) => [
                    name.toLowerCase(),
                    index,
                ],
            ),
        );

    return [
        ...fileNames,
    ].sort(
        (
            left,
            right,
        ) => {
            const leftIndex =
                preferredIndex.get(
                    left.toLowerCase(),
                ) ?
                Number.MAX_SAFE_INTEGER;

            const rightIndex =
                preferredIndex.get(
                    right.toLowerCase(),
                ) ?
                Number.MAX_SAFE_INTEGER;

            if (
                leftIndex !==
                rightIndex
            ) {
                return (
                    leftIndex -
                    rightIndex
                );
            }

            return left.localeCompare(
                right,
            );
        },
    );
}

async function discoverSeedFiles() {
    const entries =
        await readdir(
            prismaDirectory, {
                withFileTypes: true,
            },
        );

    return orderSeedFiles(
        entries
        .filter(
            (entry) =>
            entry.isFile(),
        )
        .map(
            (entry) =>
            entry.name,
        )
        .filter(
            (name) =>
            /^seed(?:-[a-z0-9_-]+)?\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/i.test(
                name,
            ),
        ),
    );
}

async function main() {
    const seedFiles =
        await discoverSeedFiles();

    if (
        seedFiles.length ===
        0
    ) {
        throw new Error(
            "No seed files were found. Expected prisma/seed.ts or prisma/seed-*.ts.",
        );
    }

    console.log(
        "Simamia Float unified database seeder",
    );

    console.log(
        `Project: ${projectRoot}`,
    );

    console.log(
        `Company argument: ${
      forwardedArguments[0] ??
      "not supplied"
    }`,
    );

    console.log(
        "\nSeed files:",
    );

    seedFiles.forEach(
        (
            file,
            index,
        ) => {
            console.log(
                `  ${
          index + 1
        }. prisma/${file}`,
            );
        },
    );

    for (
        const fileName
        of seedFiles
    ) {
        const filePath =
            path.join(
                prismaDirectory,
                fileName,
            );

        const execution =
            commandForScript(
                filePath,
            );

        await run(
            execution.command,
            execution.args,
            `prisma/${fileName}`,
        );
    }

    /*
     * When seed-data-folder.ts exists,
     * that file should import everything
     * stored under prisma/data.
     */
    const hasDataFolderSeed =
        seedFiles.some(
            (name) =>
            name.toLowerCase() ===
            "seed-data-folder.ts",
        );

    if (!hasDataFolderSeed) {
        for (
            const fileName
            of optionalImportScripts
        ) {
            const filePath =
                path.join(
                    prismaDirectory,
                    fileName,
                );

            if (!(
                    await fileExists(
                        filePath,
                    )
                )) {
                continue;
            }

            const execution =
                commandForScript(
                    filePath,
                );

            await run(
                execution.command,
                execution.args,
                `prisma/${fileName}`,
            );
        }
    }

    console.log(
        "\n============================================================",
    );

    console.log(
        "ALL SIMAMIA SEED FILES COMPLETED SUCCESSFULLY",
    );

    console.log(
        "============================================================",
    );
}

main().catch(
    (error) => {
        console.error(
            "\nSEED RUN FAILED",
        );

        console.error(
            error instanceof Error ?
            error.message :
            error,
        );

        process.exit(1);
    },
);