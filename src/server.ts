import mqtt from 'mqtt';

const topics = [
  //
  'home/glinet/wifi/set_enable',
  'home/glinet/wifi/status',
  //
  'home/glinet/system/get_status',
  'home/glinet/tailscale/get_status',
  'home/glinet/tailscale/set_config',
  'home/glinet/wifi/get_status',
  'home/glinet/wifi/get_config',
  'home/glinet/wifi/set_config'
];

function startMQTTClient(mqttHost: string, mqttUsername: string, mqttPassword: string): void {
  const client = mqtt.connect(mqttHost, {
    username: mqttUsername,
    password: mqttPassword
  });

  client.on('connect', () => {
    console.log(`Connesso a MQTT broker ${mqttHost}`);
    for (const topic of topics) {
      client.subscribe(topic);
    }
  });

  client.on('message', (topic, message) => {
    const payload = message.toString();
    const requests = [];

    switch (topic) {
      case 'home/glinet/wifi/set_enable':
        if (payload) {
          const ifaces = JSON.parse(payload);
          for (const iface of ifaces) {
            requests.push({
              method: 'call',
              params: ['wifi', 'set_config', iface]
            });
          }
        }
        break;

      default:
        const topicRegex = /^home\/glinet\/([^\/]+)\/([^\/]+)$/;
        const match = topic.match(topicRegex);

        if (match) {
          const [_, argument_0, argument_1] = match;

          const request = {
            method: 'call',
            params: [argument_0, argument_1]
          };

          if (payload) {
            request.params.push(JSON.parse(payload));
          }

          requests.push(request);

          console.log(`Ricevuto messaggio su topic ${topic}: ${JSON.stringify(payload, null, 2)}`);
          for (const req of requests) {
            handleRequest(host, username, password, req.method, req.params);
          }
        } else {
          console.log(`Topic non riconosciuto: ${topic}`);
        }
        return;
    }

    console.log(`Ricevuto messaggio su topic ${topic}: ${payload}`);
    for (const request of requests) {
      handleRequest(host, username, password, request.method, request.params);
    }
  });

  client.on('error', (err) => {
    console.error(`Errore del client MQTT: ${err}`);
  });
}

const mqttHost = 'mqtt://mqtt_host.local';
const mqttUsername = 'mqttUsername';
const mqttPassword = 'mqttPassword';

startMQTTClient(mqttHost, mqttUsername, mqttPassword, host, username, password);
