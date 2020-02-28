# BinaryWs

This is a demo application for [Phoenix LiveView](https://github.com/phoenixframework/phoenix_live_view) that uses BERT (Binary ERlang Term) serialization instead of JSON serialization for server-client communication.

The basic idea is to use `:erlang.term_to_binary/1` and `:erlang.binary_to_term/2`, so that the serialization is done as fast as possible. The browser/client uses a BERT serializer in JavaScript instead of the `JSON.stringify()` and the `JSON.parse()` function. This is not as fast as the JSON serialization, but the server can use optimized functions (written in C) now. This reduces the load on the server and the client has to work a little more. As a result, the WebSocket message is processed faster and the server can handle more push events.

# What is to be done?

The client needs to configure the BERT serializer:

```javascript
import * as bs from "./bert-serializer"

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content");
let liveSocket = new LiveSocket("/live", Socket, {params: {_csrf_token: csrfToken}, encode: bs.encode, decode: bs.decode });

liveSocket.connect();
```

the `BERT-Serializer` encodes only the data types known in JSON:

* Strings
* Numbers (Integer, Floats)
* Arrays
* Maps
* `null`,  `undefined`

Other data types such as tuples are not expected.

The serialization for the websockets is configured at the 'endpoint' in case of the server:

```elixir
  socket "/live", Phoenix.LiveView.Socket,
         websocket: [
           connect_info: [session: @session_options],
           serializer:  [{BERTSerializer, "~> 2.0.0"}]
         ]
```

After the restart you should see the following message:

```elixir
[info] CONNECTED TO Phoenix.LiveView.Socket in 86µs
  Transport: :websocket
  Serializer: BERTSerializer
```

# Benchmark

Simple benchmarks have shown that encoding and decoding are 2 to 10 times faster. The bigger the push message, the greater the factor.

I have used the rainbow demo as an example. For this, 10 tabs were opened for each configuration (JSON vs BERT) and the FPS was set to 100.

JSON-Serializer:

* average 60MB memory usage
* output: about 2.4 MB 
* scheduler utilization:  20-30 %

![JSON-Serializer](https://github.com/zookzook/binary_ws/raw/master/json.png "JSON-Serializer")

Full-BERT-Serializer:

* Memory usage: about 54 MB
* Output: about 2.8 MB Output
* Scheduler utilization: 15-20 %

![BERT-Serializer](https://github.com/zookzook/binary_ws/raw/master/bert.png "BERT-Serializer")

## Security Concerns

The BERT format enables to encode anonymous functions and others, which can open up the server for remote code execution. To avoid this the BERT serialization is only used from server to client. The client sends JSON as usual. The server sends TERM instead of JSON. Running the same benchmark but now only used TERM from server to client:

Half-BERT-Serializer:

* Memory usage: about 56 MB
* Output: about 2.8 MB Output
* Scheduler utilization: 15-20 %

![HALF-BERT-Serializer](https://github.com/zookzook/binary_ws/raw/master/half-bert.png "BERT-Serializer")

We got nearly the same results as before.

## Sizes

The factor between the sizes of JSON and TERM depends on the content. If the content contains a lot of characters which need to be escapted then the factor `byte_size(TERM)/byte_size(JSON)` is < 1. With HTML you get a lot of `"` which need to be escaped, so the factor is usually <= 1.

 ## Credits
 
The JavaScript for encoding and decoding BERT is taken from https://github.com/synrc/n2o/blob/master/priv/bert.js and has been slightly modified.
