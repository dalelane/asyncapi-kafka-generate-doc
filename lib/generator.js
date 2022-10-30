const { Kafka, logLevel } = require('kafkajs');
const GenerateSchema = require('generate-schema');
const jsonSchemaCompare = require('json-schema-compare');

// skeleton AsyncAPI document ready for filling in
const template = require('./template.json');



async function generateAsyncApi(kafkaAttrs) {
    // start from template document
    const doc = { ...template };

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
        addSecurityScheme(gen, 'X509');
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
        title: 'title for message ' + idx,
        summary: 'add a summary of the message here',
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
        const consumer = createConsumer(kafkaAttrs);

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

                // to avoid adding duplicates to the AsyncAPI doc that
                //  we generate, we maintain a list of schemas we've
                //  already added to the doc
                const jsonSchemas = [];

                return consumer.run({
                    autoCommit: false,
                    eachMessage: async ({ message }) => {
                        // display progress for topics with a lot of messages
                        process.stdout.write('.');

                        // we disconnect after we stop seeing new
                        //  messages arrive - so reset the timer
                        //  on every new message
                        clearTimeout(disconnectTimer);

                        // generate a schema for the received message
                        const messageString = message.value.toString();
                        const schema = generateJsonSchema('schema', messageString);
                        if (schema) {
                            // have we seen a message like this before?
                            //  this is a new schema if it's the first schema we've generated
                            //  or if it's different to every schema we've seen before
                            const newSchema = jsonSchemas.length === 0 || false === jsonSchemas.some((previousSchema) => {
                                const isEqual = jsonSchemaCompare(previousSchema, schema);
                                return isEqual;
                            });

                            if (newSchema) {
                                // add it to list we've seen before
                                jsonSchemas.push(schema);

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

                            console.log('');
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


function createConsumer(kafkaAttrs) {
    const kafka = new Kafka({
        clientId: 'async-api-generator',
        brokers: kafkaAttrs.brokers,
        logLevel: logLevel.WARN,
        ssl: kafkaAttrs.ssl,
        sasl: kafkaAttrs.sasl,
    });

    return kafka.consumer({ groupId: 'schema-gen' });
}



module.exports = {
    generateAsyncApi
};
