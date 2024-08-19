import mqtt from 'mqtt';
import { Action, Integration, Update } from './integration';

export type MqttClientParameters = {
  mqttHost: string;
  mqttUsername: string;
  mqttPassword: string;

  integrations: Array<Integration>;

  logger?: typeof console;
};

type EnhancedAction = Action & { integrationName: string };
type EnhancedUpdate = Update & { integrationName: string };

export function startMQTTClient(parameters: MqttClientParameters): void {
  const { mqttHost, mqttUsername, mqttPassword, integrations, logger } = parameters;

  if (integrations.length === 0) throw new Error('No integrations are installed');

  const topics: { [key: Action['topic']]: EnhancedAction } = {};
  const updates: EnhancedUpdate[] = [];
  for (const integration of integrations) {
    for (const action of integration.getActions()) {
      if (!action.inactive) {
        logger?.log(`${integration.name}: Registering topic ${action.topic}`);
        topics[action.topic] = { ...action, integrationName: integration.name };
      } else {
        logger?.log(`The topic ${action.topic} is disabled by the integration`);
      }
    }
    if (integration.getUpdates().length !== 0) {
      logger?.log(`${integration.name}: Registering ${integration.getUpdates().length} updates`);
      updates.push(
        ...integration.getUpdates().map((i) => {
          return { ...i, integrationName: integration.name };
        })
      );
    } else {
      logger?.log(`${integration.name}: No updates to register`);
    }
  }

  const client = mqtt.connect(mqttHost, {
    username: mqttUsername,
    password: mqttPassword
  });

  client.on('connect', () => {
    logger?.log(`Connected to MQTT broker ${mqttHost}`);
    for (const topic in topics) {
      const action = topics[topic];
      logger?.log(`Subscribing to topic ${action.topic}`);
      client.subscribe(action.topic);
    }
    for (const update of updates) {
      const _update = () => {
        logger?.log(`Executing update for ${update.integrationName}`);
        try {
          update.update(client.publish.bind(client));
        } catch (error) {
          logger?.error(error);
        }
      };
      _update();
      setInterval(_update, update.ms);
    }
  });

  client.on('message', async (incomingTopic, incomingMessage) => {
    const payload = incomingMessage?.toString();
    logger?.log(`Received message on topic ${incomingTopic}: ${payload}`);

    const action = topics[incomingTopic];

    if (action) {
      logger?.log(`Calling ${incomingTopic} of ${action.integrationName}`);
      try {
        action.callback(payload);
      } catch (error) {
        logger?.error(error);
      }
    } else {
      logger?.log(`Topic ${incomingTopic} not recognized`);
    }
  });

  client.on('error', (err) => {
    logger?.error(`MQTT client error: ${err}`);
  });
}
