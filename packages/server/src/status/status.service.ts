import {createEventStream} from "../util/eventStream";

import {StatusMessage} from "@sensor-sim/shared";

export const statusStream = createEventStream<StatusMessage>();
export let currentStatusMessage: StatusMessage = {type: "ping"};
statusStream.emit(() => currentStatusMessage);

export function sendStatusMessage(message: StatusMessage) {
  currentStatusMessage = message;
  statusStream.emit();
}



