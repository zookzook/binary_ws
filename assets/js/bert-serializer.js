import * as bert from "./bert"

export function decode(rawPayload, callback) {
    let [join_ref, ref, topic, event, payload] = bert.decode(rawPayload);
    return callback({join_ref, ref, topic, event, payload})
}
