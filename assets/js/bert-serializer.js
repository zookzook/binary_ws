import * as bert from "./bert"

export function encode(msg, callback){
    let payload = [
        msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload
    ];
    return callback(JSON.stringify(payload))
}

export function decode(rawPayload, callback) {
    let [join_ref, ref, topic, event, payload] = bert.decode(rawPayload);
    return callback({join_ref, ref, topic, event, payload})
}
