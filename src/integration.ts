import { IClientPublishOptions, MqttClient, PacketCallback } from 'mqtt/*';

export type IntegrationParameters = {
  logger?: typeof console;
};

export type SetupParameters = {
  client: MqttClient;
};

export type Action = {
  topic: string;
  callback: (payload: string) => void;
  inactive?: boolean;
};

export type Update = {
  update: (publish: (topic: string, message: string | Buffer) => MqttClient) => void;
  ms: number;
  inactive?: boolean;
};

export abstract class Integration {
  abstract name: string;

  abstract getActions(): Array<Action>;

  abstract getUpdates(): Array<Update>;

  abstract setup(parameters: SetupParameters): void;
}
