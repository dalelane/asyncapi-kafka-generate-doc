const { Kafka, logLevel } = require('kafkajs');


function kafkaConfig(kafkaAttrs) {
    return new Kafka({
        clientId: 'async-api-generator',
        brokers: kafkaAttrs.brokers,
        logLevel: logLevel.WARN,
        ssl: kafkaAttrs.ssl,
        sasl: kafkaAttrs.sasl,
    });
}


function createConsumer(kafkaAttrs) {
    const kafka = kafkaConfig(kafkaAttrs);
    return kafka.consumer({ groupId: 'schema-gen' });
}

function createAdmin(kafkaAttrs) {
    const kafka = kafkaConfig(kafkaAttrs);
    return kafka.admin();
}




module.exports = {
    createAdmin,
    createConsumer
};