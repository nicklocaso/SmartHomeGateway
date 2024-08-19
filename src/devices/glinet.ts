import axios from 'axios';
import crypto from 'crypto';
import up from 'unixpass';
import {
  Action,
  DeviceIntegration,
  DeviceIntegrationParameters,
  SetupParameters,
  Update
} from '../deviceIntegration';

export class GLiNet extends DeviceIntegration {
  static async handleRequest(
    host: string,
    username: string,
    password: string,
    method: string,
    params: string[]
  ) {
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

    return response.data;
  }

  logger: NonNullable<DeviceIntegrationParameters['logger']>;

  name: string;
  host: string;
  username: string;
  password: string;

  constructor(parameters: DeviceIntegrationParameters) {
    super();
    this.name = 'GLiNet';
    if (parameters.logger === undefined)
      throw new Error('GLiNET logger is missing in input variables');
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

  getActions(): Array<Action> {
    const generateAction = (arg0: string, arg1: string, inactive?: boolean): Action => {
      return {
        topic: `home/glinet/${arg0}/${arg1}`,
        callback: (payload) => {
          const params = [arg0, arg1];
          if (payload) {
            params.push(JSON.parse(payload));
          }
          return this.handleRequest('call', params);
        },
        inactive
      };
    };
    return [
      {
        topic: 'home/glinet/wifi/set_enable',
        callback: (payload) => {
          const requests = [];
          if (payload) {
            const ifaces = JSON.parse(payload);
            for (const iface of ifaces) {
              requests.push(this.handleRequest('call', ['wifi', 'set_config', iface]));
            }
          }
          return Promise.all(requests);
        }
      },
      generateAction('system', 'get_status'),
      generateAction('tailscale', 'get_status'),
      generateAction('tailscale', 'set_config'),
      generateAction('wifi', 'get_status'),
      generateAction('wifi', 'get_config'),
      generateAction('wifi', 'set_config')
    ];
  }

  getUpdates(): Array<Update> {
    return [
      {
        update: async (publish) => {
          {
            const wifiStatus = await this.handleRequest('call', ['wifi', 'get_config']);

            const wifiStatus2G = wifiStatus.result.res
              .find(<Type extends { device: string }>(e: Type) => e.device === 'radio0')
              .ifaces.find(<Type extends { name: string }>(e: Type) => e.name === 'default_radio0');

            const wifiStatus5G = wifiStatus.result.res
              .find(<Type extends { device: string }>(e: Type) => e.device === 'radio1')
              .ifaces.find(<Type extends { name: string }>(e: Type) => e.name === 'default_radio1');

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

            publish('home/glinet/wifi_2g/status', JSON.stringify({ state: wifi2GState.state }));
            publish('home/glinet/wifi_2g/attributes', JSON.stringify(wifi2GState));
            this.logger.log(JSON.stringify(wifi2GState, null, 2));

            publish('home/glinet/wifi_5g/status', JSON.stringify({ state: wifi5GState.state }));
            publish('home/glinet/wifi_5g/attributes', JSON.stringify(wifi5GState));
            this.logger.log(JSON.stringify(wifi5GState, null, 2));

            this.logger.log('Wi-Fi status updated and published on MQTT');
          }
        },
        ms: 30000
      }
    ];
  }

  setup(parameters: SetupParameters): void {}

  async handleRequest(method: string, params: string[]) {
    return GLiNet.handleRequest(this.host, this.username, this.password, method, params);
  }
}
