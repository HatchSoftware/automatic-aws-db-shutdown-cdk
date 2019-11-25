const stopInstance = require('./stop');

exports.lambdaHandler = async (event, context) => {
    const instanceIdentifier = process.env.INSTANCE_IDENTIFIER;
    const result = await stopInstance(instanceIdentifier);
    return {
        statusCode: 200,
        body: result,
    }
};
