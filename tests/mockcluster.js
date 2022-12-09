const resources = require('./testdata.json');
const sinon = require('sinon');


function doNothingAsync() {
    return Promise.resolve();
}

function createConsumer(kafkaAttrs) {
    return {
        connect : doNothingAsync,
        disconnect : doNothingAsync,
        subscribe : doNothingAsync,
        run : ((opts) => {
            const clock = sinon.useFakeTimers();
            resources[kafkaAttrs.topic].messages.forEach(async (message) => {
                await opts.eachMessage({message});
            });
            clock.tick(2000);
            clock.restore();
        })
    };
}

function createAdmin(kafkaAttrs) {
    return {
        disconnect : doNothingAsync,
        fetchTopicMetadata : (() => { return Promise.resolve(resources[kafkaAttrs.topic].topicMetadata); }),
        describeConfigs : (() => { return Promise.resolve(resources[kafkaAttrs.topic].configs); })
    };
}


module.exports = {
    createConsumer,
    createAdmin
};