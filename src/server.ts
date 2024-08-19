import { GLiNet } from './devices/glinet';
import { startMQTTClient } from './mqttClient';

const logger = console;

if (
  process.env.MQTT_HOST === undefined ||
  process.env.MQTT_USERNAME === undefined ||
  process.env.MQTT_PASSWORD === undefined
)
  throw new Error('MQTT configuration is missing in environment variables');

const mqttHost = process.env.MQTT_HOST;
const mqttUsername = process.env.MQTT_USERNAME;
const mqttPassword = process.env.MQTT_PASSWORD;

startMQTTClient({
  mqttHost,
  mqttUsername,
  mqttPassword,
  integrations: [new GLiNet({ logger })],
  logger
});
