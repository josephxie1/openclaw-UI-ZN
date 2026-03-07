import { B as hasNodeErrorCode, H as isPathInside, I as sameFileIdentity, U as isSymlinkOpenError, V as isNotFoundPathError } from "./agent-scope-DbrWek9X.js";
import { l as expandHomePrefix } from "./paths-DpzIdlnz.js";
import { n as assertNoPathAliasEscape } from "./path-alias-guards-DBV4qA5K.js";
import path from "node:path";
import { constants } from "node:fs";
import os from "node:os";
import fs from "node:fs/promises";

//#region src/infra/fs-safe.ts
var SafeOpenError = class extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.code = code;
		this.name = "SafeOpenError";
	}
};
const SUPPORTS_NOFOLLOW = process.platform !== "win32" && "O_NOFOLLOW" in constants;
const OPEN_READ_FLAGS = constants.O_RDONLY | (SUPPORTS_NOFOLLOW ? constants.O_NOFOLLOW : 0);
const OPEN_WRITE_EXISTING_FLAGS = constants.O_WRONLY | (SUPPORTS_NOFOLLOW ? constants.O_NOFOLLOW : 0);
const OPEN_WRITE_CREATE_FLAGS = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (SUPPORTS_NOFOLLOW ? constants.O_NOFOLLOW : 0);
const ensureTrailingSep = (value) => value.endsWith(path.sep) ? value : value + path.sep;
async function expandRelativePathWithHome(relativePath) {
	let home = process.env.HOME || process.env.USERPROFILE || os.homedir();
	try {
		home = await fs.realpath(home);
	} catch {}
	return expandHomePrefix(relativePath, { home });
}
async function openVerifiedLocalFile(filePath, options) {
	try {
		if ((await fs.lstat(filePath)).isDirectory()) throw new SafeOpenError("not-file", "not a file");
	} catch (err) {
		if (err instanceof SafeOpenError) throw err;
	}
	let handle;
	try {
		handle = await fs.open(filePath, OPEN_READ_FLAGS);
	} catch (err) {
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "file not found");
		if (isSymlinkOpenError(err)) throw new SafeOpenError("symlink", "symlink open blocked", { cause: err });
		if (hasNodeErrorCode(err, "EISDIR")) throw new SafeOpenError("not-file", "not a file");
		throw err;
	}
	try {
		const [stat, lstat] = await Promise.all([handle.stat(), fs.lstat(filePath)]);
		if (lstat.isSymbolicLink()) throw new SafeOpenError("symlink", "symlink not allowed");
		if (!stat.isFile()) throw new SafeOpenError("not-file", "not a file");
		if (options?.rejectHardlinks && stat.nlink > 1) throw new SafeOpenError("invalid-path", "hardlinked path not allowed");
		if (!sameFileIdentity(stat, lstat)) throw new SafeOpenError("path-mismatch", "path changed during read");
		const realPath = await fs.realpath(filePath);
		const realStat = await fs.stat(realPath);
		if (options?.rejectHardlinks && realStat.nlink > 1) throw new SafeOpenError("invalid-path", "hardlinked path not allowed");
		if (!sameFileIdentity(stat, realStat)) throw new SafeOpenError("path-mismatch", "path mismatch");
		return {
			handle,
			realPath,
			stat
		};
	} catch (err) {
		await handle.close().catch(() => {});
		if (err instanceof SafeOpenError) throw err;
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "file not found");
		throw err;
	}
}
async function resolvePathWithinRoot(params) {
	let rootReal;
	try {
		rootReal = await fs.realpath(params.rootDir);
	} catch (err) {
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "root dir not found");
		throw err;
	}
	const rootWithSep = ensureTrailingSep(rootReal);
	const expanded = await expandRelativePathWithHome(params.relativePath);
	const resolved = path.resolve(rootWithSep, expanded);
	if (!isPathInside(rootWithSep, resolved)) throw new SafeOpenError("outside-workspace", "file is outside workspace root");
	return {
		rootReal,
		rootWithSep,
		resolved
	};
}
async function openFileWithinRoot(params) {
	const { rootWithSep, resolved } = await resolvePathWithinRoot(params);
	let opened;
	try {
		opened = await openVerifiedLocalFile(resolved);
	} catch (err) {
		if (err instanceof SafeOpenError) {
			if (err.code === "not-found") throw err;
			throw new SafeOpenError("invalid-path", "path is not a regular file under root", { cause: err });
		}
		throw err;
	}
	if (params.rejectHardlinks !== false && opened.stat.nlink > 1) {
		await opened.handle.close().catch(() => {});
		throw new SafeOpenError("invalid-path", "hardlinked path not allowed");
	}
	if (!isPathInside(rootWithSep, opened.realPath)) {
		await opened.handle.close().catch(() => {});
		throw new SafeOpenError("outside-workspace", "file is outside workspace root");
	}
	return opened;
}
async function readFileWithinRoot(params) {
	const opened = await openFileWithinRoot({
		rootDir: params.rootDir,
		relativePath: params.relativePath,
		rejectHardlinks: params.rejectHardlinks
	});
	try {
		return await readOpenedFileSafely({
			opened,
			maxBytes: params.maxBytes
		});
	} finally {
		await opened.handle.close().catch(() => {});
	}
}
async function readPathWithinRoot(params) {
	const rootDir = path.resolve(params.rootDir);
	const candidatePath = path.isAbsolute(params.filePath) ? path.resolve(params.filePath) : path.resolve(rootDir, params.filePath);
	return await readFileWithinRoot({
		rootDir,
		relativePath: path.relative(rootDir, candidatePath),
		rejectHardlinks: params.rejectHardlinks,
		maxBytes: params.maxBytes
	});
}
function createRootScopedReadFile(params) {
	const rootDir = path.resolve(params.rootDir);
	return async (filePath) => {
		return (await readPathWithinRoot({
			rootDir,
			filePath,
			rejectHardlinks: params.rejectHardlinks,
			maxBytes: params.maxBytes
		})).buffer;
	};
}
async function readLocalFileSafely(params) {
	const opened = await openVerifiedLocalFile(params.filePath);
	try {
		return await readOpenedFileSafely({
			opened,
			maxBytes: params.maxBytes
		});
	} finally {
		await opened.handle.close().catch(() => {});
	}
}
async function readOpenedFileSafely(params) {
	if (params.maxBytes !== void 0 && params.opened.stat.size > params.maxBytes) throw new SafeOpenError("too-large", `file exceeds limit of ${params.maxBytes} bytes (got ${params.opened.stat.size})`);
	return {
		buffer: await params.opened.handle.readFile(),
		realPath: params.opened.realPath,
		stat: params.opened.stat
	};
}
async function writeFileWithinRoot(params) {
	const { rootReal, rootWithSep, resolved } = await resolvePathWithinRoot(params);
	try {
		await assertNoPathAliasEscape({
			absolutePath: resolved,
			rootPath: rootReal,
			boundaryLabel: "root"
		});
	} catch (err) {
		throw new SafeOpenError("invalid-path", "path alias escape blocked", { cause: err });
	}
	if (params.mkdir !== false) await fs.mkdir(path.dirname(resolved), { recursive: true });
	let ioPath = resolved;
	try {
		const resolvedRealPath = await fs.realpath(resolved);
		if (!isPathInside(rootWithSep, resolvedRealPath)) throw new SafeOpenError("outside-workspace", "file is outside workspace root");
		ioPath = resolvedRealPath;
	} catch (err) {
		if (err instanceof SafeOpenError) throw err;
		if (!isNotFoundPathError(err)) throw err;
	}
	let handle;
	let createdForWrite = false;
	try {
		try {
			handle = await fs.open(ioPath, OPEN_WRITE_EXISTING_FLAGS, 384);
		} catch (err) {
			if (!isNotFoundPathError(err)) throw err;
			handle = await fs.open(ioPath, OPEN_WRITE_CREATE_FLAGS, 384);
			createdForWrite = true;
		}
	} catch (err) {
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "file not found");
		if (isSymlinkOpenError(err)) throw new SafeOpenError("invalid-path", "symlink open blocked", { cause: err });
		throw err;
	}
	let openedRealPath = null;
	try {
		const [stat, lstat] = await Promise.all([handle.stat(), fs.lstat(ioPath)]);
		if (lstat.isSymbolicLink() || !stat.isFile()) throw new SafeOpenError("invalid-path", "path is not a regular file under root");
		if (stat.nlink > 1) throw new SafeOpenError("invalid-path", "hardlinked path not allowed");
		if (!sameFileIdentity(stat, lstat)) throw new SafeOpenError("path-mismatch", "path changed during write");
		const realPath = await fs.realpath(ioPath);
		openedRealPath = realPath;
		const realStat = await fs.stat(realPath);
		if (!sameFileIdentity(stat, realStat)) throw new SafeOpenError("path-mismatch", "path mismatch");
		if (realStat.nlink > 1) throw new SafeOpenError("invalid-path", "hardlinked path not allowed");
		if (!isPathInside(rootWithSep, realPath)) throw new SafeOpenError("outside-workspace", "file is outside workspace root");
		if (!createdForWrite) await handle.truncate(0);
		if (typeof params.data === "string") await handle.writeFile(params.data, params.encoding ?? "utf8");
		else await handle.writeFile(params.data);
	} catch (err) {
		if (createdForWrite && err instanceof SafeOpenError && openedRealPath) await fs.rm(openedRealPath, { force: true }).catch(() => {});
		throw err;
	} finally {
		await handle.close().catch(() => {});
	}
}

//#endregion
export { readLocalFileSafely as a, readFileWithinRoot as i, createRootScopedReadFile as n, writeFileWithinRoot as o, openFileWithinRoot as r, SafeOpenError as t };