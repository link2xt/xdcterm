# XDCTerm Demo

Terminal emulator WebXDC connected to pseudoterminal over realtime channel.

NOTE: this is not meant for production use but as a technology demo.
Use at your own risk.

## Building

Perform the following steps to build the frontend webxdc app:

    cd frontend
    npm install
    npm run build

This will build `frontend/dist-release/xdcterm.xdc`.

Then go back to the root repository and do the following:

- run the chat bot from the root repository directoy:

    npm install
    npm start

  and copy the "OPENPGP4FPR:" URL into your clipboard

- Got to a Delta chat app and the "QR" code scanning activity
  and use "paste from clipboard"

- wait for Delta Chat to successfully create an end-to-end encrypted
  chat with the bot

- say "hi" to the bot and click the returned "XDCTerm" frontend app

- start typing into the terminal



