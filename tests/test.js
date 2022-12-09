const generator = require('../lib/generator');
const assert = require('assert');
const sinon = require('sinon');
const kafkaCluster = require('../lib/cluster');
const mockKafkaCluster = require('./mockcluster');
const resources = require('./testdata.json');


describe('generator', function () {

    let consumerStub;
    let adminStub;
    before(() => {
        consumerStub = sinon.replace(kafkaCluster, 'createConsumer', sinon.fake(mockKafkaCluster.createConsumer));
        adminStub = sinon.replace(kafkaCluster, 'createAdmin', sinon.fake(mockKafkaCluster.createAdmin));
    });
    after(() => {
        sinon.restore();
    });


    describe('#generateAsyncApi()', function () {
        it('should generate expected AsyncAPI docs', async () => {
            const TEST_CLUSTER = {
                brokers: ['test-bootstrap.com:9092'],
                ssl: true,
                sasl: {
                    mechanism: 'scram-sha-512',
                    username: 'bob',
                    password: 'secret',
                }
            };

            const topicNames = Object.keys(resources);

            for (const topic of topicNames) {
                TEST_CLUSTER.topic = topic;
                const result = await generator.generateAsyncApi(TEST_CLUSTER);

                assert.deepStrictEqual(result, resources[topic].asyncapi);
            }
        });
    });
});