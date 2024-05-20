import { C } from "@deltachat/jsonrpc-client";
import { startDeltaChat } from "@deltachat/stdio-rpc-server";
import * as pty from "node-pty";

// Map from msgId to PTY process.
const ptys = {};

function spawnPty(dc, accountId, msgId) {
	console.log("Spawning new PTY");
	const ptyProcess = pty.spawn("bash", [], {
		name: "xterm-256color",
		cols: 80,
		rows: 30,
	});
	ptyProcess.onData(async (data) => {
		const encoder = new TextEncoder();
		const encoded = encoder.encode(data);
		await dc.rpc.sendWebxdcRealtimeData(
			accountId,
			msgId,
			[0x4f].concat(Array.from(encoded)),
		);
	});

	ptys[msgId] = ptyProcess;
}

async function main() {
	const dc = await startDeltaChat("deltachat-data", {});
	dc.on("Info", (accountId, { msg }) =>
		console.info(accountId, "[core:info]", msg),
	);
	dc.on("Warning", (accountId, { msg }) =>
		console.warn(accountId, "[core:warn]", msg),
	);
	dc.on("Error", (accountId, { msg }) =>
		console.error(accountId, "[core:error]", msg),
	);

	const accountIds = await dc.rpc.getAllAccountIds();
	let accountId;
	if (accountIds.length === 0) {
		console.log("Add new account");
		accountId = await dc.rpc.addAccount();
	} else {
		console.log("Using existing accounts");
		accountId = accountIds[0];
	}

	if (!(await dc.rpc.isConfigured(accountId))) {
		await dc.rpc.batchSetConfig(accountId, {
			addr: "changethisusername@nine.testrun.org",
			mail_pw: "SETTHISPASSWORD",
			bot: "1",
		});
		await dc.rpc.configure(accountId);
	}

	const emitter = dc.getContextEvents(accountId);
	emitter.on("IncomingMsg", async ({ chatId, msgId }) => {
		const chat = await dc.rpc.getBasicChatInfo(accountId, chatId);
		const webxdcMsgId = await dc.rpc.sendMsg(accountId, chatId, {
			text: "hi",
			file: "frontend/dist-release/xdcterm.xdc",
		});
		await dc.rpc.sendWebxdcRealtimeAdvertisement(accountId, webxdcMsgId);
		spawnPty(dc, accountId, webxdcMsgId);
	});
	emitter.on("WebxdcRealtimeData", async ({ msgId, data }) => {
		const binData = Uint8Array.from(data);
		if (binData[0] == 0x49) {
			// 0x49 = 'I' = INPUT
			const ptyProcess = ptys[msgId];
			ptyProcess.write(binData.slice(1));
		} else {
			console.log("Ignoring incoming data that is not input.");
		}
	});

	await dc.rpc.startIo(accountId);
}

main();
