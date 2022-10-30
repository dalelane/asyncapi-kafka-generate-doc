# asyncapi-kafka-generate-doc

**Generate an AsyncAPI doc from the messages on an Apache Kafka topic**

_Treat this as an early alpha... at this point, it's just an idea that I'm playing around with. It's not ready for serious use yet._

This tool will connect to your Kafka cluster, consume every message on the topic, and generate an AsyncAPI doc that describes the connection details for the Kafka cluster, and the schema of all the messages on the topic.



## Usage

### Generate a JS representation of an AsyncAPI doc

```js
const generator = require('asyncapi-kafka-generate-doc');

const config = {
    brokers: [ 'localhost:9092' ],
    topic: 'MY.TOPIC'
};

const asyncApiDoc = await generator.generateAsyncApi(config);
```

`asyncApiDoc` will be a JS object representing an AsyncAPI document.

### Generate an AsyncAPI document file

To generate an AsyncAPI document and write it to a file in a traditional YAML format, you could do something like:

```js
const generator = require('asyncapi-kafka-generate-doc');
const yaml = require('js-yaml');
const fs = require('fs/promises');


const config = {
    brokers: [ 'localhost:9092' ],
    topic: 'MY.TOPIC'
};

const asyncApiDoc = await generator.generateAsyncApi(config);
const asyncApiDocStr = yaml.dump(yaml.load(JSON.stringify(asyncApiDoc)));
await fs.writeFile('asyncapi.yaml', asyncApiDocStr);
```

### Connecting to secured Kafka clusters

You can add `sasl` and/or `ssl` attributes to the config object to connect to secured Kafka clusters.

For example:

```js
const config = {
    brokers: [ 'localhost:9092' ],
    topic: 'MY.TOPIC',
    ssl: {
        ca: [fs.readFileSync('/my/custom/ca.crt', 'utf-8')],
        key: fs.readFileSync('/my/custom/client-key.pem', 'utf-8'),
        cert: fs.readFileSync('/my/custom/client-cert.pem', 'utf-8')
    }
};

const asyncApiDoc = await generator.generateAsyncApi(config);
```

or

```js
const config = {
    brokers: [ 'localhost:9092' ],
    topic: 'MY.TOPIC',
    ssl: { rejectUnauthorized: false },
    sasl: {
        mechanism: 'scram-sha-512',
        username: 'app-username',
        password: 'app-password'
    }
};

const asyncApiDoc = await generator.generateAsyncApi(config);
```

Internally, the tool is using [KafkaJS](https://kafka.js.org) to consume messages from the Kafka topic. See https://kafka.js.org/docs/configuration#ssl and https://kafka.js.org/docs/configuration#sasl for documentation for the supported options.

