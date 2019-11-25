import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import {LambdaStack} from '../lib/lambda-stack';
import {PipelineStack} from "../lib/pipeline-stack";

const accountId = '[YOUR AWS ACCOUNT ID]';
const region = '[YOUR AWS REGION]';
const instanceId = '[YOUR RDS DB INSTANCE ID]';
const instanceARN = '[YOUR RDS DB INSTANCE ARN';

const app = new cdk.App();
const lambdaStack = new LambdaStack(app, 'LambdaStack', {
    env: {
        account: accountId,
        region: region
    },
    instanceId: instanceId,
    instanceARN: instanceARN
});

new PipelineStack(app, 'PipelineStack', {
    env: {
        account: accountId,
        region: region
    },
    startUpLambdaCode: lambdaStack.startUpLambdaCode,
    shutDownLambdaCode: lambdaStack.shutDownLambdaCode,
});

app.synth();
