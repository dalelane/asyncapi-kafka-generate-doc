const generator = require('../lib/generator');
const assert = require('assert');
const sinon = require('sinon');
const kafkaCluster = require('../lib/cluster');
const mockKafkaCluster = require('./mockcluster');
const resources = require('./testdata.json');


describe('generator', () => {

    let consumerStub;
    let adminStub;
    before(() => {
        consumerStub = sinon.replace(kafkaCluster, 'createConsumer', sinon.fake(mockKafkaCluster.createConsumer));
        adminStub = sinon.replace(kafkaCluster, 'createAdmin', sinon.fake(mockKafkaCluster.createAdmin));
    });
    after(() => {
        sinon.restore();
    });


    describe('#generateAsyncApi()', () => {
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

    describe('set security parameters', () => {
        const topic = 'FLIGHT.LANDINGS';
        const brokers = ['kafka-bootstrap:8092'];
        const username = 'myuser';
        const password = 'mypass';

        it('should recognise unauthenticated', async () => {
            const TEST_CLUSTER = {
                brokers, topic,
            };

            const result = await generator.generateAsyncApi(TEST_CLUSTER);
            assert.strictEqual(result.servers.kafka.protocol, 'kafka');
            assert.strictEqual('security' in result.servers.kafka, false);
            assert.strictEqual('securitySchemes' in result.components, false);
        });

        it('should recognise encrypted', async () => {
            const TEST_CLUSTER = {
                brokers, topic,
                ssl: { rejectUnauthorized: false },
            };

            const result = await generator.generateAsyncApi(TEST_CLUSTER);
            assert.strictEqual(result.servers.kafka.protocol, 'kafka-secure');
            assert.deepStrictEqual(result.servers.kafka.security, [{ kafkaSecurity: [] }]);
            assert.strictEqual(result.components.securitySchemes.kafkaSecurity.type, 'X509');
        });

        it('should recognise scram-sha-512', async () => {
            const TEST_CLUSTER = {
                brokers, topic,
                sasl: {
                    mechanism: 'scram-sha-512',
                    username, password,
                }
            };

            const result = await generator.generateAsyncApi(TEST_CLUSTER);
            assert.strictEqual(result.servers.kafka.protocol, 'kafka');
            assert.deepStrictEqual(result.servers.kafka.security, [{ kafkaSecurity: [] }]);
            assert.strictEqual(result.components.securitySchemes.kafkaSecurity.type, 'scramSha512');
        });

        it('should recognise plain', async () => {
            const TEST_CLUSTER = {
                brokers, topic,
                sasl: {
                    mechanism: 'plain',
                    username, password,
                },
            };

            const result = await generator.generateAsyncApi(TEST_CLUSTER);
            assert.strictEqual(result.servers.kafka.protocol, 'kafka');
            assert.deepStrictEqual(result.servers.kafka.security, [{ kafkaSecurity: [] }]);
            assert.strictEqual(result.components.securitySchemes.kafkaSecurity.type, 'plain');
        });

        it('should recognise sasl/plain', async () => {
            const TEST_CLUSTER = {
                brokers, topic,
                sasl: {
                    mechanism: 'plain',
                    username, password,
                },
                ssl: true
            };

            const result = await generator.generateAsyncApi(TEST_CLUSTER);
            assert.strictEqual(result.servers.kafka.protocol, 'kafka-secure');
            assert.deepStrictEqual(result.servers.kafka.security, [{ kafkaSecurity: [] }]);
            assert.strictEqual(result.components.securitySchemes.kafkaSecurity.type, 'plain');
        });

        it('should recognise scram-sha-512 with ssl', async () => {
            const TEST_CLUSTER = {
                brokers, topic,
                ssl: true,
                sasl: {
                    mechanism: 'scram-sha-512',
                    username, password,
                }
            };

            const result = await generator.generateAsyncApi(TEST_CLUSTER);
            assert.strictEqual(result.servers.kafka.protocol, 'kafka-secure');
            assert.deepStrictEqual(result.servers.kafka.security, [{ kafkaSecurity: [] }]);
            assert.strictEqual(result.components.securitySchemes.kafkaSecurity.type, 'scramSha512');
        });
    });
});