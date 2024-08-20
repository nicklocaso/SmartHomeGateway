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

const generateUpdate = (
  client: mqtt.MqttClient,
  update: EnhancedUpdate,
  logger?: MqttClientParameters['logger']
) => {
  return () => {
    logger?.log(`Executing update for ${update.integrationName}`);
    try {
      update.update(client.publish.bind(client));
    } catch (error) {
      logger?.error(error);
    }
  };
};

export function startMQTTClient(parameters: MqttClientParameters): void {
  const { mqttHost, mqttUsername, mqttPassword, integrations, logger } = parameters;

  if (integrations.length === 0) throw new Error('No integrations are installed');

  const topics: { [key: Action['topic']]: EnhancedAction } = {};
  let updates: { [key: Update['id']]: EnhancedUpdate } = {};
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
      updates = {
        ...updates,
        ...integration.getUpdates().reduce((acc: typeof updates, actual) => {
          acc[actual.id] = { ...actual, integrationName: integration.name };
          return acc;
        }, {})
      };
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
    for (const updateId in updates) {
      const update = updates[updateId];
      const updateFunction = generateUpdate(client, update, logger);
      updateFunction();
      setInterval(updateFunction, update.ms);
    }
  });

  client.on('message', async (incomingTopic, incomingMessage) => {
    const payload = incomingMessage?.toString();
    logger?.log(`Received message on topic ${incomingTopic}: ${payload}`);

    const action = topics[incomingTopic];

    if (action) {
      logger?.log(`Calling ${incomingTopic} of ${action.integrationName}`);
      try {
        logger?.log(await action.callback(payload));
        if (action.updates !== undefined && action.updates?.length !== 0) {
          for (const updateId of action.updates) {
            const update = updates[updateId];
            const updateFunction = generateUpdate(client, update, logger);
            updateFunction();
          }
        }
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
