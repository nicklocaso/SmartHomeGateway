# Smart Home Gateway

Smart Home Gateway is a modular and extensible Node.js application designed to serve as a bridge between various smart home devices and an MQTT broker. The application integrates with multiple devices, handling device-specific logic and facilitating communication through a common protocol.

## Features

- **Modular Integration:** Easily add support for new devices with minimal changes to the core application.
- **MQTT Communication:** Supports the MQTT protocol for device communication.
- **Customizable:** Define custom actions and updates for each integrated device.
- **Extensible:** Add new device integrations by implementing a simple interface.

## Table of Contents

- [Installation](#installation)
- [Usage in Local](#usage-in-local)
- [Environment Variables](#environment-variables)
- [Device Integration](#device-integration)
- [Environment Variables](#environment-variables)

## Installation

1. **Clone the repository:**

```bash
git clone git@github.com:nicklocaso/SmartHomeGateway.git
cd SmartHomeGateway
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Configure environment variables:**

Create a .env file in the local/production directory and configure the necessary environment variables.

4. **Build the project:**

```bash
pnpm build
```

## Usage in Local

### Running the Gateway

Once the project is set up, you can start the gateway by running:

```bash
pnpm start:dev
```

The application will connect to the MQTT broker specified in the environment variables, subscribe to the relevant topics, and begin processing messages.

## Device Integration

To add a new device integration, create a new class that extends the Integration abstract class and implements the required methods (getActions, getUpdates, and setup). Then, add this new integration to the list of integrations when starting the MQTT client.

## Environment Variables

The application relies on several environment variables for configuration:

```env
MQTT_HOST: The MQTT broker host.
MQTT_USERNAME: The MQTT broker username.
MQTT_PASSWORD: The MQTT broker password.

GLINET_HOST: The IP address or hostname of the GL.iNet device.
GLINET_USERNAME: The username for the GL.iNet device.
GLINET_PASSWORD: The password for the GL.iNet device.
```

These variables should be defined in a .env file in the right environment folder
