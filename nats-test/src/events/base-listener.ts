import nats, { Message, Stan } from "node-nats-streaming";
import { randomBytes } from "crypto";
import { UserCreatedListener } from "./user-created-listener";
import { Subjects } from "./subjects";

interface Event {
     subject: Subjects;
     data: any;
}

export abstract class Listener<T extends Event> {
     abstract subject: T["subject"];
     abstract onMessage(data: T["data"], msg: Message): void;
     abstract queueGroupName: string;
     protected ackWait = 5 * 1000;
     private client: Stan;
     constructor(client: Stan) {
          this.client = client;
     }
     subscriptionOptions() {
          return this.client
               .subscriptionOptions()
               .setDeliverAllAvailable()
               .setManualAckMode(true)
               .setAckWait(this.ackWait)
               .setDurableName(this.queueGroupName);
     }
     listen() {
          const subsciption = this.client.subscribe(
               this.subject,
               this.queueGroupName,
               this.subscriptionOptions()
          );
          subsciption.on("message", (msg: Message) => {
               console.log(
                    `Recived message ${this.subject} / ${this.queueGroupName} `
               );
               const parsedData = this.parseMessage(msg);
               this.onMessage(parsedData, msg);
          });
     }
     parseMessage(msg: Message) {
          const data = msg.getData();
          return typeof data === "string"
               ? JSON.parse(data)
               : JSON.parse(data.toString("utf8"));
     }
}
