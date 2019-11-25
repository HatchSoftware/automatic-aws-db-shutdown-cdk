import {Construct, Duration, Stack, StackProps} from "@aws-cdk/core";
import {CfnParametersCode, Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import {LambdaFunction} from "@aws-cdk/aws-events-targets";
import {PolicyStatement, Effect} from "@aws-cdk/aws-iam";
import {Rule, Schedule} from "@aws-cdk/aws-events";

export interface LambdaStackProps extends StackProps {
    readonly instanceId: string;
    readonly instanceARN: string;
}

export class LambdaStack extends Stack {

    public readonly startUpLambdaCode: CfnParametersCode;
    public readonly shutDownLambdaCode: CfnParametersCode;

    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        this.shutDownLambdaCode = Code.fromCfnParameters();
        this.buildEventTriggeredLambdaFunction("DBShutDown", props.instanceId, props.instanceARN, "rds:StopDBInstance", "0 17 ? * MON-FRI *", this.shutDownLambdaCode);

        this.startUpLambdaCode = Code.fromCfnParameters();
        this.buildEventTriggeredLambdaFunction("DBStartUp", props.instanceId, props.instanceARN, "rds:StartDBInstance", "0 5 ? * MON-FRI *", this.startUpLambdaCode);
    }

    private buildEventTriggeredLambdaFunction(name: string, instanceId: string, instanceARN: string, instanceAction: string, scheduleExpression: string, lambdaCode: CfnParametersCode): Function {
        const lambdaFn = this.buildLambdaFunction(`${name}Function`, "app", lambdaCode, instanceId);

        const instanceActionPolicy = this.buildPolicy(instanceAction, instanceARN);
        lambdaFn.addToRolePolicy(instanceActionPolicy);

        const eventRule = this.buildEventRule(`${name}Rule`, scheduleExpression);
        eventRule.addTarget(new LambdaFunction(lambdaFn));

        return lambdaFn;
    }

    private buildLambdaFunction(id: string, filename: string, code: CfnParametersCode, instanceId: string): Function {
        return new Function(this, id, {
            code: code,
            handler: filename + '.lambdaHandler',
            memorySize: 128,
            timeout: Duration.seconds(300),
            runtime: Runtime.NODEJS_10_X,
            environment: {
                INSTANCE_IDENTIFIER: instanceId
            }
        });
    }

    private buildPolicy(actionToAllow: string, instanceARN: string): PolicyStatement {
        return new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [actionToAllow],
            resources: [instanceARN]
        });
    }

    private buildEventRule(id: string, scheduleExpression: string): Rule {
        return new Rule(this, id, {
            schedule: Schedule.expression('cron(' + scheduleExpression + ')')
        });
    }
}
