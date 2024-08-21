import axios from 'axios';
import crypto from 'crypto';
import up from 'unixpass';
import { Action, Integration, IntegrationParameters, Update } from '../integration';

export class GLiNet extends Integration {
  static async getSessionId(host: string, username: string, password: string) {
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

    return loginResponse.data.result.sid;
  }

  static async handleRequest(host: string, sid: string, method: string, params: string[]) {
    const response = await axios.post(`http://${host}/rpc`, {
      jsonrpc: '2.0',
      method,
      params: [sid, ...params],
      id: 0
    });

    return response.data;
  }

  private host: string;
  private username: string;
  private password: string;
  private sid: string = '';
  private sidPromise: Promise<void> | null = null;

  constructor(parameters: IntegrationParameters) {
    super(parameters, 'GLiNet', '1.0.0');
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
    const generateAction = (
      arg0: string,
      arg1: string,
      updates?: string[],
      inactive?: boolean
    ): Action => {
      return {
        topic: `home/glinet/${arg0}/${arg1}`,
        callback: (payload) => {
          const params = [arg0, arg1];
          if (payload) {
            params.push(JSON.parse(payload));
          }
          return this.makeRequest('call', params);
        },
        updates,
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
              requests.push(this.makeRequest('call', ['wifi', 'set_config', iface]));
            }
          }
          return Promise.all(requests);
        }
      },
      generateAction('system', 'get_status'),
      generateAction('tailscale', 'get_status'),
      generateAction('tailscale', 'set_config', ['tailscale_status']),
      generateAction('wifi', 'get_status'),
      generateAction('wifi', 'get_config'),
      generateAction('wifi', 'set_config', ['wifi_status'])
    ];
  }

  getUpdates(): Array<Update> {
    return [
      {
        id: 'wifi_status',
        description: '',
        update: async (publish) => {
          {
            const wifiStatus = await this.makeRequest('call', ['wifi', 'get_config']);

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
            this.logger.log('home/glinet/wifi_2g/attributes', JSON.stringify(wifi2GState, null, 2));

            publish('home/glinet/wifi_5g/status', JSON.stringify({ state: wifi5GState.state }));
            publish('home/glinet/wifi_5g/attributes', JSON.stringify(wifi5GState));
            this.logger.log('home/glinet/wifi_5g/attributes', JSON.stringify(wifi5GState, null, 2));

            this.logger.log('Wi-Fi status updated and published on MQTT');
          }
        },
        ms: 60000
      },
      {
        id: 'tailscale_status',
        description: '',
        update: async (publish) => {
          {
            const tailscaleStatus = await this.makeRequest('call', ['tailscale', 'get_config']);

            const tailscaleState = {
              state: tailscaleStatus.result.enabled ? 'ON' : 'OFF',
              enabled: tailscaleStatus.result.enabled,
              lan_ip: tailscaleStatus.result.lan_ip,
              wan_enabled: tailscaleStatus.result.wan_enabled,
              lan_enabled: tailscaleStatus.result.lan_enabled
            };

            publish(
              'home/glinet/tailscale/status',
              JSON.stringify({ state: tailscaleState.state })
            );
            publish('home/glinet/tailscale/attributes', JSON.stringify(tailscaleState));
            this.logger.log(
              'home/glinet/tailscale/attributes',
              JSON.stringify(tailscaleState, null, 2)
            );

            this.logger.log('Tailscale status updated and published on MQTT');
          }
        },
        ms: 60000
      }
    ];
  }

  async makeRequest(method: string, params: string[], retry?: boolean): Promise<any> {
    const getSessionId = async () => {
      if (!this.sidPromise) {
        this.sidPromise = (async () => {
          this.sid = await GLiNet.getSessionId(this.host, this.username, this.password);
          this.logger.log('New session Id', this.sid);
          this.sidPromise = null;
        })();
      }
      await this.sidPromise;
    };

    if (!this.sid) await getSessionId();
    const response = await GLiNet.handleRequest(this.host, this.sid, method, params);
    if (response.error && response.error.code === -32000) {
      if (retry)
        throw new Error(
          'Session ID renewal failed. The request could not be completed successfully after retrying.'
        );
      getSessionId();
      return this.makeRequest(method, params, true);
    }

    return response;
  }
}
