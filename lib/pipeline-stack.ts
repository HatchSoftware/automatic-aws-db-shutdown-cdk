import {Construct, SecretValue, Stack, StackProps} from "@aws-cdk/core";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {
    CloudFormationCreateUpdateStackAction,
    CodeBuildAction,
    GitHubSourceAction
} from "@aws-cdk/aws-codepipeline-actions";
import { CfnParametersCode } from "@aws-cdk/aws-lambda";
import {StringParameter} from "@aws-cdk/aws-ssm";
import { BuildSpec, PipelineProject, LinuxBuildImage } from "@aws-cdk/aws-codebuild";

export interface PipelineStackProps extends StackProps {
    readonly startUpLambdaCode: CfnParametersCode;
    readonly shutDownLambdaCode: CfnParametersCode;
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

        // Source action
        const oauthToken = SecretValue.secretsManager('/automatic-aws-db-shutdown-cdk/github/token', {jsonField: 'github-token'});
        const githubRepo = StringParameter.valueFromLookup(this, "/automatic-aws-db-shutdown-cdk/github/repo");
        const githubOwner = StringParameter.valueFromLookup(this, "/automatic-aws-db-shutdown-cdk/github/owner");

        const sourceOutput = new Artifact("SourceOutput");
        const sourceAction = new GitHubSourceAction({
            actionName: 'Source',
            owner: githubOwner,
            repo: githubRepo,
            branch: 'master',
            oauthToken: oauthToken,
            output: sourceOutput
        });


        // Build actions
        const lambdaTemplateFileName = 'LambdaStack.template.json';
        const cdkBuild = this.createCDKBuildProject('CdkBuild', lambdaTemplateFileName);
        const cdkBuildOutput = new Artifact('CdkBuildOutput');
        const cdkBuildAction = new CodeBuildAction({
            actionName: 'CDK_Build',
            project: cdkBuild,
            input: sourceOutput,
            outputs: [cdkBuildOutput],
        });

        const shutDownLambdaBuild = this.createLambdaBuildProject('ShutDownLambdaBuild', 'lambda/shut-down');
        const shutDownLambdaBuildOutput = new Artifact('ShutDownLambdaBuildOutput');
        const shutDownLambdaBuildAction = new CodeBuildAction({
            actionName: 'Shut_Down_Lambda_Build',
            project: shutDownLambdaBuild,
            input: sourceOutput,
            outputs: [shutDownLambdaBuildOutput],
        });

        const startUpLambdaBuild = this.createLambdaBuildProject('StartUpLambdaBuild', 'lambda/start-up');
        const startUpLambdaBuildOutput = new Artifact('StartUpLambdaBuildOutput');
        const startUpLambdaBuildAction = new CodeBuildAction({
            actionName: 'Start_Up_Lambda_Build',
            project: startUpLambdaBuild,
            input: sourceOutput,
            outputs: [startUpLambdaBuildOutput],
        });

        // Deployment action
        const deployAction = new CloudFormationCreateUpdateStackAction({
            actionName: 'Lambda_Deploy',
            templatePath: cdkBuildOutput.atPath(lambdaTemplateFileName),
            stackName: 'LambdaDeploymentStack',
            adminPermissions: true,
            parameterOverrides: {
                ...props.startUpLambdaCode.assign(startUpLambdaBuildOutput.s3Location),
                ...props.shutDownLambdaCode.assign(shutDownLambdaBuildOutput.s3Location),
            },
            extraInputs: [startUpLambdaBuildOutput, shutDownLambdaBuildOutput]
        });


        // Construct the pipeline
        const pipelineName = "automatic-aws-db-shutdown-cdk-pipeline";
        const pipeline = new Pipeline(this, pipelineName, {
            pipelineName: pipelineName,
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [startUpLambdaBuildAction, shutDownLambdaBuildAction, cdkBuildAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                }
            ]
        });

        // Make sure the deployment role can get the artifacts from the S3 bucket
        pipeline.artifactBucket.grantRead(deployAction.deploymentRole);
    }

    private createCDKBuildProject(id: string, templateFilename: string) {
        return new PipelineProject(this, id, {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        commands: [
                            "npm install",
                            "npm install -g cdk",
                        ],
                    },
                    build: {
                        commands: [
                            'npm run build',
                            'npm run cdk synth -- -o dist'
                        ],
                    },
                },
                artifacts: {
                    'base-directory': 'dist',
                    files: [
                        templateFilename,
                    ],
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
            },
        });
    }

    private createLambdaBuildProject(id: string, sourceCodeBaseDirectory: string) {
        return new PipelineProject(this, id, {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                artifacts: {
                    'base-directory': sourceCodeBaseDirectory,
                    files: [
                        '*.js'
                    ],
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
            },
        })
    }
}
