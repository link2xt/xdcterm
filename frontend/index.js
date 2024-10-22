import { Terminal } from "@xterm/xterm";
import { IImageAddonOptions, ImageAddon } from "@xterm/addon-image";

const term = new Terminal({
  cols: 80,
  rows: 30,
});
const imageAddon = new ImageAddon({ sixelSupport: true });
term.loadAddon(imageAddon);

document.title = "Hi!";
term.onData((send) => {
  console.log("Sending realtime data");
  const encoder = new TextEncoder();
  const encoded = encoder.encode(send);
  const buf = new Uint8Array(1 + encoded.length);
  buf[0] = 0x49; // 'I' = INPUT
  buf.set(encoded, 1);
  realtime.send(buf);
});

term.onTitleChange((title) => {
  document.getElementById("terminal-title").textContent = title;
});

term.open(document.getElementById("terminal"));

function receiveUpdate(msg) {
  console.log(`Got update ${msg}`);
  if (msg[0] == 0x4f) {
    // 0x4f = 'O' = Output
    term.write(msg.slice(1));
  } else if (msg[0] == 0x45) {
    term.dispose();
  }
}

const realtime = window.webxdc.joinRealtimeChannel();
realtime.setListener(receiveUpdate);
