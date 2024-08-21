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
  protected name: string;
  protected version: string;
  protected logger: NonNullable<IntegrationParameters['logger']>;

  constructor(parameters: IntegrationParameters, name: string, version: string) {
    this.name = name;
    this.version = version;
    if (parameters.logger === undefined)
      throw new Error('GLiNET logger is missing in input variables');
    this.logger = parameters.logger;
  }

  abstract getActions(): Array<Action>;

  abstract getUpdates(): Array<Update>;

  getName() {
    return this.name;
  }

  getVersion() {
    return this.version;
  }
}
