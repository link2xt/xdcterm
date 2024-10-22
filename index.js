import { C } from "@deltachat/jsonrpc-client";
import { startDeltaChat } from "@deltachat/stdio-rpc-server";
import * as pty from "node-pty";
import { PassThrough } from "node:stream";

// Map from msgId to PTY process.
const ptys = {};

function spawnPty(dc, accountId, msgId) {
  console.log("Spawning new PTY");
  const ptyProcess = pty.spawn("bash", [], {
    name: "xterm-256color",
    cols: 80,
    rows: 30,
  });

  const pass = new PassThrough();

  // Single async loop to ensure there is only one `sendWebxdcRealtimeData` call at a time.
  (async () => {
    for await (const chunk of pass) {
      await dc.rpc.sendWebxdcRealtimeData(
        accountId,
        msgId,
        [0x4f].concat(Array.from(chunk)),
      );
    }
    // 'E' = exit
    await dc.rpc.sendWebxdcRealtimeData(accountId, msgId, [0x45]);
    pass.destroy();
  })();

  ptyProcess.onData((data) => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    pass.write(encoded);
  });
  ptyProcess.onExit(() => {
    pass.end();
  });

  ptys[msgId] = ptyProcess;
}

async function sendWebxdc(dc, accountId, chatId) {
  const webxdcMsgId = await dc.rpc.sendMsg(accountId, chatId, {
    text: "hi",
    file: "frontend/dist-release/xdcterm.xdc",
  });
  await dc.rpc.sendWebxdcRealtimeAdvertisement(accountId, webxdcMsgId);
  spawnPty(dc, accountId, webxdcMsgId);
}

async function main() {
  const dc = await startDeltaChat("deltachat-data", {});
  dc.on(
    "Info",
    (accountId, { msg }) => console.info(accountId, "[core:info]", msg),
  );
  dc.on(
    "Warning",
    (accountId, { msg }) => console.warn(accountId, "[core:warn]", msg),
  );
  dc.on(
    "Error",
    (accountId, { msg }) => console.error(accountId, "[core:error]", msg),
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
      webxdc_realtime_enabled: "1",
    });
    await dc.rpc.configure(accountId);
  }

  let xdctermChatId = await dc.rpc.getConfig(accountId, "ui.xdcterm_chat_id");
  if (xdctermChatId === null) {
    // Create new protected chat.
    const protect = true;
    xdctermChatId = await dc.rpc.createGroupChat(accountId, "XDCTerm", protect);
    await dc.rpc.setConfig(
      accountId,
      "ui.xdcterm_chat_id",
      String(xdctermChatId),
    );
  }
  xdctermChatId = Number(xdctermChatId);

  // Make sure the chat is promoted.
  const xdctermChatInfo = await dc.rpc.getBasicChatInfo(
    accountId,
    xdctermChatId,
  );
  if (xdctermChatInfo.isUnpromoted) {
    await dc.rpc.miscSendTextMessage(accountId, xdctermChatId, "Hello");
  }

  const qrCode =
    (await dc.rpc.getChatSecurejoinQrCodeSvg(accountId, xdctermChatId))[0];
  console.log(`Chat invitation: ${qrCode}`);

  const emitter = dc.getContextEvents(accountId);
  emitter.on("IncomingMsg", async ({ chatId, msgId }) => {
    if (chatId === xdctermChatId) {
      await sendWebxdc(dc, accountId, chatId);
    }
  });
  emitter.on("WebxdcRealtimeData", ({ msgId, data }) => {
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
