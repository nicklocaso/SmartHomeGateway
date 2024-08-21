import { IClientPublishOptions, MqttClient, PacketCallback } from 'mqtt/*';

export type IntegrationParameters = {
  logger?: typeof console;
};

export type Action = {
  topic: string;
  callback: (payload: string) => void;
  updates?: string[];
  inactive?: boolean;
};

export type Update = {
  id: string;
  description: string;
  update: (publish: (topic: string, message: string | Buffer) => MqttClient) => void;
  ms: number;
  inactive?: boolean;
};

export abstract class Integration {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract getActions(): Array<Action>;

  abstract getUpdates(): Array<Update>;

  getName() {
    return this.name;
  }
}
