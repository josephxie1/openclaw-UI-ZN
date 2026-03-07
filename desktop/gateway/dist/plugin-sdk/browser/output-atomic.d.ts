export declare function writeViaSiblingTempPath(params: {
    targetPath: string;
    writeTemp: (tempPath: string) => Promise<void>;
}): Promise<void>;
