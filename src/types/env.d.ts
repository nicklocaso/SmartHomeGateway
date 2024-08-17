declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test' | 'staging';
    PORT?: string;
    MQTT_HOST: string;
    MQTT_USERNAME: string;
    MQTT_PASSWORD: string;
  }
}
