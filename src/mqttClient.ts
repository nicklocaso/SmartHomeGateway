import mqtt from 'mqtt';
import { Action, DeviceIntegration, Update } from './deviceIntegration';

export type MqttClientParameters = {
  mqttHost: string;
  mqttUsername: string;
  mqttPassword: string;

  integrations: Array<DeviceIntegration>;

  logger?: typeof console;
};

type EnhancedAction = Action & { integrationName: string };
type EnhancedUpdate = Update & { integrationName: string };

export function startMQTTClient(parameters: MqttClientParameters): void {
  const { mqttHost, mqttUsername, mqttPassword, integrations, logger } = parameters;

  if (integrations.length === 0) throw new Error('No one integrations is installed');

  const topics: { [key: Action['topic']]: EnhancedAction } = {};
  const updates: EnhancedUpdate[] = [];
  for (const integration of integrations) {
    for (const action of integration.getActions()) {
      if (!action.inactive) {
        logger?.log(`${integration.name}: Registro il topic ${action.topic}`);
        topics[action.topic] = { ...action, integrationName: integration.name };
      } else {
        logger?.log(`Il topic ${action.topic} è disattivato dall'integrazione`);
      }
    }
    if (integration.getUpdates().length !== 0) {
      logger?.log(`${integration.name}: Registro ${integration.getUpdates().length} updates`);
      updates.push(
        ...integration.getUpdates().map((i) => {
          return { ...i, integrationName: integration.name };
        })
      );
    } else {
      logger?.log(`${integration.name}: Non ci sono updates da registrare`);
    }
  }

  const client = mqtt.connect(mqttHost, {
    username: mqttUsername,
    password: mqttPassword
  });

  client.on('connect', () => {
    console.log(`Connesso a MQTT broker ${mqttHost}`);
    for (const topic in topics) {
      const action = topics[topic];
      logger?.log(`Mi sottoscrivo al topic ${action.topic}`);
      client.subscribe(action.topic);
    }
    for (const update of updates) {
      const _update = () => {
        logger?.log(`Eseguo l'update di ${update.integrationName}`);
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
    logger?.log(`Ricevuto messaggio su topic ${incomingTopic}: ${payload}`);

    const action = topics[incomingTopic];

    if (action) {
      logger?.log(`Richiamo ${incomingTopic} di ${action.integrationName}`);
      try {
        action.callback(payload);
      } catch (error) {
        logger?.error(error);
      }
    } else {
      logger?.log(`Topic ${incomingTopic} non riconosciuto`);
    }
  });

  client.on('error', (err) => {
    console.error(`Errore del client MQTT: ${err}`);
  });
}
