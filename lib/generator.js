const fs = require('fs/promises');
const { ConfigResourceTypes } = require('kafkajs');
const GenerateSchema = require('generate-schema');
const comparator = require('./comparator');

const kafkaCluster = require('./cluster');




async function generateAsyncApi(kafkaAttrs) {
    // start from template document
    const template = await fs.readFile('./lib/template.json');
    const doc = JSON.parse(template);

    // add connection info
    doc.servers.kafka.url = kafkaAttrs.brokers[0];

    // add security info
    addSecurityInfo(doc, kafkaAttrs);

    // add message schemas generated using
    //  messages retrieved from Kafka
    await addMessageSchemas(doc, kafkaAttrs);

    // replace PLACEHOLDER with the topic name
    doc.channels[kafkaAttrs.topic] = doc.channels.PLACEHOLDER;
    delete doc.channels.PLACEHOLDER;

    // add topic description
    await addTopicMetadata(doc, kafkaAttrs);

    // finished!
    return doc;
}


function addSecurityInfo(doc, kafkaAttrs) {
    if (kafkaAttrs.ssl && kafkaAttrs.sasl) {
        doc.servers.kafka.protocol = 'kafka-secure';
        addSasl(doc, kafkaAttrs);
    }
    else if (kafkaAttrs.sasl) {
        doc.servers.kafka.protocol = 'kafka';
        addSasl(doc, kafkaAttrs);
    }
    else if (kafkaAttrs.ssl) {
        doc.servers.kafka.protocol = 'kafka-secure';
        addSecurityScheme(doc, 'X509');
    }
    else {
        doc.servers.kafka.protocol = 'kafka';
    }
}


function addSecurityScheme(doc, type) {
    doc.components.securitySchemes = {
        kafkaSecurity: { type }
    };
    doc.servers.kafka.security = [
        { kafkaSecurity: [] }
    ];
}


function addSasl(doc, kafkaAttrs) {
    const SASL_MECHANISM_TO_SECURITY_SCHEME = {
        'PLAIN': 'plain',
        'SCRAM-SHA-256': 'scramSha256',
        'SCRAM-SHA-512': 'scramSha512',
        'OAUTHBEARER': 'oauth2',
        'GSSAPI': 'gssapi'
    };

    const saslMechanism = kafkaAttrs.sasl.mechanism || 'PLAIN';
    const scheme = saslMechanism.toUpperCase() in SASL_MECHANISM_TO_SECURITY_SCHEME ?
        SASL_MECHANISM_TO_SECURITY_SCHEME[saslMechanism.toUpperCase()] :
        'unknown';

    addSecurityScheme(doc, scheme);
}


function addMessageSchema(doc, idx, messageString, schema) {
    const name = 'message' + idx;
    const message = {
        name,
        title: 'title for message ' + idx + ' - update this',
        summary: 'summary of the message - update this',
        contentType: 'application/json',
        payload: {
            $ref: '#/components/schemas/' + name
        },
        examples: [
            {
                name: 'example',
                payload: JSON.parse(messageString)
            }
        ]
    };

    doc.components.schemas[name] = schema;
    doc.components.messages[name] = message;
    doc.channels.PLACEHOLDER.publish.message.oneOf.push({
        $ref: '#/components/messages/' + name
    });
    doc.channels.PLACEHOLDER.subscribe.message.oneOf.push({
        $ref: '#/components/messages/' + name
    });
}


function generateJsonSchema(title, messageString) {
    try {
        return GenerateSchema.json(title, JSON.parse(messageString));
    }
    catch (err) {
        console.log(err);
    }
    return;
}


function addMessageSchemas(doc, kafkaAttrs) {
    return new Promise((resolve, reject) => {
        const consumer = kafkaCluster.createConsumer(kafkaAttrs);

        consumer.connect()
            .then(() => {
                return consumer.subscribe({
                    topic: kafkaAttrs.topic,
                    fromBeginning: true
                });
            })
            .then(() => {
                let disconnectTimer;
                let messageIndex = 1;

                comparator.init();

                return consumer.run({
                    autoCommit: false,
                    eachMessage: async ({ message }) => {
                        // we disconnect after we stop seeing new
                        //  messages arrive - so reset the timer
                        //  on every new message
                        clearTimeout(disconnectTimer);

                        // generate a schema for the received message
                        console.log(message);
                        const messageString = message.value.toString();
                        const schema = generateJsonSchema('schema', messageString);
                        if (schema) {
                            if (comparator.isNew(schema)) {
                                // add it to the AsyncAPI doc
                                addMessageSchema(doc, messageIndex++, messageString, schema);
                            }
                            // else {
                            //     // ignoring as we've already added a schema
                            //     //  that would've suited this message to
                            //     //  the AsyncAPI doc
                            // }
                        }
                        // else {
                        //     // we couldn't generate a JSON schema for this message
                        // }


                        // restart the disconnect timer so we will stop if we
                        //  don't get any new messages after waiting for two
                        //  seconds
                        disconnectTimer = setTimeout(() => {
                            consumer.disconnect();
                            resolve();
                        }, 2000);
                    }
                });
            })
            .catch((err) => {
                reject(err);
            });
    });
}



function addTopicMetadata(doc, kafkaAttrs) {
    const topicname = kafkaAttrs.topic;
    doc.channels[topicname].publish.operationId = 'publish' + topicname;
    doc.channels[topicname].subscribe.operationId = 'subscribe' + topicname;

    const admin = kafkaCluster.createAdmin(kafkaAttrs);
    return admin.fetchTopicMetadata({ topics: [ topicname ] })
        .then((resp) => {
            const partitions = resp.topics[0].partitions.length;
            const replicas = resp.topics[0].partitions[0].replicas.length

            doc.channels[topicname].bindings.kafka.partitions = partitions;
            doc.channels[topicname].bindings.kafka.replicas = replicas;

            return admin.describeConfigs({
                includeSynonyms: false,
                resources: [{
                    type: ConfigResourceTypes.TOPIC,
                    name: topicname,
                    configNames: [
                        'cleanup.policy',
                        'retention.ms',
                        'retention.bytes',
                        'delete.retention.ms',
                        'max.message.bytes',
                    ]
                }]
            });
        })
        .then((resp) => {
            for (const config of resp.resources[0].configEntries) {
                doc.channels[topicname].bindings.kafka.topicConfiguration[config.configName] = config.configValue;
            }

            return admin.disconnect();
        });
}




module.exports = {
    generateAsyncApi
};

