import {createEventStream, EventStream} from "../util/eventStream";

import {StatusMessage} from "@sensor-sim/shared";

// one stream per user: configs are owner-scoped, so a change only concerns its owner's clients.
// Entries are never removed — at most one small stream per user that ever connected or changed a config.
const statusStreams = new Map<number, EventStream<StatusMessage>>();

export function getStatusStream(userId: number): EventStream<StatusMessage> {
  let stream = statusStreams.get(userId);
  if (!stream) {
    stream = createEventStream<StatusMessage>();
    stream.emit({type: "ping"});
    statusStreams.set(userId, stream);
  }
  return stream;
}

export function sendStatusMessage(userId: number, message: StatusMessage) {
  getStatusStream(userId).emit(message);
}
