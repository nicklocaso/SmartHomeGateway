import { MqttClient } from 'mqtt/*';

export type DeviceIntegrationParameters = {
  logger: typeof console;
};

export type SetupParameters = {
  client: MqttClient;
};

export abstract class DeviceIntegration {
  abstract getTopics(): Array<String>;

  abstract setup(parameters: SetupParameters): void;
}
