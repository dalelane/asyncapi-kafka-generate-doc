const jsonSchemaCompare = require('json-schema-compare');

// to avoid adding duplicates to the AsyncAPI doc that
//  we generate, we maintain a list of schemas we've
//  already added to the doc
let jsonSchemas = [];

function init() {
    jsonSchemas = [];
}

function isNew(schema) {
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
    }

    return newSchema;
}


module.exports = {
    init,
    isNew,
};