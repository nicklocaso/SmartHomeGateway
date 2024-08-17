import axios from 'axios';
import crypto from 'crypto';
import up from 'unixpass';
import {
  DeviceIntegration,
  DeviceIntegrationParameters,
  SetupParameters
} from '../deviceIntegration';

export class GLiNet extends DeviceIntegration {
  logger: DeviceIntegrationParameters['logger'];

  host: string;
  username: string;
  password: string;

  constructor(parameters: DeviceIntegrationParameters) {
    super();
    this.logger = parameters.logger;
    if (
      process.env.GLiNET_HOST === undefined ||
      process.env.GLiNET_USERNAME === undefined ||
      process.env.GLiNET_PASSWORD === undefined
    )
      throw new Error('GLiNET configuration is missing in environment variables');
    this.host = process.env.GLiNET_HOST;
    this.username = process.env.GLiNET_USERNAME;
    this.password = process.env.GLiNET_PASSWORD;
  }

  getTopics(): Array<String> {
    return [
      // Custom
      'home/glinet/wifi/set_enable',
      'home/glinet/wifi/status',
      // Default
      'home/glinet/system/get_status',
      'home/glinet/tailscale/get_status',
      'home/glinet/tailscale/set_config',
      'home/glinet/wifi/get_status',
      'home/glinet/wifi/get_config',
      'home/glinet/wifi/set_config'
    ];
  }

  setup(parameters: SetupParameters): void {
    const { client } = parameters;

    const updateWifiStatus = async () => {
      const wifiStatus = await GLiNet.handleRequest(
        this.host,
        this.username,
        this.password,
        'call',
        ['wifi', 'get_config']
      );

      const wifiStatus2G = wifiStatus.result.res
        .find((e: { device: string }) => e.device === 'radio0')
        .ifaces.find((e: { name: string }) => e.name === 'default_radio0');

      const wifiStatus5G = wifiStatus.result.res
        .find((e: { device: string }) => e.device === 'radio1')
        .ifaces.find((e: { name: string }) => e.name === 'default_radio1');

      const wifi2GState = {
        state: wifiStatus2G.enabled ? 'ON' : 'OFF',
        ssid: wifiStatus2G.ssid,
        encryption: wifiStatus2G.encryption,
        guest: wifiStatus2G.guest,
        hidden: wifiStatus2G.hidden
      };

      const wifi5GState = {
        state: wifiStatus5G.enabled ? 'ON' : 'OFF',
        ssid: wifiStatus5G.ssid,
        encryption: wifiStatus5G.encryption,
        guest: wifiStatus5G.guest,
        hidden: wifiStatus5G.hidden
      };

      client.publish('home/glinet/wifi_2g/status', JSON.stringify({ state: wifi2GState.state }));
      client.publish('home/glinet/wifi_2g/attributes', JSON.stringify(wifi2GState));
      this.logger.log(JSON.stringify(wifi2GState, null, 2));

      client.publish('home/glinet/wifi_5g/status', JSON.stringify({ state: wifi5GState.state }));
      client.publish('home/glinet/wifi_5g/attributes', JSON.stringify(wifi5GState));
      this.logger.log(JSON.stringify(wifi5GState, null, 2));

      this.logger.log('Stato Wi-Fi aggiornato e pubblicato su MQTT');
    };

    updateWifiStatus();

    setInterval(updateWifiStatus, 30000);
  }

  static async handleRequest(
    host: string,
    username: string,
    password: string,
    method: string,
    params: string[]
  ) {
    try {
      const challengeResponse = await axios.post(`http://${host}/rpc`, {
        jsonrpc: '2.0',
        method: 'challenge',
        params: { username: username },
        id: 0
      });

      const salt = challengeResponse.data.result.salt;
      const nonce = challengeResponse.data.result.nonce;
      const alg = challengeResponse.data.result.alg;

      const cipherPassword = up.crypt(password, `$${alg}$${salt}$`);

      const hash = crypto
        .createHash('md5')
        .update(`${username}:${cipherPassword}:${nonce}`)
        .digest('hex');

      const loginResponse = await axios.post(`http://${host}/rpc`, {
        jsonrpc: '2.0',
        method: 'login',
        params: { username: username, hash: hash },
        id: 0
      });

      const sid = loginResponse.data.result.sid;

      const response = await axios.post(`http://${host}/rpc`, {
        jsonrpc: '2.0',
        method,
        params: [sid, ...params],
        id: 0
      });

      console.log(JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error) {
      console.error('Errore:', error);
    }
  }
}
