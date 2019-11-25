const startInstance = require('./start');

exports.lambdaHandler = async (event, context) => {
    const instanceIdentifier = process.env.INSTANCE_IDENTIFIER;
    const result = await startInstance(instanceIdentifier);
    return {
        statusCode: 200,
        body: result,
    }
};
